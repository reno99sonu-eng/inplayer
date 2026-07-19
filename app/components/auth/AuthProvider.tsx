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

export interface AuthUser {
  userId: string;
  username: string;
  name: string;
  email: string;
  avatarUrl: string | null;
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

