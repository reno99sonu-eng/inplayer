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

  const items: Record<string, any>[] = [];
  let exclusiveStartKey: Record<string, unknown> | undefined;

  do {
    const page = await docClient.send(
      new ScanCommand({
        TableName: "InPlayer-Videos",
        FilterExpression: "uploaderId = :uid",
        ExpressionAttributeValues: { ":uid": user.userId },
        ExclusiveStartKey: exclusiveStartKey,
      })
    );
    items.push(...(page.Items || []));
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