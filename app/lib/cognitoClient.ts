import {
  CognitoIdentityProviderClient,
  ListUsersCommand,
  AdminDeleteUserCommand,
} from "@aws-sdk/client-cognito-identity-provider";

let client: CognitoIdentityProviderClient | null = null;

export function getCognitoClient() {
  if (!client) {
    client = new CognitoIdentityProviderClient({
      region: process.env.AWS_REGION || "ap-south-1",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "",
      },
    });
  }

  return client;
}

export const cognitoClient = getCognitoClient();

// Must match the userPoolId hardcoded in app/lib/verifyAuth.ts — same User
// Pool, just a different SDK (Cognito Identity Provider admin actions
// instead of JWT verification).
export const COGNITO_USER_POOL_ID = "ap-south-1_OrIhWadFN";

// The ONLY place InPlayer stores real email addresses — InPlayer-Users in
// DynamoDB deliberately never gets one (see app/api/admin/users/route.ts).
// Looks up a batch of userIds (Cognito "sub", same id used as the
// DynamoDB partition key everywhere else in this app) by running one
// ListUsers call per id (filtered by sub) in parallel — Cognito has no
// bulk "get many users by sub" API. Whatever can't be resolved (an id
// that's been deleted from Cognito directly, a transient error, etc.) is
// just omitted from the result, never thrown — an admin list should still
// render with partial data rather than fail outright.
export async function resolveCognitoEmails(
  userIds: string[]
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const unique = Array.from(new Set(userIds.filter(Boolean)));

  await Promise.all(
    unique.map(async (userId) => {
      try {
        const res = await cognitoClient.send(
          new ListUsersCommand({
            UserPoolId: COGNITO_USER_POOL_ID,
            Filter: `sub = "${userId}"`,
            Limit: 1,
          })
        );
        const email = res.Users?.[0]?.Attributes?.find(
          (a) => a.Name === "email"
        )?.Value;
        if (email) result.set(userId, email);
      } catch (err) {
        console.error(`resolveCognitoEmails: lookup failed for ${userId}:`, err);
      }
    })
  );

  return result;
}

// Real, permanent removal from Cognito — the account can never sign in
// again after this (unlike suspend, which only blocks app-side actions
// while the Cognito account itself stays intact). Used by the real
// cascading "Delete user" admin action — see app/api/admin/users/[userId]
// DELETE. Looks the userId up via the same sub-filter approach above
// first, since AdminDeleteUser needs Cognito's own Username value (which,
// for a Google-linked account, is a provider-prefixed string like
// "google_1234567890", NOT the sub and NOT necessarily the email).
export async function deleteCognitoUser(userId: string): Promise<void> {
  const res = await cognitoClient.send(
    new ListUsersCommand({
      UserPoolId: COGNITO_USER_POOL_ID,
      Filter: `sub = "${userId}"`,
      Limit: 1,
    })
  );
  const cognitoUsername = res.Users?.[0]?.Username;
  if (!cognitoUsername) {
    // Already gone from Cognito (or never existed there) — nothing to do.
    return;
  }

  await cognitoClient.send(
    new AdminDeleteUserCommand({
      UserPoolId: COGNITO_USER_POOL_ID,
      Username: cognitoUsername,
    })
  );
}
