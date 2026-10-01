// The browser-side half of app/lib/sessions.ts — remembers which
// InPlayer-Sessions row belongs to THIS device/tab, so Settings > Privacy
// can show "This device" next to the right one, and every subsequent
// authedFetch() call (see app/lib/apiFetch.ts) can identify itself so a
// "Log out this device" click elsewhere actually takes effect here.
const STORAGE_KEY = "inplayer-session-id";

export function getStoredSessionId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function setStoredSessionId(sessionId: string) {
  try {
    localStorage.setItem(STORAGE_KEY, sessionId);
  } catch {
    /* private mode — nothing to fall back to, "This device" just won't highlight */
  }
}

export function clearStoredSessionId() {
  lastRegisteredToken = null;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

// One sign-in can trigger several registrations: the Hub "signedIn" and
// "signInWithRedirect" events AND the sign-in form's onSuccess each call
// refreshUser({ isFreshSignIn: true }). Each used to create its own row, so
// one login used two of the five device slots and evicted this account's
// other browsers twice as fast. Calls for the same token share one request,
// and a repeat right after it finished is skipped.
let inFlight: { idToken: string; promise: Promise<void> } | null = null;
let lastRegisteredToken: string | null = null;

// Called exactly once per real fresh sign-in (see AuthProvider.tsx's
// isFreshSignIn gate) — never on a passive page-load session restore, so
// reloading or navigating around the site never registers duplicate rows
// for the same login. Deliberately doesn't use authedFetch() (which would
// be circular — it needs this file's own getStoredSessionId()); this is
// the one call site allowed to build its own Authorization header.
export async function registerCurrentSession(idToken: string): Promise<void> {
  if (lastRegisteredToken === idToken && getStoredSessionId()) return;
  if (inFlight && inFlight.idToken === idToken) return inFlight.promise;
  // A genuinely new sign-in: drop any id left over from an earlier session
  // NOW (synchronously, before React re-renders), so nothing sent in the
  // meantime carries a stale id the server no longer recognises. Without
  // an id the per-device check is skipped; the new one is stored below.
  clearStoredSessionId();

  const promise = (async () => {
    try {
      const res = await fetch("/api/sessions/register", {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      // Only store an id the server actually recorded — an unrecorded one
      // gets every later request rejected as "signed out of this device".
      if (data.sessionId && !data.tableMissing) {
        setStoredSessionId(data.sessionId);
        lastRegisteredToken = idToken;
      }
    } catch (err) {
      console.error("registerCurrentSession failed (non-fatal):", err);
    }
  })();
  inFlight = { idToken, promise };
  try {
    await promise;
  } finally {
    if (inFlight?.promise === promise) inFlight = null;
  }
}

// Best-effort — clears this device's own row when it deliberately signs
// out, so it doesn't keep showing as "logged in" in Settings > Privacy
// after the person already signed out of it. Never blocks the actual
// sign-out if this fails.
export async function revokeCurrentSessionBestEffort(idToken: string | null): Promise<void> {
  const sessionId = getStoredSessionId();
  if (!sessionId || !idToken) {
    clearStoredSessionId();
    return;
  }
  try {
    await fetch(`/api/sessions/${sessionId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${idToken}` },
    });
  } catch (err) {
    console.error("revokeCurrentSessionBestEffort failed (non-fatal):", err);
  } finally {
    clearStoredSessionId();
  }
}
