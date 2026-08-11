import { BatchGetCommand } from "@aws-sdk/lib-dynamodb";
import { ensureUsername } from "@/app/lib/ensureUsername";
import { docClient } from "@/app/lib/dynamodb";
import { isReservedUsername, isValidUsernameFormat, normalizeUsername } from "@/app/lib/username";

const USERS_TABLE = "InPlayer-Users";

// Shared userId -> username resolver, used by every read path that needs
// to turn an uploaderId/userId into a real profile link (/u/[username]):
// the watch page's channel card, the Shorts feed, and comments. One
// GetCommand per *distinct* userId run in parallel — the same "parallel
// GetCommand" idiom already used by app/api/subscriptions/list/route.ts
// and app/lib/userSearch.ts. There's no secondary index that would let
// this be a single Query, and the batches here are small (one page of
// videos/shorts/comments at a time), so this is fine at today's scale.
//
// A userId whose profile is missing or has no username yet (e.g. a
// deleted account, or a row that predates usernames) is simply left out
// of the returned Map — same "skip rather than render a broken entry"
// convention as app/api/subscriptions/list/route.ts. Callers should treat
// a missing map entry as "no profile link available" and fall back to
// plain, non-linked rendering rather than throw.
export async function resolveUsernames(
  userIds: (string | null | undefined)[]
): Promise<Map<string, string>> {
  const distinctIds = Array.from(
    new Set(userIds.filter((id): id is string => !!id))
  );

  const map = new Map<string, string>();
  if (distinctIds.length === 0) return map;

  // Keep ensureUsername only as a legacy repair fallback for rows that
  // genuinely do not have a usable username yet. Healthy profile reads no
  // longer perform any write or one-request-per-creator lookup.
  const unresolved = new Set(distinctIds);
  for (let index = 0; index < distinctIds.length; index += 100) {
    const keys = distinctIds.slice(index, index + 100).map((userId) => ({ userId }));
    try {
      let pendingKeys = keys;
      do {
        const result = await docClient.send(
          new BatchGetCommand({
            RequestItems: {
              [USERS_TABLE]: {
                Keys: pendingKeys,
                ProjectionExpression: "userId, username",
              },
            },
          })
        );
        for (const item of result.Responses?.[USERS_TABLE] || []) {
          const userId = item.userId;
          const username = item.username;
          if (
            typeof userId === "string" &&
            typeof username === "string" &&
            isValidUsernameFormat(username) &&
            !isReservedUsername(normalizeUsername(username))
          ) {
            map.set(userId, username.trim());
            unresolved.delete(userId);
          }
        }
        pendingKeys = (result.UnprocessedKeys?.[USERS_TABLE]?.Keys || []) as { userId: string }[];
      } while (pendingKeys.length > 0);
    } catch (err) {
      console.error("Failed to batch-resolve uploader usernames:", err);
    }
  }

  await Promise.all(
    [...unresolved].map(async (userId) => {
      try {
        // Always pass through ensureUsername, rather than only when the
        // profile field is absent. Older rows may have a username but no
        // corresponding InPlayer-Usernames reservation, which made their
        // otherwise valid /u/[username] links return 404.
        const username = await ensureUsername(userId);

        if (username) {
          map.set(userId, username);
        } else {
          console.warn(`ensureUsername returned null for userId ${userId}`);
        }
      } catch (err) {
        // A single bad lookup shouldn't take down the whole page — skip
        // it and let the caller fall back to non-linked rendering.
        console.error(`Failed to resolve username for userId ${userId}:`, err);
      }
    })
  );

  return map;
}
