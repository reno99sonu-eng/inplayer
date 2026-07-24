import { GetCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import {
  normalizeUsername,
  isReservedUsername,
} from "@/app/lib/username";

const USERS_TABLE = "InPlayer-Users";
const USERNAMES_TABLE = "InPlayer-Usernames";

function generateUsername() {
  return `user${Math.floor(100000 + Math.random() * 900000)}`;
}

export async function ensureUsername(userId: string) {
  const existing = await docClient.send(
    new GetCommand({
      TableName: USERS_TABLE,
      Key: { userId },
    })
  );

  if (existing.Item?.username) {
    return existing.Item.username as string;
  }

  while (true) {
    const username = generateUsername();
    const usernameLower = normalizeUsername(username);

    if (isReservedUsername(usernameLower)) {
      continue;
    }

    try {
      await docClient.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Put: {
                TableName: USERNAMES_TABLE,
                Item: {
                  usernameLower,
                  username,
                  userId,
                },
                ConditionExpression:
                  "attribute_not_exists(usernameLower)",
              },
            },
            {
              Update: {
                TableName: USERS_TABLE,
                Key: { userId },
                UpdateExpression:
                  "SET username = :username, usernameLower = :usernameLower, updatedAt = :updatedAt",
                ExpressionAttributeValues: {
                  ":username": username,
                  ":usernameLower": usernameLower,
                  ":updatedAt": new Date().toISOString(),
                },
              },
            },
          ],
        })
      );

      return username;
    } catch (err) {
      const name = (err as { name?: string }).name;

      if (name === "TransactionCanceledException") {
        continue;
      }

      throw err;
    }
  }
}