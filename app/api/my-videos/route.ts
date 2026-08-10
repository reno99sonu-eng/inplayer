import { NextRequest, NextResponse } from "next/server";
import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import { verifyAuth } from "@/app/lib/verifyAuth";
import { selfHealVideoBatch } from "@/app/lib/selfHealVideo";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET(request: NextRequest) {
  let user;

  try {
    user = await verifyAuth(request);
  } catch {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const userId = user.userId;
  const usernameLower = (user.username || "").toLowerCase();
  const nameLower = (user.name || "").toLowerCase();

  const items: Record<string, any>[] = [];
  let exclusiveStartKey: Record<string, unknown> | undefined;

  do {
    const page = await docClient.send(
      new ScanCommand({
        TableName: "InPlayer-Videos",
        ExclusiveStartKey: exclusiveStartKey,
      })
    );

    for (const item of page.Items || []) {
      const itemUploaderId = String(item.uploaderId || "");
      const itemUploaderName = String(item.uploaderName || "").toLowerCase();
      const itemUploaderUsername = String(item.uploaderUsername || "").toLowerCase();

      const matchesId = itemUploaderId === userId;
      const matchesUsername =
        Boolean(usernameLower) &&
        (itemUploaderId.toLowerCase() === usernameLower ||
          itemUploaderName === usernameLower ||
          itemUploaderUsername === usernameLower);
      const matchesName =
        Boolean(nameLower) &&
        (itemUploaderName === nameLower || itemUploaderUsername === nameLower);

      if (matchesId || matchesUsername || matchesName) {
        items.push(item);
      }
    }

    exclusiveStartKey = page.LastEvaluatedKey;
  } while (exclusiveStartKey);

  const healed = await selfHealVideoBatch(items);

  const videos = healed.sort(
    (a, b) =>
      new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
  );

  return NextResponse.json({ videos }, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    },
  });
}