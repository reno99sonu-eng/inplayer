import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/app/lib/isAdmin";
import { docClient } from "@/app/lib/dynamodb";
import { UpdateCommand, DeleteCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { FILM_SERIES_TABLE } from "@/app/lib/raftaarFilms";
import { logAdminAction } from "@/app/lib/auditLog";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ seriesId: string }> }
) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { seriesId } = await params;
    const body = await request.json();

    const updateExpressions: string[] = [];
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, any> = {};

    for (const [key, value] of Object.entries(body)) {
      updateExpressions.push(`#${key} = :${key}`);
      expressionAttributeNames[`#${key}`] = key;
      expressionAttributeValues[`:${key}`] = value;
    }

    if (updateExpressions.length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    await docClient.send(
      new UpdateCommand({
        TableName: FILM_SERIES_TABLE,
        Key: { seriesId },
        UpdateExpression: `SET ${updateExpressions.join(", ")}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
      })
    );

    // Audit log
    await logAdminAction({
      request,
      adminId: admin.userId,
      adminEmail: admin.email,
      action: "raftaar_films.series_update" as any,
      targetType: "video",
      targetId: seriesId,
      details: "Admin override update",
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Failed to update series:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ seriesId: string }> }
) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { seriesId } = await params;

    // Delete series
    await docClient.send(
      new DeleteCommand({
        TableName: FILM_SERIES_TABLE,
        Key: { seriesId },
      })
    );

    // Cascade delete episodes from InPlayer-Videos
    try {
      const episodesResult = await docClient.send(
        new ScanCommand({
          TableName: "InPlayer-Videos",
          FilterExpression: "seriesId = :sid",
          ExpressionAttributeValues: { ":sid": seriesId },
          ProjectionExpression: "videoId",
        })
      );

      const episodes = episodesResult.Items || [];
      for (const ep of episodes) {
        await docClient.send(
          new DeleteCommand({
            TableName: "InPlayer-Videos",
            Key: { videoId: ep.videoId },
          })
        );
      }
    } catch (e) {
      console.warn("Failed to cascade delete episodes for series:", e);
    }

    // Audit log
    await logAdminAction({
      request,
      adminId: admin.userId,
      adminEmail: admin.email,
      action: "raftaar_films.series_delete" as any,
      targetType: "video",
      targetId: seriesId,
      details: "Admin cascade delete",
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Failed to delete series:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
