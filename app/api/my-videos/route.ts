import { NextRequest, NextResponse } from "next/server";
import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import { verifyAuth } from "@/app/lib/verifyAuth";
import { selfHealVideoBatch } from "@/app/lib/selfHealVideo";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  let user;

  try {
    user = await verifyAuth(request);
  } catch {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const result = await docClient.send(
    new ScanCommand({
      TableName: "InPlayer-Videos",
      FilterExpression: "uploaderId = :uploaderId",
      ExpressionAttributeValues: { ":uploaderId": user.userId },
    })
  );

  const items = await selfHealVideoBatch((result.Items || []) as Record<string, any>[]);

  const videos = items.sort(
    (a, b) =>
      new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
  );

  return NextResponse.json({ videos });
}