import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import { MEMBERSHIPS_TABLE } from "@/app/lib/creatorPayouts";

// Real, server-side membership checks — reused anywhere the app needs to
// know "is this viewer an active paid member of this creator" (watch page
// gating/resolution perks, the supporter badge in comments, etc.). Only
// status === "active" ever counts — see app/api/webhooks/razorpay, the
// sole place that ever sets that value once a real payment lands.

export async function isActiveMember(subscriberId: string, creatorId: string): Promise<boolean> {
  if (!subscriberId || !creatorId || subscriberId === creatorId) return false;
  try {
    const result = await docClient.send(
      new GetCommand({
        TableName: MEMBERSHIPS_TABLE,
        Key: { subscriberId, creatorId },
      })
    );
    return result.Item?.status === "active";
  } catch (err) {
    console.error("isActiveMember: lookup failed:", err);
    return false;
  }
}

// Batched version of the same check for a list of candidate subscribers
// against one creator (e.g. every distinct commenter on one of that
// creator's videos) — one parallel GetCommand per distinct id, same idiom
// as app/lib/resolveUsernames.ts. Returns the subset that are real, active
// members; anyone not in the returned set should be treated as a
// non-member (fails closed on lookup errors, unlike resolveUsernames —
// this gates a real paid perk, not just a display link).
export async function resolveActiveMemberIds(
  creatorId: string,
  subscriberIds: (string | null | undefined)[]
): Promise<Set<string>> {
  const distinctIds = Array.from(
    new Set(subscriberIds.filter((id): id is string => !!id && id !== creatorId))
  );

  const activeIds = new Set<string>();
  if (distinctIds.length === 0) return activeIds;

  await Promise.all(
    distinctIds.map(async (subscriberId) => {
      if (await isActiveMember(subscriberId, creatorId)) {
        activeIds.add(subscriberId);
      }
    })
  );

  return activeIds;
}
