import {
  ScanCommand,
  QueryCommand,
  GetCommand,
  UpdateCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import mux from "@/app/lib/mux";
import { cancelSubscription } from "@/app/lib/razorpay";
import { deleteCognitoUser } from "@/app/lib/cognitoClient";
import {
  MEMBERSHIPS_TABLE,
  REVENUE_LEDGER_TABLE,
  PAYOUTS_TABLE,
  KYC_DOCUMENTS_TABLE,
  KYC_DOC_TYPES,
  KycDocType,
} from "@/app/lib/creatorPayouts";

// Real, permanent, irreversible deletion — used by the Admin Panel's
// "Delete" actions (app/api/admin/videos/[videoId] and
// app/api/admin/users/[userId]) and by the creator's own video-delete
// (app/api/my-videos/[videoId]), so a video disappears the same complete
// way no matter who triggers it. Every table this touches was mapped by
// hand against the actual PutCommand/QueryCommand calls elsewhere in this
// codebase — see the inline notes on each step for why it's a Query vs a
// full Scan.
//
// Table name literals below intentionally match the ones already
// hardcoded in each feature's own route file (this codebase's established
// convention — see e.g. CONVERSATIONS_TABLE redeclared identically in
// three separate files already) rather than centralizing them, so this
// file doesn't require touching a dozen unrelated routes just to export
// constants.

const VIDEOS_TABLE = "InPlayer-Videos";
const COMMENTS_TABLE = "InPlayer-Comments";
const LIKES_TABLE = "InPlayer-Likes";
const WATCH_HISTORY_TABLE = "InPlayer-WatchHistory";
const WATCHLIST_TABLE = "InPlayer-Watchlist";
const DOWNLOADS_TABLE = "InPlayer-Downloads";
const PLAYLISTS_TABLE = "InPlayer-Playlists";
const NOTIFICATIONS_TABLE = "InPlayer-Notifications";
const REPORTS_TABLE = "InPlayer-Reports";
const DAILY_VIEWS_TABLE = "InPlayer-Video-Daily-Views";
const DAILY_STATS_TABLE = "InPlayer-Channel-Daily-Stats";
const SUBSCRIPTIONS_TABLE = "InPlayer-Subscriptions";
const USERS_TABLE = "InPlayer-Users";
const USERNAMES_TABLE = "InPlayer-Usernames";

// Deliberately NOT touched by either cascade below: InPlayer-Conversations
// / InPlayer-Messages. Same policy as the existing self-service
// app/api/account/delete already settled on — a message stores a snapshot
// of the sender's name/avatar rather than a live reference (so it keeps
// rendering fine either way), and deleting a user's message rows would
// gut the OTHER participant's conversation history, which isn't this
// deletion's to take. If that policy should change, it's a deliberate
// follow-up, not a silent side effect of this file.

async function scanAll(
  tableName: string,
  filterExpression: string,
  values: Record<string, unknown>,
  projection?: string
): Promise<Record<string, unknown>[]> {
  const items: Record<string, unknown>[] = [];
  let exclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const result = await docClient.send(
      new ScanCommand({
        TableName: tableName,
        FilterExpression: filterExpression,
        ExpressionAttributeValues: values,
        ProjectionExpression: projection,
        ExclusiveStartKey: exclusiveStartKey,
      })
    );
    items.push(...((result.Items || []) as Record<string, unknown>[]));
    exclusiveStartKey = result.LastEvaluatedKey;
  } while (exclusiveStartKey);
  return items;
}

async function queryAll(
  tableName: string,
  keyCondition: string,
  values: Record<string, unknown>,
  indexName?: string
): Promise<Record<string, unknown>[]> {
  const items: Record<string, unknown>[] = [];
  let exclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const result = await docClient.send(
      new QueryCommand({
        TableName: tableName,
        IndexName: indexName,
        KeyConditionExpression: keyCondition,
        ExpressionAttributeValues: values,
        ExclusiveStartKey: exclusiveStartKey,
      })
    );
    items.push(...((result.Items || []) as Record<string, unknown>[]));
    exclusiveStartKey = result.LastEvaluatedKey;
  } while (exclusiveStartKey);
  return items;
}

// Best-effort delete: logs and records a message instead of throwing, so
// one failed row never aborts the rest of a cascade.
async function safeDelete(
  errors: string[],
  label: string,
  fn: () => Promise<unknown>
): Promise<void> {
  try {
    await fn();
  } catch (err) {
    console.error(`cascadeDelete: ${label} failed:`, err);
    errors.push(label);
  }
}

