import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/app/lib/isAdmin";
import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status") || "pending";

    const params: any = {
      TableName: "InPlayer-Copyright-Reports",
    };

    if (status === "pending") {
      params.FilterExpression = "#s = :status";
      params.ExpressionAttributeNames = { "#s": "status" };
      params.ExpressionAttributeValues = { ":status": "pending" };
    }

    const result = await docClient.send(new ScanCommand(params));
    
    let reports = result.Items || [];
    
    // Sort by createdAt desc
    reports.sort((a, b) => {
      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();
      return dateB - dateA;
    });

    return NextResponse.json({ reports });
  } catch (error: any) {
    console.error("Failed to fetch copyright reports:", error);
    if (error.message === "Not authorized as admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
