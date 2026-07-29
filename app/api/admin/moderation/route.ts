import { NextRequest, NextResponse } from "next/server";
import { ScanCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import { requireAdmin } from "@/app/lib/isAdmin";

// Combines everything an admin needs to review into two tabs:
//   "reports"     — real user-submitted reports (InPlayer-Reports,
//                    status: "open") on videos, comments, or messages.
//   "autoflagged" — content app/lib/moderation.ts's real-time AI scan held
//                    back on its own, before any human reported it.
// Both are real data straight from DynamoDB — nothing here is simulated.

async function scanAll(
  tableName: string,
  filterExpression?: string,
  values?: Record<string, unknown>,
  names?: Record<string, string>
): Promise<Record<string, unknown>[]> {
  const items: Record<string, unknown>[] = [];
  let exclusiveStartKey: Record<string, unknown> | undefined;

  do {
    const result = await docClient.send(
      new ScanCommand({
        TableName: tableName,
        ...(filterExpression ? { FilterExpression: filterExpression } : {}),
        ...(values ? { ExpressionAttributeValues: values } : {}),
        ...(names ? { ExpressionAttributeNames: names } : {}),
        ExclusiveStartKey: exclusiveStartKey,
      })
    );
    items.push(...((result.Items || []) as Record<string, unknown>[]));
    exclusiveStartKey = result.LastEvaluatedKey;
  } while (exclusiveStartKey);

  return items;
}

async function hydrateReportSnippet(r: Record<string, unknown>): Promise<string | null> {
  try {
    const targetType = (r.targetType as string) || "video";

    if (targetType === "comment") {
      const res = await docClient.send(
        new GetCommand({
          TableName: "InPlayer-Comments",
          Key: { videoId: r.videoId, commentId: r.commentId },
          ProjectionExpression: "#t",
          ExpressionAttributeNames: { "#t": "text" },
        })
      );
      return (res.Item?.text as string) || null;
    }

    if (targetType === "message") {
      const res = await docClient.send(
        new GetCommand({
          TableName: "InPlayer-Messages",
          Key: { conversationId: r.conversationId, messageId: r.messageId },
          ProjectionExpression: "#t",
          ExpressionAttributeNames: { "#t": "text" },
        })
      );
      return (res.Item?.text as string) || null;
    }

    const res = await docClient.send(
      new GetCommand({
        TableName: "InPlayer-Videos",
        Key: { videoId: r.videoId },
        ProjectionExpression: "title",
      })
    );
    return (res.Item?.title as string) || null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tab = request.nextUrl.searchParams.get("tab") === "autoflagged" ? "autoflagged" : "reports";

  if (tab === "reports") {
    try {
      const reports = await scanAll("InPlayer-Reports", "#s = :open", {
        ":open": "open",
      }, { "#s": "status" });

      const sorted = reports
        .sort(
          (a, b) =>
            new Date(b.createdAt as string).getTime() - new Date(a.createdAt as string).getTime()
        )
        .slice(0, 150);

      const items = await Promise.all(
        sorted.map(async (r) => ({ ...r, snippet: await hydrateReportSnippet(r) }))
      );

      return NextResponse.json({ items });
    } catch (err) {
      console.error("Moderation reports scan failed (table may not exist yet):", err);
      return NextResponse.json({ items: [], tableMissing: true });
    }
  }

  try {
    const [comments, messages, videos] = await Promise.all([
      scanAll("InPlayer-Comments", "hidden = :t", { ":t": true }),
      scanAll("InPlayer-Messages", "hidden = :t", { ":t": true }),
      scanAll("InPlayer-Videos", "moderationHidden = :t", { ":t": true }),
    ]);

    const items = [
      ...comments.map((c) => ({
        id: `comment#${c.videoId}#${c.commentId}`,
        contentType: "comment" as const,
        videoId: c.videoId as string,
        commentId: c.commentId as string,
        categories: (c.flaggedCategories as string[]) || [],
        snippet: (c.text as string) || "",
        createdAt: (c.moderatedAt as string) || (c.createdAt as string),
      })),
      ...messages.map((m) => ({
        id: `message#${m.conversationId}#${m.messageId}`,
        contentType: "message" as const,
        conversationId: m.conversationId as string,
        messageId: m.messageId as string,
        categories: (m.flaggedCategories as string[]) || [],
        snippet: (m.text as string) || "",
        createdAt: (m.moderatedAt as string) || (m.createdAt as string),
      })),
      ...videos.map((v) => ({
        id: `video#${v.videoId}`,
        contentType: "video" as const,
        videoId: v.videoId as string,
        categories: (v.flaggedCategories as string[]) || [],
        snippet: (v.title as string) || "Untitled",
        createdAt: (v.moderatedAt as string) || (v.uploadedAt as string),
      })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({ items });
  } catch (err) {
    console.error("Auto-flagged content scan failed:", err);
    return NextResponse.json({ items: [] });
  }
}
