import { NextRequest, NextResponse } from "next/server";
import { ScanCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";
import { docClient } from "@/app/lib/dynamodb";
import { requireAdmin } from "@/app/lib/isAdmin";
import { logAdminAction } from "@/app/lib/auditLog";
import { MIDROLL_ADS_TABLE, MIDROLL_IMAGE_DATA_URL_MAX_LENGTH } from "@/app/lib/videoAds";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const items: Record<string, unknown>[] = [];
    let exclusiveStartKey: Record<string, unknown> | undefined;
    do {
      const result = await docClient.send(
        new ScanCommand({ TableName: MIDROLL_ADS_TABLE, ExclusiveStartKey: exclusiveStartKey })
      ).catch(() => null);
      if (result?.Items) {
        items.push(...(result.Items as Record<string, unknown>[]));
      }
      exclusiveStartKey = result?.LastEvaluatedKey;
    } while (exclusiveStartKey);

    items.sort(
      (a, b) => new Date((b.createdAt as string) || 0).getTime() - new Date((a.createdAt as string) || 0).getTime()
    );

    return NextResponse.json({ items });
  } catch (err) {
    console.error("Midroll ad creatives scan failed (table may not exist yet):", err);
    return NextResponse.json({ items: [], tableMissing: true });
  }
}

export async function POST(request: NextRequest) {
  let admin;
  try {
    admin = await requireAdmin(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { imageUrl, linkUrl, title } = body;

  const isMediaValid =
    typeof imageUrl === "string" &&
    (imageUrl.startsWith("data:image/") ||
      imageUrl.startsWith("data:video/") ||
      /^https?:\/\//.test(imageUrl.trim())) &&
    imageUrl.length <= MIDROLL_IMAGE_DATA_URL_MAX_LENGTH;

  if (!isMediaValid) {
    return NextResponse.json(
      { error: "That creative media file is too large or invalid. Please select an image or video under 25MB." },
      { status: 400 }
    );
  }

  if (typeof linkUrl !== "string" || !/^https?:\/\//.test(linkUrl.trim())) {
    return NextResponse.json(
      { error: "A valid link URL starting with http:// or https:// is required." },
      { status: 400 }
    );
  }
  if (typeof title !== "string" || !title.trim()) {
    return NextResponse.json({ error: "A title is required." }, { status: 400 });
  }

  const adId = randomUUID();
  const item = {
    adId,
    imageUrl,
    linkUrl: linkUrl.trim().slice(0, 500),
    title: title.trim().slice(0, 120),
    active: true,
    createdAt: new Date().toISOString(),
    impressions: 0,
    clicks: 0,
    skips: 0,
  };

  try {
    await docClient.send(new PutCommand({ TableName: MIDROLL_ADS_TABLE, Item: item }));
  } catch (err) {
    console.error("Midroll PutCommand failed:", err);
    return NextResponse.json({ error: "Couldn't save that midroll ad right now." }, { status: 500 });
  }

  await logAdminAction({
    request,
    adminId: admin.userId,
    adminEmail: admin.email,
    action: "midroll_ad.create",
    targetType: "midroll_ad",
    targetId: adId,
    details: item.title,
  }).catch(() => null);

  return NextResponse.json({ ad: item });
}
