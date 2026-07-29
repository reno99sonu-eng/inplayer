import { CognitoJwtVerifier } from "aws-jwt-verify";
import { NextRequest } from "next/server";

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

// Call this at the top of any API route that should only work for
// signed-in users (uploading, liking, commenting, etc.). It expects
// the browser to send the current Cognito ID token in the
// Authorization header as "Bearer <token>". Throws if missing or
// invalid — callers should catch this and respond with 401.
export async function verifyAuth(request: NextRequest): Promise<VerifiedUser> {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "").trim();

  if (!token) {
    throw new Error("Missing authorization token");
  }

  const payload = await verifier.verify(token);

  return {
    userId: payload.sub,
    email: typeof payload.email === "string" ? payload.email : undefined,
    name: typeof payload.name === "string" ? payload.name : undefined,
  };
}