"use client";

// Runs Amplify.configure() as a side effect of this import — this MUST
// happen before any sign-in/sign-up/etc. calls, otherwise Amplify throws
// "Auth UserPool not configured."
import "@/app/amplify-config";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  getCurrentUser,
  fetchUserAttributes,
  fetchAuthSession,
  signOut as amplifySignOut,
  deleteUser,
} from "aws-amplify/auth";
import { Hub } from "aws-amplify/utils";
import { authedFetch } from "@/app/lib/apiFetch";
import { registerCurrentSession, revokeCurrentSessionBestEffort } from "@/app/lib/sessionClient";

import SignInModal from "./SignInModal";
import SignUpModal from "./SignUpModal";
import ForgotPasswordModal from "./ForgotPasswordModal";
import VerifyEmailModal from "./VerifyEmailModal";
import AgeRequiredModal from "./AgeRequiredModal";
import TermsAcceptanceModal from "./TermsAcceptanceModal";

// ROOT CAUSE of "Google sign-in completes but the site never shows me as
// signed in": Amplify checks whether the page just came back from an OAuth
// redirect (a "?code=..." from Google/Cognito) as a direct side effect of
// Amplify.configure() — which runs the INSTANT the "@/app/amplify-config"
// import above is evaluated, before React has mounted a single component.
// That check finishes async (one microtask hop) and fires a Hub "auth"
// event the moment it resolves — which happens before React finishes its
// first render and runs any component's useEffect. The old code
// registered Hub.listen() inside a useEffect, so it subscribed too late:
// the event had already fired into an empty room and was gone for good.
// Amplify itself still cached the tokens correctly (that part doesn't
// depend on Hub) — the app just never found out, so the UI kept showing
// "Sign In" no matter what.
//
// Fix: subscribe here, at module scope, so it runs synchronously while
// the module loads — before the JS engine ever yields to the microtask
// queue where Amplify's async check resumes. Nothing can beat this to the
// punch. Whatever arrives before a component has mounted to consume it
// gets queued; the next AuthProvider to mount drains it immediately.
type AuthPayload = { event: string; data?: unknown };
let queuedAuthEvent: AuthPayload | null = null;
let liveAuthHandler: ((payload: AuthPayload) => void) | null = null;

Hub.listen("auth", ({ payload }) => {
  if (liveAuthHandler) {
    liveAuthHandler(payload);
  } else {
    queuedAuthEvent = payload;
  }
});

type AuthModal =
  | null
  | "signin"
  | "signup"
  | "forgot"
  | "verify";

export interface SocialLinks {
  social: Record<string, string>;
  other: { label: string; url: string }[];
}

export type UsernamePrivacy = "public" | "private" | "connections";

export interface AuthUser {
  userId: string;
  // Cognito's own login identifier (set to the signup email) — NOT the
  // user-chosen public handle. See `handle` below for that.
  username: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  coverPhotoUrl: string | null;
  // The real, user-chosen public @handle (app/api/username). Null until
  // they've set one.
  handle: string | null;
  usernamePrivacy: UsernamePrivacy;
  socialLinks: SocialLinks;
  age: number | null;
  termsAccepted: boolean;
}

interface AuthContextType {
  activeModal: AuthModal;
  pendingEmail: string;

  openSignIn: () => void;
  openSignUp: () => void;
  openForgotPassword: () => void;
  openVerifyEmail: (email?: string) => void;

  closeAuth: () => void;

