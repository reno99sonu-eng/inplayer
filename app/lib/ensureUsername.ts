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

async function claimUsername(
  userId: string,
  username: string,
  usernameLower: string
): Promise<boolean> {
  try {
    await docClient.send(
      new PutCommand({
        TableName: USERNAMES_TABLE,
        Item: { usernameLower, username, userId },
        ConditionExpression: "attribute_not_exists(usernameLower)",
      })
    );

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

    return true;
  } catch (err) {
    const name = (err as { name?: string }).name;

    if (name === "ConditionalCheckFailedException") {
      return false;
    }

    throw err;
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

    const reservation = await docClient.send(
      new GetCommand({
        TableName: USERNAMES_TABLE,
        Key: { usernameLower },
      })
    );

    if (reservation.Item?.userId === userId) {
      return username;
    }

    if (!reservation.Item) {
      const claimed = await claimUsername(userId, username, usernameLower);

      if (claimed) {
        return username;
      }
    }
  }

  while (true) {
    const username = generateUsername();
    const usernameLower = normalizeUsername(username);

    if (isReservedUsername(usernameLower)) {
      continue;
    }

    const claimed = await claimUsername(userId, username, usernameLower);

    if (claimed) {
      return username;
    }
  }
}
