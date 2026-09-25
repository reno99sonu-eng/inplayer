import { getApps, initializeApp, cert, type App } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { PutCommand, DeleteCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";

// PK userId, SK token — a user can have more than one device, each with
// its own token; a push fans out to every row for that userId. Reno
// creates this by hand in the AWS DynamoDB console, same tableMissing-
// tolerant convention as every other table in this codebase (see
// app/lib/sessions.ts) — every function below fails soft instead of
// 500ing the action that triggered it while that hasn't happened yet.
const PUSH_TOKENS_TABLE = "InPlayer-Push-Tokens";

let cachedApp: App | null = null;

// The three pieces of the Firebase service-account key, held as separate
// env vars rather than one JSON blob — simpler to set correctly in Vercel,
// and avoids the private key's literal newlines needing JSON-escaping
// inside an env var's own value. Returns null (never throws) when they
// aren't set yet, so every caller below can fail open exactly like every
// other optional integration already does in this codebase (OPENAI_API_KEY,
// GROQ_API_KEY, etc.) — a push simply doesn't go out, nothing else breaks.
function getFirebaseApp(): App | null {
  if (cachedApp) return cachedApp;
  if (getApps().length > 0) {
    cachedApp = getApps()[0]!;
    return cachedApp;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  // Vercel (and most .env tooling) can't hold a literal newline inside a
  // single-line env var value — the key is stored with escaped "\n"
  // sequences and unescaped back into real newlines here.
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) return null;

  try {
    cachedApp = initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
    return cachedApp;
  } catch (err) {
    console.error("Failed to initialize Firebase Admin:", err);
    return null;
  }
}

export async function registerPushToken(
  userId: string,
  token: string,
  platform: string
): Promise<void> {
  try {
    await docClient.send(
      new PutCommand({
        TableName: PUSH_TOKENS_TABLE,
        Item: { userId, token, platform, updatedAt: new Date().toISOString() },
      })
    );
  } catch (err) {
    console.error("Failed to register push token (table may not exist yet):", err);
  }
}

export async function unregisterPushToken(userId: string, token: string): Promise<void> {
  try {
    await docClient.send(
      new DeleteCommand({ TableName: PUSH_TOKENS_TABLE, Key: { userId, token } })
    );
  } catch (err) {
    console.error("Failed to unregister push token:", err);
  }
}

// Fans a notification out to every device this user has registered.
// Deliberately the SAME title/body a caller would put in an in-app
// notification's `message` — this is meant to mirror what already shows
// up in the bell icon, not a separate, differently-worded channel.
//
// Fails open at every step: not configured yet, the token table isn't
// provisioned yet, or the send itself errors — none of that should ever
// surface as a broken like/comment/subscribe/etc. to the person who
// triggered it. Every call site below already wraps its own notification
// write in its own try/catch for exactly this reason; this function holds
// itself to the same standard on its own.
export async function sendPushToUser(input: {
  userId: string;
  title: string;
  body: string;
}): Promise<void> {
  const app = getFirebaseApp();
  if (!app) return;

  try {
    const result = await docClient.send(
      new QueryCommand({
        TableName: PUSH_TOKENS_TABLE,
        KeyConditionExpression: "userId = :userId",
        ExpressionAttributeValues: { ":userId": input.userId },
      })
    );
    const tokens = (result.Items || [])
      .map((item) => item.token as string)
      .filter((t): t is string => typeof t === "string" && t.length > 0);
    if (tokens.length === 0) return;

    const response = await getMessaging(app).sendEachForMulticast({
      tokens,
      notification: { title: input.title, body: input.body },
    });

    // A token Firebase itself reports as dead (app uninstalled, data
    // cleared, token revoked) will never succeed again — remove it now
    // rather than paying for a doomed send to it on every future
    // notification for this user.
    const deadTokens = response.responses
      .map((r, i) =>
        !r.success &&
        (r.error?.code === "messaging/registration-token-not-registered" ||
          r.error?.code === "messaging/invalid-registration-token")
          ? tokens[i]
          : null
      )
      .filter((t): t is string => t !== null);
    if (deadTokens.length > 0) {
      await Promise.all(deadTokens.map((token) => unregisterPushToken(input.userId, token)));
    }
  } catch (err) {
    console.error("Failed to send push notification:", err);
  }
}
