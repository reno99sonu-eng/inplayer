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
  useMemo,
  ReactNode,
} from "react";
import {
  getCurrentUser,
  fetchUserAttributes,
  fetchAuthSession,
  signOut as amplifySignOut,
  deleteUser,
} from "aws-amplify/auth";
import { Hub } from "aws-amplify/utils";

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

  async function refreshUser() {
    try {
      const currentUser = await getCurrentUser();
      const attributes = await fetchUserAttributes();

      let avatarUrl: string | null = null;
      let handle: string | null = null;
      let usernamePrivacy: UsernamePrivacy = "public";
      let socialLinks: SocialLinks = { social: {}, other: [] };
      let age: number | null = null;
      let termsAccepted = false;

      try {
        const session = await fetchAuthSession();
        const idToken = session.tokens?.idToken?.toString();

        if (idToken) {
          const res = await fetch("/api/profile/avatar", {
            headers: { Authorization: `Bearer ${idToken}` },
          });

          if (res.ok) {
            const data = await res.json();
            avatarUrl = data.avatarUrl;
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
        name: attributes.name || currentUser.username,
        email: attributes.email || "",
        avatarUrl,
        handle,
        usernamePrivacy,
        socialLinks,
        age,
        termsAccepted,
      });
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
    refreshUser();
  }, []);

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
        refreshUser();
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
    await amplifySignOut();
    setUser(null);
  }

  async function handleAcceptTerms() {
    const session = await fetchAuthSession();
    const idToken = session.tokens?.idToken?.toString();
    const pendingAge = Number(localStorage.getItem("inplayer-pending-age"));
    const canCompleteAccount =
      Number.isInteger(pendingAge) && pendingAge >= 13 && pendingAge <= 120;
    const response = await fetch("/api/profile/settings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify(
        canCompleteAccount
          ? { action: "complete_account", age: pendingAge }
          : { action: "accept_terms" }
      ),
    });
    if (!response.ok) throw new Error("Couldn't save your terms choice.");
    if (canCompleteAccount) localStorage.removeItem("inplayer-pending-age");
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
        onSuccess={refreshUser}
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
      {!!user && !authLoading && user.termsAccepted && user.age === null && (
        <AgeRequiredModal onComplete={refreshUser} />
      )}
    </AuthContext.Provider>
  );
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

