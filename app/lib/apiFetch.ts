import { fetchAuthSession } from "aws-amplify/auth";
import { getStoredSessionId } from "@/app/lib/sessionClient";

// The one shared "call an authenticated InPlayer API route" helper —
// attaches both the real Cognito ID token (Authorization) and this
// device's own session id (X-Session-Id, see app/lib/sessionClient.ts and
// app/lib/sessions.ts) so a "Log out this device" click in Settings >
// Privacy (or an admin forcing a device to log out) actually takes effect
// on this device's very next call through here — not just a label change
// in some list. Throws with a friendly message if there's no signed-in
// session at all, exactly like every page's previous hand-rolled version
// of this function did.
export async function authedFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const session = await fetchAuthSession();
  const idToken = session.tokens?.idToken?.toString();
  if (!idToken) throw new Error("Session expired — please sign in again.");

  const sessionId = getStoredSessionId();

  return fetch(path, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${idToken}`,
      ...(sessionId ? { "X-Session-Id": sessionId } : {}),
    },
  });
}
