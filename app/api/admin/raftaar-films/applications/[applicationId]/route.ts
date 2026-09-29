import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/app/lib/isAdmin";
import { reviewApplication, getPendingApplications } from "@/app/lib/raftaarFilms";
import { docClient } from "@/app/lib/dynamodb";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { FILM_APPLICATIONS_TABLE } from "@/app/lib/raftaarFilms";
import { createNotification } from "@/app/lib/notifications";
import { logAdminAction } from "@/app/lib/auditLog";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ applicationId: string }> }
) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { applicationId } = await params;
    const body = await request.json();
    const { action, rejectionReason } = body;

    if (action === "reject" && !rejectionReason) {
      return NextResponse.json(
        { error: "Rejection reason is required" },
        { status: 400 }
      );
    }

    if (action !== "approve" && action !== "reject") {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    // Get the application to find the userId
    const appResult = await docClient.send(
      new GetCommand({
        TableName: FILM_APPLICATIONS_TABLE,
        Key: { applicationId },
      })
    );

    const application = appResult.Item;
    if (!application) {
      return NextResponse.json(
        { error: "Application not found" },
        { status: 404 }
      );
    }

    // Perform review via canonical library function (which also updates InPlayer-Users on approve)
    await reviewApplication(applicationId, action, admin.email, rejectionReason);

    // Send in-app notification
    if (action === "approve") {
      await createNotification({
        userId: application.userId,
        type: "film_application_approved",
        message:
          "🎬 Your Raftaar Films creator application has been approved! Start creating your first series.",
      });
    } else {
      await createNotification({
        userId: application.userId,
        type: "film_application_rejected",
        message: `Your Raftaar Films application was not approved. Reason: ${rejectionReason}`,
      });
    }

    // Audit log
    await logAdminAction({
      request,
      adminId: admin.userId,
      adminEmail: admin.email,
      action: (action === "approve"
        ? "raftaar_films.application_approve"
        : "raftaar_films.application_reject") as any,
      targetType: "user",
      targetId: application.userId,
      details: rejectionReason || "Approved Raftaar Films creator",
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Failed to review application:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
