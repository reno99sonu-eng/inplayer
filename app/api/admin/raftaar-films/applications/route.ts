import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/app/lib/isAdmin";
import { docClient } from "@/app/lib/dynamodb";
import { ScanCommand } from "@aws-sdk/lib-dynamodb";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    // Scan applications table
    const result = await docClient.send(
      new ScanCommand({
        TableName: "InPlayer-RaftaarFilms-Applications",
      })
    );
    
    let applications = result.Items || [];
    
    if (status === "pending") {
      applications = applications.filter((app) => app.status === "pending");
    }

    return NextResponse.json({ applications });
  } catch (err) {
    console.error("Failed to list applications:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
