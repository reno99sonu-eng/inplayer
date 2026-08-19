import { NextRequest, NextResponse } from "next/server";
import { ScanCommand, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import { requireAdmin } from "@/app/lib/isAdmin";
import { resolveUsernames } from "@/app/lib/resolveUsernames";
import { logAdminAction } from "@/app/lib/auditLog";

// Combines everything an admin needs to review into three tabs:
//   "reports"     — real user-submitted reports (InPlayer-Reports,
//                    status: "open") on videos, comments, or messages.
//   "autoflagged" — content app/lib/moderation.ts's real-time AI scan held
//                    back on its own, before any human reported it.
//   "strikes"     — accounts app/lib/moderationStrikes.ts's automated
//                    3-strike system suspended on its own after a third
//                    violation (banReviewPending: true on InPlayer-Users),
//                    waiting on a human to uphold or lift the ban.
// All real data straight from DynamoDB — nothing here is simulated.

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

  const tabParam = request.nextUrl.searchParams.get("tab");
  const tab = tabParam === "autoflagged" ? "autoflagged" : tabParam === "strikes" ? "strikes" : "reports";

  if (tab === "strikes") {
    try {
      const users = await scanAll("InPlayer-Users", "banReviewPending = :t", { ":t": true });
      const usernames = await resolveUsernames(users.map((u) => u.userId as string));

      const items = users
        .map((u) => ({
          userId: u.userId as string,
          username: usernames.get(u.userId as string) || null,
          name: (u.name as string) || null,
          aiModerationStrikes: Number(u.aiModerationStrikes) || 0,
          banReviewReason: (u.banReviewReason as string) || null,
          updatedAt: (u.updatedAt as string) || null,
        }))
        .sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());

      return NextResponse.json({ items });
    } catch (err) {
      console.error("Strike review scan failed:", err);
      return NextResponse.json({ items: [] });
    }
  }

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
    // "hidden" collides with a DynamoDB reserved word, so it needs an
    // ExpressionAttributeNames alias rather than being written bare into
    // the FilterExpression string (bare use throws ValidationException on
    // every call, which the catch below was silently swallowing — this
    // tab was returning zero auto-flagged items no matter what).
    const [comments, messages, videos] = await Promise.all([
      scanAll("InPlayer-Comments", "#hidden = :t", { ":t": true }, { "#hidden": "hidden" }),
      scanAll("InPlayer-Messages", "#hidden = :t", { ":t": true }, { "#hidden": "hidden" }),
      // Videos reach this queue for either of two independent reasons: the
      // general policy check hid them (moderationHidden), OR the audience
      // classifier disagreed with what the creator declared
      // (audienceMismatch — see app/lib/audienceClassifier.ts). The second
      // kind is often deliberately NOT hidden: a weak signal shouldn't bury
      // a legitimate video, it should just get a human to look at it. Both
      // still need reviewing, so this is one OR'd scan rather than two
      // passes over the same table.
      scanAll(
        "InPlayer-Videos",
        "moderationHidden = :t OR audienceMismatch = :t",
        { ":t": true }
      ),
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
        // Audience-mismatch detail, so an admin can see BOTH sides — what
        // the creator picked and what the AI read it as — plus the specific
        // signals, rather than just a generic "flagged" badge. Only present
        // on video rows; the other content types have no audience.
        audienceMismatch: v.audienceMismatch === true,
        audienceDeclared: (v.audienceDeclared as string) || null,
        audienceSuggested: (v.audienceSuggested as string) || null,
        audienceSignals: (v.audienceSignals as string[]) || [],
        // Whether it's actually hidden right now. A mismatch on a weak
        // signal stays publicly visible pending review, and the admin
        // needs to know which of the two they're looking at.
        moderationHidden: v.moderationHidden === true,
      })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({ items });
  } catch (err) {
    console.error("Auto-flagged content scan failed:", err);
    return NextResponse.json({ items: [] });
  }
}

// The human half of the 3-strike system's "admin-reviewed" promise — see
// app/lib/moderationStrikes.ts. A strike-3 account is already suspended
// the moment it happens; this endpoint just lets an admin either confirm
// that (uphold — clears banReviewPending so it drops off this queue, the
// suspension itself is untouched) or overturn it (lift — un-suspends the
// account AND resets the strike counter back to 0, a genuine clean slate
// rather than leaving them one more flagged post away from an instant
// re-ban).
export async function POST(request: NextRequest) {
  let admin;
  try {
    admin = await requireAdmin(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { userId, action } = body;

  if (!userId || typeof userId !== "string") {
    return NextResponse.json({ error: "userId is required." }, { status: 400 });
  }
  if (action !== "uphold_ban" && action !== "lift_ban") {
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  }

  try {
    if (action === "uphold_ban") {
      await docClient.send(
        new UpdateCommand({
          TableName: "InPlayer-Users",
          Key: { userId },
          UpdateExpression: "SET banReviewPending = :f, banReviewedAt = :now, banReviewedBy = :by",
          ExpressionAttributeValues: { ":f": false, ":now": new Date().toISOString(), ":by": admin.email },
        })
      );
    } else {
      await docClient.send(
        new UpdateCommand({
          TableName: "InPlayer-Users",
          Key: { userId },
          UpdateExpression:
            "SET isSuspended = :s, banReviewPending = :f, aiModerationStrikes = :zero, banReviewedAt = :now, banReviewedBy = :by REMOVE suspendedUntil",
          ExpressionAttributeValues: {
            ":s": false,
            ":f": false,
            ":zero": 0,
            ":now": new Date().toISOString(),
            ":by": admin.email,
          },
        })
      );
    }
  } catch (err) {
    console.error(`admin/moderation: ${action} failed for ${userId}:`, err);
    return NextResponse.json({ error: "Couldn't save that right now." }, { status: 500 });
  }

  await logAdminAction({
    request,
    adminId: admin.userId,
    adminEmail: admin.email,
    action: action === "uphold_ban" ? "user.ban_strike" : "user.ban_lift",
    targetType: "user",
    targetId: userId,
    details: action === "uphold_ban" ? "Admin upheld the strike-3 suspension" : "Admin lifted the ban and reset strikes",
  });

  return NextResponse.json({ success: true });
}
