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
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

// Called exactly once per real fresh sign-in (see AuthProvider.tsx's
// isFreshSignIn gate) — never on a passive page-load session restore, so
// reloading or navigating around the site never registers duplicate rows
// for the same login. Deliberately doesn't use authedFetch() (which would
// be circular — it needs this file's own getStoredSessionId()); this is
// the one call site allowed to build its own Authorization header.
export async function registerCurrentSession(idToken: string): Promise<void> {
  try {
    const res = await fetch("/api/sessions/register", {
      method: "POST",
      headers: { Authorization: `Bearer ${idToken}` },
    });
    if (!res.ok) return;
    const data = await res.json();
    if (data.sessionId) setStoredSessionId(data.sessionId);
  } catch (err) {
    console.error("registerCurrentSession failed (non-fatal):", err);
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
