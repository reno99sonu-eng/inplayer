import { fetchAuthSession } from "aws-amplify/auth";
import { getStoredSessionId } from "@/app/lib/sessionClient";

// The shared "call an authenticated InPlayer API route" helper.
// Attaches Cognito ID token (Authorization) and session id (X-Session-Id).
// GUARANTEE: Never throws uncaught exceptions. If unauthenticated or token
// is missing/refreshing, returns an HTTP 401 Response object so components
// handle errors in-place without crashing the React component tree into
// Next.js Error Boundaries.
export async function authedFetch(path: string, options: RequestInit = {}): Promise<Response> {
  try {
    let session = await fetchAuthSession().catch(() => null);
    let idToken = session?.tokens?.idToken?.toString();

    if (!idToken) {
      // Retry with forceRefresh once if initial session fetch returned no token
      session = await fetchAuthSession({ forceRefresh: true }).catch(() => null);
      idToken = session?.tokens?.idToken?.toString();
    }

    if (!idToken) {
      return new Response(
        JSON.stringify({ error: "Session expired — please sign in again." }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const sessionId = getStoredSessionId();
    const isAdminRoute = path.startsWith("/api/admin/") || path.startsWith("/api/admin");

    let res = await fetch(path, {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: `Bearer ${idToken}`,
        ...(!isAdminRoute && sessionId ? { "X-Session-Id": sessionId } : {}),
      },
    });

    // If the server rejected with 401, the Cognito token may have expired mid-session
    // or a stale X-Session-Id might have caused a false revocation. Clear stored session
    // and force a fresh session refresh, retrying without X-Session-Id.
    if (res.status === 401) {
      try {
        localStorage.removeItem("inplayer-session-id");
      } catch {
        /* ignore */
      }

      const freshSession = await fetchAuthSession({ forceRefresh: true }).catch(() => null);
      const freshToken = freshSession?.tokens?.idToken?.toString() || idToken;

      res = await fetch(path, {
        ...options,
        headers: {
          ...(options.headers || {}),
          Authorization: `Bearer ${freshToken}`,
        },
      });
    }

    return res;
  } catch (err) {
    console.error("authedFetch error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Network error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
