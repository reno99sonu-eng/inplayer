import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

let client: DynamoDBDocumentClient | null = null;

export function getDocClient() {
  if (!client) {
    const rawClient = new DynamoDBClient({
      region: process.env.AWS_REGION || "ap-south-1",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "",
      },
    });

    client = DynamoDBDocumentClient.from(rawClient);
  }

  return client;
}

export const docClient = getDocClient();

export const MONETIZATION_CONFIG_HISTORY_TABLE = "InPlayer-Monetization-Config-History";
export const CREATOR_EARNINGS_TABLE = "InPlayer-Creator-Earnings";