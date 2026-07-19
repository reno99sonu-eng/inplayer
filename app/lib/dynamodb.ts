import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

// The base AWS client, using the IAM user's keys from .env.local.
const rawClient = new DynamoDBClient({
  region: process.env.AWS_REGION || "ap-southeast-2",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

// The "Document Client" wraps the raw client so our code can write
// plain JS objects (e.g. { title: "My Video" }) instead of DynamoDB's
// more verbose native format. Every API route imports this shared
// instance rather than creating its own.
export const docClient = DynamoDBDocumentClient.from(rawClient);