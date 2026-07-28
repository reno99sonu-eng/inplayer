import { GetCommand, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import {
  normalizeUsername,
  isReservedUsername,
  isValidUsernameFormat,
} from "@/app/lib/username";

const USERS_TABLE = "InPlayer-Users";
const USERNAMES_TABLE = "InPlayer-Usernames";

function generateUsername() {
  return `user${Math.floor(100000 + Math.random() * 900000)}`;
}

async function tryReserveUsername(
  userId: string,
  username: string,
  usernameLower: string
): Promise<void> {
  try {
    await docClient.send(
      new PutCommand({
        TableName: USERNAMES_TABLE,
        Item: { usernameLower, username, userId },
        ConditionExpression: "attribute_not_exists(usernameLower)",
      })
    );
  } catch (err) {
    // Table may not exist, or missing permissions — log but don't fail
    console.warn(`Failed to reserve username ${username} for user ${userId}:`, err);
  }
}

export async function ensureUsername(userId: string) {
  const existing = await docClient.send(
    new GetCommand({
      TableName: USERS_TABLE,
      Key: { userId },
    })
  );

  const storedUsername = existing.Item?.username;
  if (
    typeof storedUsername === "string" &&
    isValidUsernameFormat(storedUsername) &&
    !isReservedUsername(normalizeUsername(storedUsername))
  ) {
    const username = storedUsername.trim();
    const usernameLower = normalizeUsername(username);

    // resolveUsernames.ts calls ensureUsername for every uploader shown on
    // every page load (by design, so older rows self-heal). Once a row is
    // already healed — usernameLower matches — re-running the write below
    // is a no-op that costs a real DynamoDB write every single time, and
    // tryReserveUsername's ConditionExpression is *designed* to fail once
    // the reservation exists, so it was flooding the logs with a
    // ConditionalCheckFailedException on nearly every request. Only touch
    // the DB when something is actually missing.
    if (existing.Item?.usernameLower !== usernameLower) {
      await docClient.send(
        new UpdateCommand({
          TableName: USERS_TABLE,
          Key: { userId },
          UpdateExpression:
            "SET usernameLower = :usernameLower, updatedAt = :updatedAt",
          ExpressionAttributeValues: {
            ":usernameLower": usernameLower,
            ":updatedAt": new Date().toISOString(),
          },
        })
      );

      await tryReserveUsername(userId, username, usernameLower);
    }

    return username;
  }

  const username = generateUsername();
  const usernameLower = normalizeUsername(username);

  await docClient.send(
    new UpdateCommand({
      TableName: USERS_TABLE,
      Key: { userId },
      UpdateExpression:
        "SET username = :username, usernameLower = :usernameLower, updatedAt = :updatedAt",
      ExpressionAttributeValues: {
        ":username": username,
        ":usernameLower": usernameLower,
        ":updatedAt": new Date().toISOString(),
      },
    })
  );

  await tryReserveUsername(userId, username, usernameLower);

  return username;
}
