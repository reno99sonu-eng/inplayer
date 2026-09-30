import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/app/lib/isAdmin";
import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import { createNotification } from "@/app/lib/notifications";
import { logAdminAction } from "@/app/lib/auditLog";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ reportId: string }> }
) {
  try {
    const admin = await requireAdmin(request);
    const { reportId } = await params;
    const body = await request.json();
    const { action, note } = body;

    if (action !== "strike" && action !== "dismiss") {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const reportResult = await docClient.send(
      new GetCommand({
        TableName: "InPlayer-Copyright-Reports",
        Key: { reportId },
      })
    );

    const report = reportResult.Item;
    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    const now = new Date().toISOString();

    if (action === "strike") {
      await docClient.send(
        new UpdateCommand({
          TableName: "InPlayer-Copyright-Reports",
          Key: { reportId },
          UpdateExpression: "SET #s = :status, reviewedBy = :reviewer, reviewedAt = :now",
          ExpressionAttributeNames: { "#s": "status" },
          ExpressionAttributeValues: {
            ":status": "struck",
            ":reviewer": admin.email,
            ":now": now,
          },
        })
      );

      await docClient.send(
        new UpdateCommand({
          TableName: "InPlayer-Videos",
          Key: { videoId: report.videoId },
          UpdateExpression: "SET copyrightStruck = :t",
          ExpressionAttributeValues: { ":t": true },
        })
      );

      await createNotification({
        userId: report.reportedCreatorId,
        type: "copyright",
        message: "⚠️ Your video has received a copyright strike. It may be taken down for review.",
      });

      await logAdminAction({
        request,
        adminId: admin.userId,
        adminEmail: admin.email,
        action: "copyright.strike",
        targetType: "copyright_report",
        targetId: reportId,
        details: note,
      });

    } else if (action === "dismiss") {
      await docClient.send(
        new UpdateCommand({
          TableName: "InPlayer-Copyright-Reports",
          Key: { reportId },
          UpdateExpression: "SET #s = :status, reviewedBy = :reviewer, reviewedAt = :now",
          ExpressionAttributeNames: { "#s": "status" },
          ExpressionAttributeValues: {
            ":status": "dismissed",
            ":reviewer": admin.email,
            ":now": now,
          },
        })
      );

      await logAdminAction({
        request,
        adminId: admin.userId,
        adminEmail: admin.email,
        action: "copyright.dismiss",
        targetType: "copyright_report",
        targetId: reportId,
        details: note,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Failed to resolve copyright report:", error);
    if (error.message === "Not authorized as admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
