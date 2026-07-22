import { ScanCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import { normalizeUsername } from "@/app/lib/username";

export interface UserSearchResult {
  userId: string;
  username: string;
  avatarUrl: string | null;
}

// InPlayer-Usernames has no secondary index for substring search — this
// Scans the (expected-small) username-lookup table and filters in memory.
// Matches this codebase's existing precedent for lookups that don't fit a
// primary key (see InPlayer-Videos' muxAssetId Scan in the Mux webhook) —
// fine at today's scale, but would want a real search index (e.g.
// OpenSearch) if the user base gets large. Fails open to an empty list if
// the table doesn't exist yet, same as every other "new table" route in
// this codebase.
export async function searchUsersByUsername(
  query: string,
  limit = 15
): Promise<UserSearchResult[]> {
  const q = normalizeUsername(query);
  if (!q) return [];

  try {
    const matches: { userId: string; username: string }[] = [];
    let exclusiveStartKey: Record<string, unknown> | undefined;

    do {
      const result = await docClient.send(
        new ScanCommand({
          TableName: "InPlayer-Usernames",
          FilterExpression: "contains(usernameLower, :q)",
          ExpressionAttributeValues: { ":q": q },
          ExclusiveStartKey: exclusiveStartKey,
        })
      );
      for (const item of result.Items || []) {
        matches.push({ userId: item.userId, username: item.username });
      }
      exclusiveStartKey = result.LastEvaluatedKey;
      // Cap how much of the table we're willing to walk per request —
      // this is a "search as you type" endpoint, not a report.
    } while (exclusiveStartKey && matches.length < limit * 4);

    const top = matches
      // Prefer usernames that start with the query over ones that merely
      // contain it, then shorter (closer) matches.
      .sort((a, b) => {
        const aStarts = a.username.toLowerCase().startsWith(q) ? 0 : 1;
        const bStarts = b.username.toLowerCase().startsWith(q) ? 0 : 1;
        if (aStarts !== bStarts) return aStarts - bStarts;
        return a.username.length - b.username.length;
      })
      .slice(0, limit);

    if (top.length === 0) return [];

    const withAvatars = await Promise.all(
      top.map(async (u) => {
        try {
          const userResult = await docClient.send(
            new GetCommand({ TableName: "InPlayer-Users", Key: { userId: u.userId } })
          );
          return { ...u, avatarUrl: (userResult.Item?.avatarUrl as string) || null };
        } catch {
          return { ...u, avatarUrl: null };
        }
      })
    );

    return withAvatars;
  } catch (err) {
    console.error("User search unavailable (table may not exist yet):", err);
    return [];
  }
}