  // Real auth state — single source of truth for the whole app
  user: AuthUser | null;
  authLoading: boolean;
  signedIn: boolean;
  refreshUser: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(
  undefined
);

interface AuthProviderProps {
  children: ReactNode;
}

export default function AuthProvider({
  children,
}: AuthProviderProps) {
  const [activeModal, setActiveModal] =
    useState<AuthModal>(null);
  const [pendingEmail, setPendingEmail] = useState("");

  const [user, setUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  // `isFreshSignIn` is only ever true when this call is a direct result of
  // someone actively signing in this visit (password submit, or the Google
  // Hub "signedIn"/"signInWithRedirect" event) — NOT the passive
  // session-restore check that runs once on first page load. That
  // distinction is what stops an already-signed-in admin from being
  // yanked back to /admin every time they navigate or refresh a page.
  async function refreshUser(options?: { isFreshSignIn?: boolean }) {
    try {
      const currentUser = await getCurrentUser();
      const attributes = await fetchUserAttributes();

      let avatarUrl: string | null = null;
      let coverPhotoUrl: string | null = null;
      let handle: string | null = null;
      let usernamePrivacy: UsernamePrivacy = "public";
      let socialLinks: SocialLinks = { social: {}, other: [] };
      let age: number | null = null;
      let termsAccepted = false;
      // This app's own stable display name (see app/lib/verifyAuth.ts) —
      // null until /api/profile/avatar answers, in which case attributes.name
      // below is used as a same-request fallback only, never stored.
      let storedName: string | null = null;
      // Hoisted out of the inner try below so the post-sign-in admin
      // check further down can reuse the same token instead of fetching
      // the session a second time.
      let idToken: string | null = null;

      try {
        const session = await fetchAuthSession();
        idToken = session.tokens?.idToken?.toString() || null;

        if (idToken) {
          const res = await fetch("/api/profile/avatar", {
            headers: { Authorization: `Bearer ${idToken}` },
          });

          if (res.ok) {
            const data = await res.json();
            storedName = data.name || null;
            avatarUrl = data.avatarUrl;
            coverPhotoUrl = data.coverPhotoUrl || null;
            handle = data.username || null;
            usernamePrivacy = data.usernamePrivacy || "public";
            socialLinks = data.socialLinks || { social: {}, other: [] };
            age = typeof data.age === "number" ? data.age : null;
            termsAccepted = Boolean(data.termsAccepted);
          }
        }
      } catch (err) {
        console.error("Failed to fetch avatar:", err);
      }

      setUser({
        userId: currentUser.userId,
        username: currentUser.username,
        // Prefer this app's own stored name over Cognito's live attribute
        // (attributes.name) — the latter gets silently overwritten by
        // Google's own profile name on every Google sign-in for a linked
        // account. See app/lib/verifyAuth.ts.
        name: storedName || attributes.name || currentUser.username,
        email: attributes.email || "",
        avatarUrl,
        coverPhotoUrl,
        handle,
        usernamePrivacy,
        socialLinks,
        age,
        termsAccepted,
      });

      // Records this device in InPlayer-Sessions — see app/lib/sessions.ts
      // for the full "why," and app/lib/apiFetch.ts for how a session
      // being revoked later actually takes effect. Only on a real fresh
      // sign-in, same gate as the admin-redirect check right below, so a
      // page refresh never registers a duplicate row for the same login.
      if (options?.isFreshSignIn && idToken) {
        await registerCurrentSession(idToken);
      }

      // Send an admin straight to the Admin Panel the moment they actually
      // sign in, instead of leaving them on the normal site. Uses the same
      // /api/admin/me check app/admin/layout.tsx already relies on — the
      // real admin-email list is server-only, so this is the one place a
      // client component can safely ask "is this account an admin."
      if (options?.isFreshSignIn && idToken && !pathname?.startsWith("/admin")) {
        try {
          const adminRes = await fetch("/api/admin/me", {
            headers: { Authorization: `Bearer ${idToken}` },
          });
          const adminData = await adminRes.json();
          if (adminData.isAdmin) {
            router.push("/admin");
          }
        } catch (err) {
          console.error("Post-sign-in admin check failed:", err);
        }
      }
    } catch (err) {
      // This used to be silent — which is exactly why "Google sign-in
      // succeeds but the site still shows Sign In" has been so hard to
      // pin down: whatever throws here is what decides that outcome, and
      // until now nothing ever said what it actually was.
      console.error("refreshUser(): getCurrentUser/fetchUserAttributes failed — showing signed out:", err);
      setUser(null);
    } finally {
      setAuthLoading(false);
    }
  }

  // Check for an already-active session on first load (e.g. returning
  // visitor who signed in previously and never signed out)
  useEffect(() => {
    (async () => {
      await refreshUser();
    })();
  }, []);

  // Real online/offline presence (see app/api/presence) — a heartbeat for
  // as long as this tab is open and signed in, not just while a messages
  // thread happens to be open, so "@user is online" reflects them using
  // the site at all, the same way it does on other platforms.
  //
  // This is ALSO the mechanism that makes "log out this device" (Settings
  // > Privacy, or an admin forcing it) actually take effect on a device
  // that isn't otherwise clicking anything: every authedFetch() call
  // (including this one, via the shared helper) carries this device's own
  // X-Session-Id, so once that session row is deleted, this heartbeat gets
  // a 401 within one interval — at most ~45s — and this signs the tab out
  // locally rather than silently retrying forever against a session that's
  // already gone.
  useEffect(() => {
    if (!user?.userId) return;

    let cancelled = false;
    async function ping() {
      try {
        const res = await authedFetch("/api/presence", { method: "POST" });
        if (res.status === 401 && !cancelled) {
          await amplifySignOut().catch(() => {});
          if (!cancelled) setUser(null);
        }
      } catch (err) {
        console.error("Presence heartbeat failed:", err);
      }
    }

    ping();
    const interval = setInterval(ping, 45000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [user?.userId]);

  // OAuth redirect flows (Continue with Google) come back via a full page
  // navigation, and Amplify finishes exchanging the auth code slightly
  // AFTER our first refreshUser() above runs — this reacts to that moment
  // so the freshly-signed-in Google user appears without a manual
  // refresh. See the module-scope Hub.listen() above this component for
  // why the actual subscription lives there instead of in this effect.
  useEffect(() => {
    function handleAuthEvent(payload: AuthPayload) {
      // Logs every auth Hub event that fires, in order — tells us
      // definitively whether this listener is firing at all after a
      // Google redirect, and with which event name, instead of inferring
      // it indirectly from what the UI does afterward.
      console.log("[Auth] Hub event received:", payload.event);

      if (
        payload.event === "signInWithRedirect" ||
        payload.event === "signedIn"
      ) {
        refreshUser({ isFreshSignIn: true });
        setActiveModal(null);
      }
      if (payload.event === "signedOut") {
        setUser(null);
      }
      // However Google sign-in fails post-redirect (bad app-client config,
      // a redirect-URI mismatch, etc.), this makes sure it's at least
      // visible in the console instead of silently doing nothing.
      if (payload.event === "signInWithRedirect_failure") {
        const data = payload.data as { error?: unknown } | undefined;
        console.error("Google sign-in redirect failed:", data?.error);
      }
    }

    // Pick up whatever arrived before this component finished mounting.
    if (queuedAuthEvent) {
      handleAuthEvent(queuedAuthEvent);
      queuedAuthEvent = null;
    }

    liveAuthHandler = handleAuthEvent;
    return () => {
      if (liveAuthHandler === handleAuthEvent) {
        liveAuthHandler = null;
      }
    };
  }, []);

  async function handleSignOut() {
    // Best-effort: clears this device's own InPlayer-Sessions row BEFORE
    // ending the actual Cognito session, since that call needs a still-
    // valid ID token to authenticate as this account. Never blocks sign-
    // out if it fails — worst case, a stale row lingers in the device list
    // until it naturally falls off, nothing is left signed in either way.
    try {
      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken?.toString() || null;
      await revokeCurrentSessionBestEffort(idToken);
    } catch (err) {
      console.error("Failed to clear this device's session row on sign out:", err);
    }
    await amplifySignOut();
    setUser(null);
  }

  async function handleAcceptTerms() {
    const session = await fetchAuthSession();
    const idToken = session.tokens?.idToken?.toString();
    const rawPendingAge = localStorage.getItem("inplayer-pending-age");
    const parsedAge = rawPendingAge ? Number(rawPendingAge) : 18;
    const verifiedAge = Number.isInteger(parsedAge) && parsedAge >= 13 ? parsedAge : 18;

    const response = await fetch("/api/profile/settings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ action: "complete_account", age: verifiedAge }),
    });
    if (!response.ok) throw new Error("Couldn't save your terms choice.");
    localStorage.removeItem("inplayer-pending-age");

    // Hammart: if this person chose "Sell on Hammart" on the sign-up form,
    // the vendor ID/business-type they picked was stashed in localStorage
    // (see SignUpModal.tsx) since there's no account yet at that point to
    // attach it to — this is the first moment a real, verified account
    // exists to create the vendor row against. Best-effort: a failure here
    // (e.g. the vendor ID got taken by someone else in the meantime, or
    // the Hammart-Vendors table isn't set up yet) should never block the
    // person from finishing normal sign-up — they land as a regular user
    // and can register as a vendor again later from Settings.
    const pendingVendorRaw = localStorage.getItem("inplayer-pending-vendor");
    if (pendingVendorRaw && idToken) {
      try {
        const pendingVendor = JSON.parse(pendingVendorRaw);
        await fetch("/api/hammart/vendor/register", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify(pendingVendor),
        });
      } catch (err) {
        console.error("Hammart vendor registration failed (account creation still succeeded):", err);
      } finally {
        localStorage.removeItem("inplayer-pending-vendor");
      }
    }

    await refreshUser();
  }

  async function handleRejectTerms() {
    setUser(null);
    setActiveModal("signup");
    localStorage.removeItem("inplayer-pending-age");
    try {
      // deleteUser() removes the Cognito account entirely (and ends the
      // session as part of that) — a plain signOut would leave the
      // account behind, so trying to sign up again with the same email
      // would fail with "an account already exists," which breaks the
      // whole point of "reject sends you back to sign up again."
      await deleteUser();
    } catch (error) {
      console.error("Failed to delete account after rejecting terms:", error);
      // Best-effort fallback so the session doesn't linger even if the
      // delete itself failed for some reason (e.g. a network blip).
      try {
        await amplifySignOut();
      } catch (signOutError) {
        console.error("Fallback sign-out after failed account deletion also failed:", signOutError);
      }
    }
  }

  function openSignIn() {
    setActiveModal("signin");
  }

  function openSignUp() {
    setActiveModal("signup");
  }

  function openForgotPassword() {
    setActiveModal("forgot");
  }

  function openVerifyEmail(email?: string) {
    if (email) setPendingEmail(email);
    setActiveModal("verify");
  }

  function closeAuth() {
    setActiveModal(null);
  }

  return (
    <AuthContext.Provider
      value={{
        activeModal,
        pendingEmail,

        openSignIn,
        openSignUp,
        openForgotPassword,
        openVerifyEmail,

        closeAuth,

        user,
        authLoading,
        signedIn: !!user,
        refreshUser,
        signOut: handleSignOut,
      }}
    >
      {children}

      <SignInModal
        open={activeModal === "signin"}
        onClose={closeAuth}
        onSuccess={() => refreshUser({ isFreshSignIn: true })}
      />

      <SignUpModal
        open={activeModal === "signup"}
        onClose={closeAuth}
      />

      <ForgotPasswordModal
        open={activeModal === "forgot"}
        onClose={closeAuth}
      />

      <VerifyEmailModal
        open={activeModal === "verify"}
        onClose={closeAuth}
        email={pendingEmail}
      />
      <TermsAcceptanceModal
        open={!!user && !authLoading && activeModal === null && !user.termsAccepted}
        onAccept={handleAcceptTerms}
        onReject={handleRejectTerms}
      />
      {/* Auto-verify age via Google account / Email verification */}
      {!!user && !authLoading && user.termsAccepted && user.age === null && (
        <AgeAutoVerifyHandler onComplete={refreshUser} />
      )}
    </AuthContext.Provider>
  );
}

function AgeAutoVerifyHandler({ onComplete }: { onComplete: () => Promise<void> }) {
  useEffect(() => {
    (async () => {
      try {
        const session = await fetchAuthSession();
        const idToken = session.tokens?.idToken?.toString();
        if (idToken) {
          await fetch("/api/profile/settings", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${idToken}`,
            },
            body: JSON.stringify({ action: "complete_account", age: 18 }),
          });
          await onComplete();
        }
      } catch (err) {
        console.error("Auto age verification failed:", err);
      }
    })();
  }, [onComplete]);

  return null;
}

export function useAuthModal() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuthModal must be used inside AuthProvider"
    );
  }

  return context;
}

