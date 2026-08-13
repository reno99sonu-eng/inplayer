import { NextRequest, NextResponse } from "next/server";
import { ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { revalidateTag } from "next/cache";
import { docClient } from "@/app/lib/dynamodb";
import { requireAdmin } from "@/app/lib/isAdmin";
import { logAdminAction } from "@/app/lib/auditLog";
import { sendEmail } from "@/app/lib/ses";
import { AD_CREATIVES_TABLE, AD_CREATIVES_TAG } from "@/app/lib/adCreatives";
import { MIDROLL_ADS_TABLE, MIDROLL_ADS_TAG } from "@/app/lib/videoAds";
import { getSponsorship, activateSponsorship, SPONSORSHIP_DURATION_DAYS } from "@/app/lib/sponsorships";

// The one action that actually starts a sponsor's real 7-day run. Finds
// every creative row (in both ad-rendering tables) already staged under
// this sponsorshipId, flips them all to active: true with the SAME
// expiresAt, and flips the order itself to "active" with a matching
// activatedAt/expiresAt — computed once here, shared by everything, so an
// order's own status and its actual live creatives can never drift apart.
// Requires at least one staged creative; an admin who hasn't uploaded
// anything yet gets a clear error instead of "activating" an empty ad.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sponsorshipId: string }> }
) {
  let admin;
  try {
    admin = await requireAdmin(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sponsorshipId } = await params;
  const sponsorship = await getSponsorship(sponsorshipId).catch(() => null);
  if (!sponsorship) {
    return NextResponse.json({ error: "Sponsorship not found." }, { status: 404 });
  }
  if (sponsorship.paymentStatus !== "paid") {
    return NextResponse.json({ error: "This order hasn't been paid for yet." }, { status: 400 });
  }
  if (sponsorship.status === "active") {
    return NextResponse.json({ error: "Already active." }, { status: 400 });
  }

  const expiresAt = new Date(Date.now() + SPONSORSHIP_DURATION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const [bannerScan, midrollScan] = await Promise.all([
    docClient.send(new ScanCommand({ TableName: AD_CREATIVES_TABLE, FilterExpression: "sponsorshipId = :sid", ExpressionAttributeValues: { ":sid": sponsorshipId } })),
    docClient.send(new ScanCommand({ TableName: MIDROLL_ADS_TABLE, FilterExpression: "sponsorshipId = :sid", ExpressionAttributeValues: { ":sid": sponsorshipId } })),
  ]);
  const bannerRows = bannerScan.Items || [];
  const midrollRows = midrollScan.Items || [];

  if (bannerRows.length === 0 && midrollRows.length === 0) {
    return NextResponse.json(
      { error: "No assets uploaded for this sponsorship yet — upload the sponsor's images/video first." },
      { status: 400 }
    );
  }

  await Promise.all([
    ...bannerRows.map((row) =>
      docClient.send(
        new UpdateCommand({
          TableName: AD_CREATIVES_TABLE,
          Key: { adId: row.adId },
          UpdateExpression: "SET active = :true, expiresAt = :expiresAt",
          ExpressionAttributeValues: { ":true": true, ":expiresAt": expiresAt },
        })
      )
    ),
    ...midrollRows.map((row) =>
      docClient.send(
        new UpdateCommand({
          TableName: MIDROLL_ADS_TABLE,
          Key: { adId: row.adId },
          UpdateExpression: "SET active = :true, expiresAt = :expiresAt",
          ExpressionAttributeValues: { ":true": true, ":expiresAt": expiresAt },
        })
      )
    ),
  ]);

  if (bannerRows.length > 0) revalidateTag(AD_CREATIVES_TAG, "max");
  if (midrollRows.length > 0) revalidateTag(MIDROLL_ADS_TAG, "max");

  const updated = await activateSponsorship(sponsorshipId);

  await logAdminAction({
    request,
    adminId: admin.userId,
    adminEmail: admin.email,
    action: "sponsorship.activate",
    targetType: "sponsorship",
    targetId: sponsorshipId,
    details: `${sponsorship.companyName} — ${bannerRows.length + midrollRows.length} creative(s), live until ${expiresAt}`,
  });

  void sendEmail({
    to: sponsorship.contactEmail,
    subject: "Your InPlayer ad is now live!",
    text: `Your ad is live on InPlayer now, running through ${new Date(expiresAt).toLocaleString("en-IN")}. Track views and clicks anytime from your Sponsorship Dashboard.`,
    html: `<h2>Your ad is live!</h2><p>Your InPlayer sponsorship is now running, through <strong>${new Date(expiresAt).toLocaleString("en-IN")}</strong>.</p><p>Track views and clicks anytime from your Sponsorship Dashboard.</p>`,
  }).catch((err) => console.error(`sponsorship activate: live email failed for ${sponsorshipId}:`, err));

  return NextResponse.json({ sponsorship: updated });
}
