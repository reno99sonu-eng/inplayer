import { NextRequest, NextResponse } from "next/server";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";
import { revalidateTag } from "next/cache";
import { docClient } from "@/app/lib/dynamodb";
import { requireAdmin } from "@/app/lib/isAdmin";
import { logAdminAction } from "@/app/lib/auditLog";
import { AD_CREATIVES_TABLE, AD_CREATIVES_TAG, AD_IMAGE_DATA_URL_MAX_LENGTH, AdPlacement } from "@/app/lib/adCreatives";
import { getSponsorship, SponsorshipSection } from "@/app/lib/sponsorships";

// Admin uploads a sponsor's emailed banner images here (up to 3 per
// section, matching "3 images for each ads section") — reuses the exact
// same validation as the regular house-ad form (app/api/admin/ads/route.ts)
// so a sponsor's creative is held to the same size/format bar. Rows are
// created with active: false — staged, not yet visible to real visitors —
// until an admin explicitly hits Activate (see the activate/route.ts in
// this same folder), which is what actually starts the sponsor's paid
// 7-day window and flips these to active: true with a real expiresAt.
const SECTION_TO_PLACEMENT: Record<string, AdPlacement> = {
  homepage_banner: "homepage",
  watch_banner: "watch",
};

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

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { section, images } = body as { section: SponsorshipSection; images: { imageUrl: string; imageUrlDesktop?: string }[] };

  const placement = SECTION_TO_PLACEMENT[section];
  if (!placement) {
    return NextResponse.json({ error: "This section doesn't take image assets." }, { status: 400 });
  }
  if (!sponsorship.sections.includes(section)) {
    return NextResponse.json({ error: "This sponsorship didn't purchase that section." }, { status: 400 });
  }
  if (!Array.isArray(images) || images.length === 0 || images.length > 3) {
    return NextResponse.json({ error: "Upload between 1 and 3 images." }, { status: 400 });
  }

  for (const img of images) {
    if (typeof img.imageUrl !== "string" || !img.imageUrl.startsWith("data:image/") || img.imageUrl.length > AD_IMAGE_DATA_URL_MAX_LENGTH) {
      return NextResponse.json({ error: "One of those images is too large or invalid." }, { status: 400 });
    }
    if (
      img.imageUrlDesktop !== undefined &&
      img.imageUrlDesktop !== null &&
      img.imageUrlDesktop !== "" &&
      (typeof img.imageUrlDesktop !== "string" || !img.imageUrlDesktop.startsWith("data:image/") || img.imageUrlDesktop.length > AD_IMAGE_DATA_URL_MAX_LENGTH)
    ) {
      return NextResponse.json({ error: "One of those desktop/TV images is too large or invalid." }, { status: 400 });
    }
  }

  const createdAt = new Date().toISOString();
  const items = images.map((img) => ({
    adId: randomUUID(),
    placement,
    imageUrl: img.imageUrl,
    ...(img.imageUrlDesktop ? { imageUrlDesktop: img.imageUrlDesktop } : {}),
    linkUrl: sponsorship.websiteUrl,
    title: sponsorship.companyName,
    active: false,
    createdAt,
    impressions: 0,
    clicks: 0,
    sponsorshipId,
    sponsorName: sponsorship.companyName,
  }));

  await Promise.all(items.map((item) => docClient.send(new PutCommand({ TableName: AD_CREATIVES_TABLE, Item: item }))));
  revalidateTag(AD_CREATIVES_TAG, "max");

  await logAdminAction({
    request,
    adminId: admin.userId,
    adminEmail: admin.email,
    action: "sponsorship.banner_assets_uploaded",
    targetType: "sponsorship",
    targetId: sponsorshipId,
    details: `${section}: ${items.length} image(s) for ${sponsorship.companyName}`,
  });

  return NextResponse.json({ items });
}
