import { NextRequest, NextResponse } from "next/server";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import mux from "@/app/lib/mux";
import { docClient } from "@/app/lib/dynamodb";
import { requireAdmin } from "@/app/lib/isAdmin";
import { MIDROLL_ADS_TABLE } from "@/app/lib/videoAds";
import { logAdminAction } from "@/app/lib/auditLog";
import { getSponsorship } from "@/app/lib/sponsorships";

export async function POST(request: NextRequest) {
  let admin;

  try {
    admin = await requireAdmin(request);
  } catch {
    return NextResponse.json(
      { error: "Please sign in as admin to upload." },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    let { title, linkUrl } = body;
    // Optional — set when this upload is a paid sponsor's mid-roll video
    // rather than a regular house ad (see
    // app/admin/sponsorships/[sponsorshipId]/page.tsx). When present, title
    // and linkUrl default to the sponsor's own company name/website if the
    // admin didn't type overrides, and the row starts staged (active:
    // false) rather than immediately live — it only goes live once an
    // admin explicitly hits Activate (see the activate/route.ts under
    // app/api/admin/sponsorships), same as the banner-assets path.
    const sponsorshipId: string | undefined = typeof body.sponsorshipId === "string" ? body.sponsorshipId : undefined;
    let sponsorName: string | undefined;

    if (sponsorshipId) {
      const sponsorship = await getSponsorship(sponsorshipId);
      if (!sponsorship) {
        return NextResponse.json({ error: "Sponsorship not found." }, { status: 404 });
      }
      if (!sponsorship.sections.includes("midroll")) {
        return NextResponse.json({ error: "This sponsorship didn't purchase the mid-roll section." }, { status: 400 });
      }
      title = title?.trim() || sponsorship.companyName;
      linkUrl = linkUrl?.trim() || sponsorship.websiteUrl;
      sponsorName = sponsorship.companyName;
    }

    if (!title?.trim() || !linkUrl?.trim()) {
      return NextResponse.json(
        { error: "Title and link URL are required." },
        { status: 400 }
      );
    }

    const upload = await mux.video.uploads.create({
      cors_origin: "*",
      new_asset_settings: {
        playback_policy: ["public"],
      },
    });

    const adId = upload.id;

    await docClient.send(
      new PutCommand({
        TableName: MIDROLL_ADS_TABLE,
        Item: {
          adId,
          status: "processing",
          title: title.trim().slice(0, 120),
          linkUrl: linkUrl.trim().slice(0, 500),
          imageUrl: "",
          active: sponsorshipId ? false : true,
          createdAt: new Date().toISOString(),
          impressions: 0,
          clicks: 0,
          skips: 0,
          ...(sponsorshipId ? { sponsorshipId, sponsorName } : {}),
        },
      })
    );

    await logAdminAction({
      request,
      adminId: admin.userId,
      adminEmail: admin.email,
      action: "midroll_ad.create",
      targetType: "midroll_ad",
      targetId: adId,
      details: title.trim().slice(0, 120),
    });

    return NextResponse.json({
      uploadUrl: upload.url,
      adId,
    });
  } catch (error) {
    console.error("Failed to create Mux upload for midroll ad:", error);
    return NextResponse.json(
      { error: "Failed to initialize upload." },
      { status: 500 }
    );
  }
}
