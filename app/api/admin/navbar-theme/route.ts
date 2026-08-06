import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/app/lib/isAdmin";
import { docClient } from "@/app/lib/dynamodb";
import { GetCommand, PutCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { PLATFORM_SETTINGS_TABLE } from "@/app/lib/platformSettings";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized admin access." }, { status: 401 });
  }

  try {
    const result = await docClient.send(
      new GetCommand({
        TableName: PLATFORM_SETTINGS_TABLE,
        Key: { settingsId: "navbar_theme" },
      })
    ).catch(() => null);

    const theme = result?.Item
      ? {
          active: result.Item.active !== false,
          themeId: String(result.Item.themeId || "active_theme"),
          occasionId: String(result.Item.occasionId || "independence_day"),
          occasionName: String(result.Item.occasionName || "Occasion Theme"),
          title: String(result.Item.title || "Occasion Theme"),
          imageUrl: String(result.Item.imageUrl || ""),
          updatedAt: String(result.Item.updatedAt || new Date().toISOString()),
        }
      : null;

    return NextResponse.json({ success: true, theme });
  } catch (err) {
    console.error("Admin navbar theme GET failed:", err);
    return NextResponse.json({ success: false, theme: null });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized admin access." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const { occasionId, occasionName, title, imageUrl, active } = body;
  if (!imageUrl || typeof imageUrl !== "string") {
    return NextResponse.json({ error: "imageUrl is required." }, { status: 400 });
  }
  // DynamoDB rejects any item over 400KB total. This whole item is just this
  // one image plus a few short strings, so the image itself is effectively
  // the budget. Catch an oversized image here with a clear message instead
  // of letting PutCommand fail below with the opaque "Failed to save theme
  // in DynamoDB" — this is a backstop; the AI generator route already
  // shrinks what it hands back, so this should only ever trip if something
  // else supplies a raw, unprocessed image.
  if (imageUrl.length > 350_000) {
    return NextResponse.json(
      { error: "That theme graphic is too large to save. Try generating it again." },
      { status: 400 }
    );
  }

  const themeItem = {
    settingsId: "navbar_theme",
    themeId: "active_theme",
    occasionId: String(occasionId || "custom"),
    occasionName: String(occasionName || "Occasion Theme"),
    title: String(title || "Occasion Theme"),
    imageUrl: String(imageUrl),
    active: active !== false,
    updatedAt: new Date().toISOString(),
  };

  try {
    await docClient.send(
      new PutCommand({
        TableName: PLATFORM_SETTINGS_TABLE,
        Item: themeItem,
      })
    );
    return NextResponse.json({ success: true, theme: themeItem });
  } catch (err) {
    console.error("Admin navbar theme POST failed:", err);
    return NextResponse.json({ error: "Failed to save theme in DynamoDB." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireAdmin(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized admin access." }, { status: 401 });
  }

  try {
    await docClient.send(
      new DeleteCommand({
        TableName: PLATFORM_SETTINGS_TABLE,
        Key: { settingsId: "navbar_theme" },
      })
    ).catch(() => null);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Admin navbar theme DELETE failed:", err);
    return NextResponse.json({ error: "Failed to delete theme." }, { status: 500 });
  }
}