export interface CascadeResult {
  success: boolean;
  errors: string[];
}

// Full real deletion of one video/Short: the Mux asset, every row that
// references it anywhere in the app, and the video row itself. Reused by
// both the creator's own delete (app/api/my-videos/[videoId]) and the
// admin delete (app/api/admin/videos/[videoId]) so the two stay in sync —
// there's exactly one definition of "a video is really gone."
export async function deleteVideoCascade(videoId: string): Promise<CascadeResult> {
  const errors: string[] = [];

  const existing = await docClient.send(
    new GetCommand({ TableName: VIDEOS_TABLE, Key: { videoId } })
  );
  if (!existing.Item) {
    return { success: false, errors: ["Video not found."] };
  }

  // 1. The actual Mux asset.
  if (existing.Item.muxAssetId) {
    await safeDelete(errors, "Mux asset", () =>
      mux.video.assets.delete(existing.Item!.muxAssetId as string)
    );
  }

  // 2. Comments on this video — Comments is keyed (videoId, commentId), so
  // this is a cheap indexed Query, not a Scan.
  await safeDelete(errors, "comments", async () => {
    const comments = await queryAll(COMMENTS_TABLE, "videoId = :v", { ":v": videoId });
    await Promise.all(
      comments.map((c) =>
        docClient.send(
          new DeleteCommand({
            TableName: COMMENTS_TABLE,
            Key: { videoId, commentId: c.commentId },
          })
        )
      )
    );
  });

  // 3. Likes on this video — Likes is keyed (userId, videoId), so finding
  // every like ON this video (rather than every like BY a user) has no
  // index and needs a full Scan.
  await safeDelete(errors, "likes", async () => {
    const likes = await scanAll(LIKES_TABLE, "videoId = :v", { ":v": videoId });
    await Promise.all(
      likes.map((l) =>
        docClient.send(
          new DeleteCommand({ TableName: LIKES_TABLE, Key: { userId: l.userId, videoId } })
        )
      )
    );
  });

  // 4. Everyone's watch history entries for this video (Scan — no index).
  await safeDelete(errors, "watch history", async () => {
    const rows = await scanAll(WATCH_HISTORY_TABLE, "videoId = :v", { ":v": videoId });
    await Promise.all(
      rows.map((r) =>
        docClient.send(
          new DeleteCommand({
            TableName: WATCH_HISTORY_TABLE,
            Key: { userId: r.userId, videoId },
          })
        )
      )
    );
  });

  // 5. Everyone's watchlist entries for this video (Scan — no index).
  await safeDelete(errors, "watchlist entries", async () => {
    const rows = await scanAll(WATCHLIST_TABLE, "videoId = :v", { ":v": videoId });
    await Promise.all(
      rows.map((r) =>
        docClient.send(
          new DeleteCommand({ TableName: WATCHLIST_TABLE, Key: { userId: r.userId, videoId } })
        )
      )
    );
  });

  // 6. Everyone's download records for this video (Scan — no index).
  await safeDelete(errors, "download records", async () => {
    const rows = await scanAll(DOWNLOADS_TABLE, "videoId = :v", { ":v": videoId });
    await Promise.all(
      rows.map((r) =>
        docClient.send(
          new DeleteCommand({ TableName: DOWNLOADS_TABLE, Key: { userId: r.userId, videoId } })
        )
      )
    );
  });

  // 7. Pull this video out of every playlist (and every "Saved" shelf)
  // that references it — videoIds is a String Set with no index, so this
  // has to Scan every playlist row and check its set in memory.
  await safeDelete(errors, "playlist references", async () => {
    const rows = await scanAll(
      PLAYLISTS_TABLE,
      "contains(videoIds, :v)",
      { ":v": videoId },
      "userId, playlistId"
    );
    await Promise.all(
      rows.map((r) =>
        docClient.send(
          new UpdateCommand({
            TableName: PLAYLISTS_TABLE,
            Key: { userId: r.userId, playlistId: r.playlistId },
            UpdateExpression: "DELETE videoIds :v",
            ExpressionAttributeValues: { ":v": new Set([videoId]) },
          })
        )
      )
    );
  });

  // 8. Notifications that reference this video (likes/comments alerts) —
  // videoId is a plain attribute here, so Scan.
  await safeDelete(errors, "notifications", async () => {
    const rows = await scanAll(
      NOTIFICATIONS_TABLE,
      "videoId = :v",
      { ":v": videoId },
      "userId, notificationId"
    );
    await Promise.all(
      rows.map((r) =>
        docClient.send(
          new DeleteCommand({
            TableName: NOTIFICATIONS_TABLE,
            Key: { userId: r.userId, notificationId: r.notificationId },
          })
        )
      )
    );
  });

  // 9. Reports naming this video or a comment on it — reportId is a
  // random UUID PK with no index on videoId, so Scan.
  await safeDelete(errors, "reports", async () => {
    const rows = await scanAll(REPORTS_TABLE, "videoId = :v", { ":v": videoId }, "reportId");
    await Promise.all(
      rows.map((r) =>
        docClient.send(new DeleteCommand({ TableName: REPORTS_TABLE, Key: { reportId: r.reportId } }))
      )
    );
  });

  // 10. Daily view-count rows for this video. IMPORTANT: this table is
  // partitioned by `date` (PK) with `videoId` as the sort key, and is
  // shared across EVERY video on the platform for a given day — the
  // filter below matches on `videoId` only (never on `date` alone), so it
  // can only ever remove this one video's own rows, never another
  // video's same-day numbers.
  await safeDelete(errors, "daily view stats", async () => {
    // No ProjectionExpression here — "date" is a DynamoDB reserved word
    // and would need an ExpressionAttributeNames alias to project safely;
    // these rows are tiny, so just Scan the full items instead.
    const rows = await scanAll(DAILY_VIEWS_TABLE, "videoId = :v", { ":v": videoId });
    await Promise.all(
      rows.map((r) =>
        docClient.send(
          new DeleteCommand({ TableName: DAILY_VIEWS_TABLE, Key: { date: r.date, videoId } })
        )
      )
    );
  });

  // 11. The video row itself, last — everything above needed it (or its
  // id) to still exist while it ran.
  await safeDelete(errors, "video record", () =>
    docClient.send(new DeleteCommand({ TableName: VIDEOS_TABLE, Key: { videoId } }))
  );

  return { success: errors.length === 0, errors };
}

