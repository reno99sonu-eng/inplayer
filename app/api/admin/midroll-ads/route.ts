import { NextRequest, NextResponse } from "next/server";
import { ScanCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";
import { revalidateTag } from "next/cache";
import { docClient } from "@/app/lib/dynamodb";
import { requireAdmin } from "@/app/lib/isAdmin";
import { logAdminAction } from "@/app/lib/auditLog";
import {
  MIDROLL_ADS_TABLE,
  MIDROLL_ADS_TAG,
  MIDROLL_IMAGE_DATA_URL_MAX_LENGTH,
} from "@/app/lib/videoAds";

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
      );
      items.push(...((result.Items || []) as Record<string, unknown>[]));
      exclusiveStartKey = result.LastEvaluatedKey;
    } while (exclusiveStartKey);

    items.sort(
      (a, b) => new Date(b.createdAt as string).getTime() - new Date(a.createdAt as string).getTime()
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

  if (
    typeof imageUrl !== "string" ||
    !imageUrl.startsWith("data:image/") ||
    imageUrl.length > MIDROLL_IMAGE_DATA_URL_MAX_LENGTH
  ) {
    return NextResponse.json(
      { error: "That creative image is too large or invalid. Please try a different image." },
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

  await docClient.send(new PutCommand({ TableName: MIDROLL_ADS_TABLE, Item: item }));

  revalidateTag(MIDROLL_ADS_TAG, "max");

  await logAdminAction({
    request,
    adminId: admin.userId,
    adminEmail: admin.email,
    action: "midroll_ad.create",
    targetType: "midroll_ad",
    targetId: adId,
    details: item.title,
  });

  return NextResponse.json({ ad: item });
}
