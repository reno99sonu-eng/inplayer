import { NextRequest, NextResponse } from "next/server";
import { UpdateCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { revalidateTag } from "next/cache";
import { docClient } from "@/app/lib/dynamodb";
import { requireAdmin } from "@/app/lib/isAdmin";
import { logAdminAction } from "@/app/lib/auditLog";
import { AD_CREATIVES_TABLE, AD_CREATIVES_TAG, AD_IMAGE_DATA_URL_MAX_LENGTH } from "@/app/lib/adCreatives";

function isValidCreativeImage(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.startsWith("data:image/") &&
    value.length <= AD_IMAGE_DATA_URL_MAX_LENGTH
  );
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ adId: string }> }
) {
  let admin;
  try {
    admin = await requireAdmin(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { adId } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const sets: string[] = [];
  const values: Record<string, unknown> = {};

  if (typeof body.active === "boolean") {
    sets.push("active = :active");
    values[":active"] = body.active;
  }
  if (typeof body.linkUrl === "string" && /^https?:\/\//.test(body.linkUrl.trim())) {
    sets.push("linkUrl = :linkUrl");
    values[":linkUrl"] = body.linkUrl.trim().slice(0, 500);
  }
  if (typeof body.title === "string" && body.title.trim()) {
    sets.push("title = :title");
    values[":title"] = body.title.trim().slice(0, 120);
  }
  // Lets an admin swap out just the mobile/tablet image, or just add/
  // replace the desktop/TV one, without deleting and recreating the whole
  // creative (which would reset its impressions/clicks history).
  if (isValidCreativeImage(body.imageUrl)) {
    sets.push("imageUrl = :imageUrl");
    values[":imageUrl"] = body.imageUrl;
  }
  if (isValidCreativeImage(body.imageUrlDesktop)) {
    sets.push("imageUrlDesktop = :imageUrlDesktop");
    values[":imageUrlDesktop"] = body.imageUrlDesktop;
  }

  if (sets.length === 0) {
    return NextResponse.json({ error: "No valid fields to update." }, { status: 400 });
  }

  await docClient.send(
    new UpdateCommand({
      TableName: AD_CREATIVES_TABLE,
      Key: { adId },
      UpdateExpression: `SET ${sets.join(", ")}`,
      ExpressionAttributeValues: values,
    })
  );

  revalidateTag(AD_CREATIVES_TAG, "max");

  await logAdminAction({
    request,
    adminId: admin.userId,
    adminEmail: admin.email,
    action: "ad.update",
    targetType: "ad",
    targetId: adId,
    details: Object.keys(body).join(", "),
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ adId: string }> }
) {
  let admin;
  try {
    admin = await requireAdmin(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { adId } = await params;

  await docClient.send(new DeleteCommand({ TableName: AD_CREATIVES_TABLE, Key: { adId } }));

  revalidateTag(AD_CREATIVES_TAG, "max");

  await logAdminAction({
    request,
    adminId: admin.userId,
    adminEmail: admin.email,
    action: "ad.delete",
    targetType: "ad",
    targetId: adId,
  });

  return NextResponse.json({ success: true });
}
