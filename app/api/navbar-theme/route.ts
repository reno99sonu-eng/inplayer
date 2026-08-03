import { NextResponse } from "next/server";
import { docClient } from "@/app/lib/dynamodb";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { PLATFORM_SETTINGS_TABLE } from "@/app/lib/platformSettings";

export async function GET() {
  try {
    const result = await docClient.send(
      new GetCommand({
        TableName: PLATFORM_SETTINGS_TABLE,
        Key: { settingsId: "navbar_theme" },
      })
    ).catch(() => null);

    if (result?.Item && result.Item.active !== false && result.Item.imageUrl) {
      return NextResponse.json({
        active: true,
        theme: {
          themeId: String(result.Item.themeId || "active_theme"),
          occasionId: String(result.Item.occasionId || "independence_day"),
          occasionName: String(result.Item.occasionName || "Occasion Theme"),
          title: String(result.Item.title || "Occasion Theme"),
          imageUrl: String(result.Item.imageUrl || ""),
          updatedAt: String(result.Item.updatedAt || new Date().toISOString()),
        },
      });
    }

    return NextResponse.json({ active: false, theme: null });
  } catch (err) {
    console.error("Failed to fetch active navbar theme:", err);
    return NextResponse.json({ active: false, theme: null });
  }
}
