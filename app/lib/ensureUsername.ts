import { GetCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
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

    // Some accounts were created before the username lookup table was
    // consistently populated. A channel route resolves handles through that
    // table, so make the profile field and its reservation agree before a
    // caller emits a /u/[username] link.
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
      try {
        await docClient.send(
          new TransactWriteCommand({
            TransactItems: [
              {
                Put: {
                  TableName: USERNAMES_TABLE,
                  Item: { usernameLower, username, userId },
                  ConditionExpression: "attribute_not_exists(usernameLower)",
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
        // A competing claim won between the read and transaction. Fall
        // through to a generated, available handle instead of returning a
        // channel URL that belongs to somebody else.
        if ((err as { name?: string }).name !== "TransactionCanceledException") {
          throw err;
        }
      }
    }
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
