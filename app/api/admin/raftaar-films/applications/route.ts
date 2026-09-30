import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/app/lib/isAdmin";
import { docClient } from "@/app/lib/dynamodb";
import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { FILM_APPLICATIONS_TABLE } from "@/app/lib/raftaarFilms";

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
        TableName: FILM_APPLICATIONS_TABLE,
      })
    );
    
    let applications = (result.Items || []) as any[];
    
    if (status && status !== "all") {
      applications = applications.filter((app) => app.status === status);
    }

    // Sort newest first
    applications.sort((a, b) => {
      const timeA = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
      const timeB = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
      return timeB - timeA;
    });

    return NextResponse.json({ applications });
  } catch (err) {
    console.error("Failed to list applications:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

