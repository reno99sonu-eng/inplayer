import { CognitoJwtVerifier } from "aws-jwt-verify";
import { NextRequest } from "next/server";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";

// These match the values in amplify-config.ts — same User Pool, same
// App Client, just verified here on the server instead of trusted
// blindly from the browser.
const verifier = CognitoJwtVerifier.create({
  userPoolId: "ap-south-1_OrIhWadFN",
  tokenUse: "id",
  clientId: "1ckejhd5mp3oohgsfuqseeda5t",
});

export interface VerifiedUser {
  userId: string;
  email?: string;
  name?: string;
}

// Every call site that catches verifyAuth() rejecting a request already
// treats it as "not signed in" (401) — this reuses that exact same path
// for a suspended account, so Admin Panel -> Users -> Suspend genuinely
// blocks every signed-in action (uploading, liking, commenting,
// messaging, etc.) sitewide the moment it's flipped on, with no changes
// needed anywhere else.
const SUSPENDED_MESSAGE = "Account suspended";

// Call this at the top of any API route that should only work for
// signed-in users (uploading, liking, commenting, etc.). It expects
// the browser to send the current Cognito ID token in the
// Authorization header as "Bearer <token>". Throws if missing, invalid,
// or the account is suspended — callers should catch this and respond
// with 401.
export async function verifyAuth(request: NextRequest): Promise<VerifiedUser> {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "").trim();

  if (!token) {
    throw new Error("Missing authorization token");
  }

  const payload = await verifier.verify(token);
  const userId = payload.sub;

  // Fails OPEN on any lookup problem (missing row, a transient DynamoDB
  // error, etc.) — only an explicit isSuspended: true on the account's own
  // row blocks it. This is deliberate: a bug or blip in this one check must
  // never be able to take down sign-in-gated actions for every user on the
  // site, only the one row an admin actually suspended.
  try {
    const result = await docClient.send(
      new GetCommand({
        TableName: "InPlayer-Users",
        Key: { userId },
        ProjectionExpression: "isSuspended",
      })
    );
    if (result.Item?.isSuspended === true) {
      throw new Error(SUSPENDED_MESSAGE);
    }
  } catch (err) {
    if (err instanceof Error && err.message === SUSPENDED_MESSAGE) throw err;
    console.error("verifyAuth: suspension check failed, failing open:", err);
  }

  return {
    userId,
    email: typeof payload.email === "string" ? payload.email : undefined,
    name: typeof payload.name === "string" ? payload.name : undefined,
  };
}