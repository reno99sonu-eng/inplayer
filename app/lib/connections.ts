import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";

// Two users are "connected" when they subscribe to each other — a mutual
// In-Family relationship. This is the one real reciprocal relationship
// InPlayer already has (see InPlayer-Subscriptions); rather than inventing
// a separate "friends" system, username privacy's "only connected people"
// mode and messaging's request-bypass both reuse this exact definition so
// the two features can never disagree about what "connected" means.
export async function areUsersConnected(userIdA: string, userIdB: string): Promise<boolean> {
  if (userIdA === userIdB) return true;

  try {
    const [aFollowsB, bFollowsA] = await Promise.all([
      docClient.send(
        new GetCommand({
          TableName: "InPlayer-Subscriptions",
          Key: { subscriberId: userIdA, creatorId: userIdB },
        })
      ),
      docClient.send(
        new GetCommand({
          TableName: "InPlayer-Subscriptions",
          Key: { subscriberId: userIdB, creatorId: userIdA },
        })
      ),
    ]);

    return !!aFollowsB.Item && !!bFollowsA.Item;
  } catch (err) {
    console.error("Failed to check connection status:", err);
    return false;
  }
}
