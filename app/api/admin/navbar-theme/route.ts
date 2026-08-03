import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/app/lib/isAdmin";
import { docClient } from "@/app/lib/dynamodb";
import { GetCommand, PutCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";

export const NAVBAR_THEME_TABLE = "InPlayer-Navbar-Themes";

export async function GET(request: NextRequest) {
  const adminRes = await requireAdmin(request);
  if (adminRes) return adminRes;

  try {
    const result = await docClient.send(
      new GetCommand({
        TableName: NAVBAR_THEME_TABLE,
        Key: { themeId: "active_theme" },
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
  const adminRes = await requireAdmin(request);
  if (adminRes) return adminRes;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const { occasionId, occasionName, title, imageUrl, active } = body;
  if (!imageUrl || typeof imageUrl !== "string") {
    return NextResponse.json({ error: "imageUrl is required." }, { status: 400 });
  }

  const themeItem = {
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
        TableName: NAVBAR_THEME_TABLE,
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
  const adminRes = await requireAdmin(request);
  if (adminRes) return adminRes;

  try {
    await docClient.send(
      new DeleteCommand({
        TableName: NAVBAR_THEME_TABLE,
        Key: { themeId: "active_theme" },
      })
    ).catch(() => null);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Admin navbar theme DELETE failed:", err);
    return NextResponse.json({ error: "Failed to delete theme." }, { status: 500 });
  }
}
