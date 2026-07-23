"use client";

import { useEffect, useState } from "react";
import { Mail, Lock, X, Loader2, Check } from "lucide-react";
import { signIn } from "@/app/lib/auth";
import { signInWithRedirect } from "aws-amplify/auth";
import { cognitoUserPoolsTokenProvider } from "aws-amplify/auth/cognito";
import {
  defaultStorage,
  sessionStorage as amplifySessionStorage,
} from "aws-amplify/utils";
import { useAuthModal } from "./AuthProvider";

interface SignInModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

// Google sign-in reaches all the way through Google's own consent screen
// and back, but the session never actually takes on return. New evidence
// (an "already authenticated" error on a second attempt, in a browser
// that had never touched this site before) points to the sign-in itself
// actually succeeding — Cognito really does end up with a valid session —
// and the bug being specifically that the app's own signed-in check never
// picks it up. AuthProvider now logs exactly why that check fails instead
// of doing so silently.
//
// TEMPORARILY re-enabled (was `false`) to get one clean diagnostic test
// with that logging in place. This is NOT a "confirmed fixed" flip — set
// it back to `false` again right after this round, unless the console
// output shows it's actually resolved end to end.
const GOOGLE_SIGNIN_ENABLED = true;

export default function SignInModal({
  open,
  onClose,
  onSuccess,
}: SignInModalProps) {
  const { openSignUp, openForgotPassword } = useAuthModal();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // Checked by default — most viewers expect to stay signed in. Unchecking
  // it makes the session end when the browser closes (see handleSignIn).
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!open) {
      setEmail("");
      setPassword("");
      setRememberMe(true);
      setShowPassword(false);
      setLoading(false);
      setError(null);
      setShake(false);
      setSuccess(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  const triggerError = (message: string) => {
    setError(message);
    setShake(true);
    setTimeout(() => setShake(false), 400);
  };

  const handleSignIn = async () => {
    setError(null);

    if (!email.trim() || !password) {
      triggerError("Please enter both your email and password.");
      return;
    }

    setLoading(true);

    try {
      // "Remember me" decides where Cognito keeps the session tokens:
      // checked → localStorage (survives closing the browser), unchecked →
      // sessionStorage (signed out once the browser closes). The choice is
      // also saved so amplify-config.ts re-applies it on the next page
      // load — without that, a reload mid-session would look for tokens
      // in the wrong storage and appear signed out.
      try {
        localStorage.setItem("inplayer-remember-me", rememberMe ? "1" : "0");
      } catch {
        /* private mode — fall through with default storage */
      }
      cognitoUserPoolsTokenProvider.setKeyValueStorage(
        rememberMe ? defaultStorage : amplifySessionStorage
      );

      const result = await signIn({
        username: email.trim(),
        password,
      });

      if (result.isSignedIn) {
        // A brief success moment before closing feels more confirmed
        // than instantly disappearing.
        setSuccess(true);
        onSuccess?.();
        setTimeout(() => {
          onClose();
        }, 700);
      } else {
        const step = result.nextStep?.signInStep;

        if (step === "CONFIRM_SIGN_UP") {
          triggerError(
            "Your account isn't verified yet. Please check your email for a verification code."
          );
        } else if (step === "CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED") {
          triggerError(
            "A new password is required for this account. Please reset your password."
          );
        } else {
          triggerError(`Additional sign-in step required: ${step}`);
        }
      }
    } catch (err: unknown) {
      const name = (err as { name?: string })?.name;
      const message =
        err instanceof Error ? err.message : "Something went wrong signing in.";

      if (name === "UserNotFoundException") {
        triggerError("No account found with that email address.");
      } else if (name === "NotAuthorizedException") {
        triggerError("Incorrect email or password.");
      } else if (name === "UserNotConfirmedException") {
        triggerError(
          "Your account isn't verified yet. Please check your email for a verification code."
        );
      } else {
        triggerError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError(null);
    try {
      // Redirects to Cognito's Hosted UI → Google → back here. Amplify
      // finishes the exchange on return and AuthProvider's Hub listener
      // picks the session up.
      await signInWithRedirect({ provider: "Google" });
    } catch (err) {
      console.error("Google sign-in failed:", err);
      // Most common cause: no Cognito Hosted UI domain / Google provider
      // configured yet (NEXT_PUBLIC_COGNITO_DOMAIN unset).
      triggerError(
        "Google sign-in isn't set up for this site yet. Please sign in with your email and password."
      );
    }
  };

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      className="
        fixed inset-0 z-[9999] flex items-center justify-center
        bg-black/70 light:bg-black/40 backdrop-blur-md p-4 sm:p-5
      "
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[440px]"
      >
        {/* Deliberately OUTSIDE the scrollable card below (and given its
            own higher z-index) so it always stays reachable at the same
            spot even when the card's own content scrolls — e.g. the
            mobile keyboard shrinking the viewport while a field is
            focused used to push this out of view/out of tapping range
            when it lived inside the scrolling area. stopPropagation here
            too, defensively, so it can never depend on bubbling order. */}
        {!success && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="
              absolute right-4 top-4 z-20 flex h-9 w-9 items-center justify-center
              rounded-full border border-white/10 light:border-black/10
              bg-white/5 light:bg-black/5
              text-slate-300 light:text-slate-600
              backdrop-blur-xl
              transition-all duration-300
              hover:rotate-90 hover:border-orange-400/40 hover:bg-orange-500/10 hover:text-white light:hover:text-slate-900
            "
          >
            <X size={18} />
          </button>
        )}

        <div
          className={`
            relative
            max-h-[92vh] overflow-y-auto
            [scrollbar-width:none] [&::-webkit-scrollbar]:hidden
            rounded-[28px] sm:rounded-[30px]
            border border-orange-400/15 light:border-orange-400/25
            bg-gradient-to-br from-[#07111F]/95 via-[#0B1728]/95 to-[#040A14]/95
            light:from-[#FBF6EA]/98 light:via-[#EDE2C9]/98 light:to-[#FBF6EA]/98
            p-5 sm:p-7
            shadow-[0_25px_90px_rgba(0,0,0,.55)]
            light:shadow-[0_25px_90px_rgba(0,0,0,.18)]
            animate-modal-pop
            ${shake ? "animate-modal-shake" : ""}
          `}
        >
        {/* Ambient glow decorations */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[28px] sm:rounded-[30px]">
          <div className="absolute -left-16 -top-16 h-48 w-48 rounded-full bg-orange-500/10 blur-[80px] animate-pulse" />
          <div className="absolute -right-16 bottom-0 h-40 w-40 rounded-full bg-cyan-500/10 blur-[80px]" />
        </div>

        {success ? (
          <div className="relative z-10 flex flex-col items-center justify-center py-10 text-center">
            <div className="animate-success-pop flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 border border-emerald-400/30">
              <Check size={32} className="text-emerald-400" />
            </div>
            <h2 className="mt-5 text-xl font-black text-white light:text-slate-900">
              Welcome back!
            </h2>
            <p className="mt-1 text-sm text-slate-400 light:text-slate-600">
              Signing you in...
            </p>
          </div>
        ) : (
            <div className="relative z-10">
              <span
                className="
                  inline-flex rounded-full border border-orange-400/30 light:border-orange-400/40
                  bg-orange-500/10 light:bg-orange-500/10
                  px-3 py-1 text-[10px] font-bold tracking-[0.35em]
                  text-orange-300 light:text-orange-700
                "
              >
                INPLAYER
              </span>

              <h2 className="mt-4 text-[28px] sm:text-3xl font-black leading-none text-white light:text-slate-900">
                Welcome
                <br />
                Back.
              </h2>

              <p className="mt-2 text-sm text-slate-400 light:text-slate-600">
                Sign in to continue watching your favourite creators and premium content.
              </p>

              <div className="mt-6 space-y-4">
                <div>
                  <label className="mb-2 block text-xs font-medium text-slate-400 light:text-slate-600">
                    Email
                  </label>
                  <div className="group relative">
                    <Mail
                      size={17}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 light:text-slate-600 transition-colors duration-300 group-focus-within:text-orange-400"
                    />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="
                        w-full rounded-2xl border border-white/10 light:border-black/10
                        bg-[#07111F] light:bg-black/[0.03]
                        py-3 pl-11 pr-4
                        text-white light:text-slate-900 caret-orange-400
                        outline-none transition-all duration-300
                        placeholder:text-slate-500 light:placeholder:text-slate-400
                        focus:border-orange-400/50 focus:shadow-[0_0_0_3px_rgba(249,115,22,.1)]
                      "
                      placeholder="you@example.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-medium text-slate-400 light:text-slate-600">
                    Password
                  </label>
                  <div className="group relative">
                    <Lock
                      size={17}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 light:text-slate-600 transition-colors duration-300 group-focus-within:text-orange-400"
                    />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSignIn();
                      }}
                      className="
                        w-full rounded-2xl border border-white/10 light:border-black/10
                        bg-[#07111F] light:bg-black/[0.03]
                        py-3 pl-11 pr-16
                        text-white light:text-slate-900 caret-orange-400
                        outline-none transition-all duration-300
                        placeholder:text-slate-500 light:placeholder:text-slate-400
                        focus:border-orange-400/50 focus:shadow-[0_0_0_3px_rgba(249,115,22,.1)]
                      "
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-orange-300 light:text-orange-600 transition hover:text-orange-200"
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-xs text-slate-400 light:text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="accent-orange-500"
                    />
                    Remember me
                  </label>

                  <button
                    type="button"
                    onClick={openForgotPassword}
                    className="text-xs font-semibold text-orange-300 light:text-orange-600 transition hover:text-orange-200 light:hover:text-orange-700"
                  >
                    Forgot Password?
                  </button>
                </div>

                {error && (
                  <p className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300 light:text-red-700">
                    {error}
                  </p>
                )}

                <button
                  type="button"
                  onClick={handleSignIn}
                  disabled={loading}
                  className="
                    flex w-full items-center justify-center gap-2
                    rounded-2xl bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A]
                    py-3.5 font-bold text-white
                    shadow-[0_15px_35px_rgba(255,153,0,.3)]
                    transition-all duration-300
                    hover:-translate-y-0.5 hover:shadow-[0_20px_45px_rgba(255,153,0,.4)]
                    active:scale-[0.98]
                    disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0
                  "
                >
                  {loading && <Loader2 size={18} className="animate-spin" />}
                  {loading ? "Signing In..." : "Sign In"}
                </button>

                {GOOGLE_SIGNIN_ENABLED && (
                  <>
                    <div className="flex items-center gap-3">
                      <div className="h-px flex-1 bg-white/10 light:bg-black/10" />
                      <span className="text-[10px] font-medium text-slate-500">OR</span>
                      <div className="h-px flex-1 bg-white/10 light:bg-black/10" />
                    </div>

                    <button
                      type="button"
                      onClick={handleGoogle}
                      className="
                        w-full rounded-2xl border border-white/10 light:border-black/10
                        py-3 text-sm font-semibold text-slate-200 light:text-slate-700
                        transition-all duration-300
                        hover:border-orange-400/30 hover:bg-white/5 light:hover:bg-black/5
                        active:scale-[0.98]
                      "
                    >
                      Continue with Google
                    </button>
                  </>
                )}

                <p className="text-center text-xs text-slate-400 light:text-slate-600">
                  Don&apos;t have an account?{" "}
                  <button
                    type="button"
                    onClick={openSignUp}
                    className="font-semibold text-orange-300 light:text-orange-600 transition hover:text-orange-200 light:hover:text-orange-700"
                  >
                    Create Account
                  </button>
                </p>
              </div>
            </div>
        )}
        </div>
      </div>
    </div>
  );
}
