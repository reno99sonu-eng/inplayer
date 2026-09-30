import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/app/lib/isAdmin";
import { docClient } from "@/app/lib/dynamodb";
import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { FILM_SERIES_TABLE } from "@/app/lib/raftaarFilms";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Scan series table
    const result = await docClient.send(
      new ScanCommand({
        TableName: FILM_SERIES_TABLE,
      })
    );
    
    const series = result.Items || [];


    return NextResponse.json({ series });
  } catch (err) {
    console.error("Failed to list series:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
