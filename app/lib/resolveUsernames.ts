import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import { ensureUsername } from "@/app/lib/ensureUsername";

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

  await Promise.all(
    distinctIds.map(async (userId) => {
      try {
        const result = await docClient.send(
          new GetCommand({
            TableName: "InPlayer-Users",
            Key: { userId },
          })
        );
        let username = result.Item?.username as string | undefined;

if (!username) {
  await ensureUsername(userId);

  const refreshed = await docClient.send(
    new GetCommand({
      TableName: "InPlayer-Users",
      Key: { userId },
    })
  );

  username = refreshed.Item?.username as string | undefined;
}

if (username) {
  map.set(userId, username);
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
