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
} from "aws-amplify/auth";
import { Hub } from "aws-amplify/utils";

import SignInModal from "./SignInModal";
import SignUpModal from "./SignUpModal";
import ForgotPasswordModal from "./ForgotPasswordModal";
import VerifyEmailModal from "./VerifyEmailModal";

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
      });
    } catch {
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

  // TEMP DIAGNOSTIC (safe to remove once Google sign-in is confirmed
  // working): logs whatever landed in the URL on this page load. After the
  // Google redirect completes, this tells us whether Cognito actually sent
  // back "?code=..." (exchange is failing after arrival), "?error=..."
  // (Cognito/Google rejected the request before ever getting here), or
  // nothing at all (something upstream — DNS forwarding, a wrong redirect
  // target, etc. — is stripping the query string before we see it).
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.search) {
      console.log("[auth-debug] landed with query:", window.location.search);
    }
  }, []);

  // OAuth redirect flows (Continue with Google) come back via a full page
  // navigation, and Amplify finishes exchanging the auth code slightly
  // AFTER our first refreshUser() above runs — this Hub listener catches
  // that moment so the freshly-signed-in Google user appears without a
  // manual refresh.
  useEffect(() => {
    const unsubscribe = Hub.listen("auth", ({ payload }) => {
      // TEMP DIAGNOSTIC: log every auth event Amplify fires, whatever it
      // is, so an event we didn't explicitly anticipate still shows up
      // instead of being silently ignored.
      console.log("[auth-debug] Hub auth event:", payload.event, payload);

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
      // Google's redirect can land back here successfully (no error, page
      // just reloads at "/") while Amplify's code-for-tokens exchange fails
      // in the background — previously silent, which looked exactly like
      // "nothing happened" with zero clues in the console. This surfaces
      // the real reason (e.g. a Cognito app client misconfigured with a
      // secret, or a redirect-URI mismatch) instead of failing silently.
      if (payload.event === "signInWithRedirect_failure") {
        console.error(
          "Google sign-in redirect failed:",
          payload.data.error
        );
      }
    });

    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSignOut() {
    await amplifySignOut();
    setUser(null);
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