// Full real deletion of a user account: every video they uploaded (via
// deleteVideoCascade), everything else they own across the app, their
// active paid memberships (cancelled at Razorpay, not just deleted from
// our database, so nobody keeps getting charged for a membership to an
// account that no longer exists), their real InPlayer-Creator-Payouts /
// KYC documents, their username, their profile row, and finally their
// Cognito sign-in account itself so they can never sign back in.
//
// Two deliberate exceptions to "delete everything," both flagged to Reno
// before this was built:
//   - InPlayer-Revenue-Ledger rows are ANONYMIZED (subscriberId/creatorId
//     replaced with a "[deleted-user]" marker), not hard-deleted — these
//     are real Razorpay payment records; wiping them outright would
//     destroy an accounting/tax audit trail InPlayer may need to keep.
//     The money-flow numbers (amountInr, creatorShareInr, dates) stay
//     intact, just no longer tied to a specific identity.
//   - InPlayer-Conversations / InPlayer-Messages are left alone — see the
//     note above this file's table constants.
export async function deleteUserCascade(userId: string): Promise<CascadeResult> {
  const errors: string[] = [];

  const profile = await docClient.send(
    new GetCommand({ TableName: USERS_TABLE, Key: { userId } })
  );
  if (!profile.Item) {
    return { success: false, errors: ["User not found."] };
  }
  const usernameLower = profile.Item.usernameLower as string | undefined;

  // 1. Every video/Short they uploaded — full cascade per video (Mux
  // asset, comments, likes, everything deleteVideoCascade covers).
  // InPlayer-Videos has no index on uploaderId, so this is a full,
  // paginated Scan — the same tradeoff app/api/account/delete already
  // makes for the exact same lookup.
  await safeDelete(errors, "uploaded videos", async () => {
    const videos = await scanAll(
      VIDEOS_TABLE,
      "uploaderId = :u",
      { ":u": userId },
      "videoId"
    );
    for (const v of videos) {
      const result = await deleteVideoCascade(v.videoId as string);
      if (!result.success) errors.push(`video ${v.videoId}: ${result.errors.join(", ")}`);
    }
  });

  // 2. Their own comments on OTHER people's videos (Scan — userId isn't a
  // key on this table).
  await safeDelete(errors, "your comments elsewhere", async () => {
    const rows = await scanAll(
      COMMENTS_TABLE,
      "userId = :u",
      { ":u": userId },
      "videoId, commentId"
    );
    await Promise.all(
      rows.map((r) =>
        docClient.send(
          new DeleteCommand({
            TableName: COMMENTS_TABLE,
            Key: { videoId: r.videoId, commentId: r.commentId },
          })
        )
      )
    );
  });

  // 3. Their own likes (cheap Query — Likes PK is userId).
  await safeDelete(errors, "your likes", async () => {
    const rows = await queryAll(LIKES_TABLE, "userId = :u", { ":u": userId });
    await Promise.all(
      rows.map((r) =>
        docClient.send(
          new DeleteCommand({ TableName: LIKES_TABLE, Key: { userId, videoId: r.videoId } })
        )
      )
    );
  });

  // 4. Watch history, watchlist, downloads, playlists — all PK userId,
  // all cheap Queries.
  await safeDelete(errors, "watch history", async () => {
    const rows = await queryAll(WATCH_HISTORY_TABLE, "userId = :u", { ":u": userId });
    await Promise.all(
      rows.map((r) =>
        docClient.send(
          new DeleteCommand({ TableName: WATCH_HISTORY_TABLE, Key: { userId, videoId: r.videoId } })
        )
      )
    );
  });

  await safeDelete(errors, "watchlist", async () => {
    const rows = await queryAll(WATCHLIST_TABLE, "userId = :u", { ":u": userId });
    await Promise.all(
      rows.map((r) =>
        docClient.send(
          new DeleteCommand({ TableName: WATCHLIST_TABLE, Key: { userId, videoId: r.videoId } })
        )
      )
    );
  });

  await safeDelete(errors, "download records", async () => {
    const rows = await queryAll(DOWNLOADS_TABLE, "userId = :u", { ":u": userId });
    await Promise.all(
      rows.map((r) =>
        docClient.send(
          new DeleteCommand({ TableName: DOWNLOADS_TABLE, Key: { userId, videoId: r.videoId } })
        )
      )
    );
  });

  await safeDelete(errors, "playlists", async () => {
    const rows = await queryAll(PLAYLISTS_TABLE, "userId = :u", { ":u": userId });
    await Promise.all(
      rows.map((r) =>
        docClient.send(
          new DeleteCommand({ TableName: PLAYLISTS_TABLE, Key: { userId, playlistId: r.playlistId } })
        )
      )
    );
  });

  // 5. Notifications where they're the recipient (cheap Query).
  await safeDelete(errors, "notifications", async () => {
    const rows = await queryAll(NOTIFICATIONS_TABLE, "userId = :u", { ":u": userId });
    await Promise.all(
      rows.map((r) =>
        docClient.send(
          new DeleteCommand({
            TableName: NOTIFICATIONS_TABLE,
            Key: { userId, notificationId: r.notificationId },
          })
        )
      )
    );
  });

  // 6. Reports they filed (Scan — no index on reporterId).
  await safeDelete(errors, "reports you filed", async () => {
    const rows = await scanAll(REPORTS_TABLE, "reporterId = :u", { ":u": userId }, "reportId");
    await Promise.all(
      rows.map((r) =>
        docClient.send(new DeleteCommand({ TableName: REPORTS_TABLE, Key: { reportId: r.reportId } }))
      )
    );
  });

  // 7. Subscriptions — both directions: who they follow (Query on PK),
  // and who follows them (Query via the creatorId-index GSI).
  await safeDelete(errors, "who you followed", async () => {
    const rows = await queryAll(SUBSCRIPTIONS_TABLE, "subscriberId = :u", { ":u": userId });
    await Promise.all(
      rows.map((r) =>
        docClient.send(
          new DeleteCommand({
            TableName: SUBSCRIPTIONS_TABLE,
            Key: { subscriberId: userId, creatorId: r.creatorId },
          })
        )
      )
    );
  });

  await safeDelete(errors, "your followers", async () => {
    const rows = await queryAll(
      SUBSCRIPTIONS_TABLE,
      "creatorId = :u",
      { ":u": userId },
      "creatorId-index"
    );
    await Promise.all(
      rows.map((r) =>
        docClient.send(
          new DeleteCommand({
            TableName: SUBSCRIPTIONS_TABLE,
            Key: { subscriberId: r.subscriberId, creatorId: userId },
          })
        )
      )
    );
  });

  // 8. Paid memberships — both directions, with a real Razorpay
  // cancellation (not just a database row deletion) for anything still
  // active, so nobody keeps getting charged.
  await safeDelete(errors, "your own memberships", async () => {
    const rows = await queryAll(MEMBERSHIPS_TABLE, "subscriberId = :u", { ":u": userId });
    for (const r of rows) {
      if (
        (r.status === "active" || r.status === "created") &&
        typeof r.razorpaySubscriptionId === "string"
      ) {
        try {
          await cancelSubscription(r.razorpaySubscriptionId);
        } catch (err) {
          console.error(`cascadeDelete: Razorpay cancel failed for ${r.razorpaySubscriptionId}:`, err);
        }
      }
      await docClient.send(
        new DeleteCommand({
          TableName: MEMBERSHIPS_TABLE,
          Key: { subscriberId: userId, creatorId: r.creatorId },
        })
      );
    }
  });

  await safeDelete(errors, "your subscribers' memberships", async () => {
    // No GSI on creatorId here — full Scan (see cascadeDelete research
    // notes; this is the one real gap worth an index if this ever needs
    // to run at scale).
    const rows = await scanAll(MEMBERSHIPS_TABLE, "creatorId = :u", { ":u": userId });
    for (const r of rows) {
      if (
        (r.status === "active" || r.status === "created") &&
        typeof r.razorpaySubscriptionId === "string"
      ) {
        try {
          await cancelSubscription(r.razorpaySubscriptionId);
        } catch (err) {
          console.error(`cascadeDelete: Razorpay cancel failed for ${r.razorpaySubscriptionId}:`, err);
        }
      }
      await docClient.send(
        new DeleteCommand({
          TableName: MEMBERSHIPS_TABLE,
          Key: { subscriberId: r.subscriberId, creatorId: userId },
        })
      );
    }
  });

  // 9. Revenue ledger — ANONYMIZE, don't delete (see function doc comment
  // above). Scan both directions since razorpayPaymentId (the PK) has no
  // relation to either user id.
  await safeDelete(errors, "revenue ledger records", async () => {
    const asSubscriber = await scanAll(REVENUE_LEDGER_TABLE, "subscriberId = :u", { ":u": userId });
    const asCreator = await scanAll(REVENUE_LEDGER_TABLE, "creatorId = :u", { ":u": userId });
    const seen = new Set<string>();
    for (const r of [...asSubscriber, ...asCreator]) {
      const id = r.razorpayPaymentId as string;
      if (seen.has(id)) continue;
      seen.add(id);
      const sets: string[] = [];
      const values: Record<string, unknown> = { ":deleted": "[deleted-user]" };
      if (r.subscriberId === userId) sets.push("subscriberId = :deleted");
      if (r.creatorId === userId) sets.push("creatorId = :deleted");
      if (sets.length === 0) continue;
      await docClient.send(
        new UpdateCommand({
          TableName: REVENUE_LEDGER_TABLE,
          Key: { razorpayPaymentId: id },
          UpdateExpression: `SET ${sets.join(", ")}`,
          ExpressionAttributeValues: values,
        })
      );
    }
  });

  // 10. Real KYC documents (photos) — same purge pattern already used by
  // the admin review flow (app/api/admin/creators).
  await safeDelete(errors, "KYC documents", async () => {
    await Promise.all(
      KYC_DOC_TYPES.map((docType: KycDocType) =>
        docClient.send(
          new DeleteCommand({ TableName: KYC_DOCUMENTS_TABLE, Key: { userId, docType } })
        )
      )
    );
  });

  // 11. Payout/KYC status record (single item, PK userId).
  await safeDelete(errors, "payout record", () =>
    docClient.send(new DeleteCommand({ TableName: PAYOUTS_TABLE, Key: { userId } }))
  );

  // 12. Their own per-creator daily analytics snapshots (PK userId — safe
  // to Query-and-delete, this table is per-creator by design, never
  // shared across accounts).
  await safeDelete(errors, "channel analytics history", async () => {
    const rows = await queryAll(DAILY_STATS_TABLE, "userId = :u", { ":u": userId });
    await Promise.all(
      rows.map((r) =>
        docClient.send(
          new DeleteCommand({ TableName: DAILY_STATS_TABLE, Key: { userId, date: r.date } })
        )
      )
    );
  });

  // 13. Username reservation.
  if (usernameLower) {
    await safeDelete(errors, "username reservation", () =>
      docClient.send(new DeleteCommand({ TableName: USERNAMES_TABLE, Key: { usernameLower } }))
    );
  }

  // 14. The profile row itself.
  await safeDelete(errors, "profile record", () =>
    docClient.send(new DeleteCommand({ TableName: USERS_TABLE, Key: { userId } }))
  );

  // 15. The real Cognito sign-in account, last — once this is gone,
  // nothing above could have re-authenticated as this person anyway, and
  // doing it last means every real-money step (Razorpay cancellations)
  // and every data cleanup step above got a chance to run first even if
  // this one somehow fails.
  await safeDelete(errors, "Cognito sign-in account", () => deleteCognitoUser(userId));

  return { success: errors.length === 0, errors };
}
