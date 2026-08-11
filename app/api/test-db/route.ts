import { NextResponse } from "next/server";
import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";

export async function GET() {
  try {
    const page = await docClient.send(
      new ScanCommand({
        TableName: "InPlayer-Videos",
        Limit: 50,
      })
    );
    return NextResponse.json({ videos: page.Items });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
