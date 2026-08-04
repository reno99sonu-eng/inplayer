"use client";

import { useEffect, useState } from "react";
import { Mail, Lock, KeyRound, X } from "lucide-react";
import { resetPassword, confirmResetPassword } from "aws-amplify/auth";
import { useAuthModal } from "./AuthProvider";

interface ForgotPasswordModalProps {
  open: boolean;
  onClose: () => void;
}

export default function ForgotPasswordModal({
  open,
  onClose,
}: ForgotPasswordModalProps) {
  const { openSignIn } = useAuthModal();

  const [step, setStep] = useState<"request" | "confirm">("request");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    (() => {
      if (!open) {
        setStep("request");
        setEmail("");
        setCode("");
        setNewPassword("");
        setLoading(false);
        setError(null);
        setSuccess(false);
      }
    })();
  }, [open]);

  const handleRequestCode = async () => {
    setError(null);

    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }

    setLoading(true);

    try {
      await resetPassword({ username: email.trim() });
      setStep("confirm");
    } catch (err: unknown) {
      const name = (err as { name?: string })?.name;
      const message =
        err instanceof Error ? err.message : "Something went wrong. Please try again.";

      if (name === "UserNotFoundException") {
        setError("No account found with that email address.");
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmReset = async () => {
    setError(null);

    if (!code.trim() || !newPassword) {
      setError("Please enter the code and your new password.");
      return;
    }

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);

    try {
      await confirmResetPassword({
        username: email.trim(),
        confirmationCode: code.trim(),
        newPassword,
      });

      setSuccess(true);
    } catch (err: unknown) {
      const name = (err as { name?: string })?.name;
      const message =
        err instanceof Error ? err.message : "Something went wrong. Please try again.";

      if (name === "CodeMismatchException") {
        setError("That code doesn't match. Please check and try again.");
      } else if (name === "ExpiredCodeException") {
        setError("That code has expired. Please request a new one.");
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
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

        <div
          className="
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
            animate-aiPopup
          "
        >
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[28px] sm:rounded-[30px]">
          <div className="absolute -left-16 -top-16 h-48 w-48 rounded-full bg-orange-500/10 blur-[80px]" />
          <div className="absolute -right-16 bottom-0 h-40 w-40 rounded-full bg-cyan-500/10 blur-[80px]" />
        </div>

        <div className="relative z-10">
          <span
            className="
              inline-flex rounded-full border border-orange-400/30 light:border-orange-400/40
              bg-orange-500/10 px-3 py-1 text-[10px] font-bold tracking-[0.35em]
              text-orange-300 light:text-orange-700
            "
          >
            INPLAYER
          </span>

          {success ? (
            <>
              <h2 className="mt-4 text-[26px] sm:text-3xl font-black leading-tight text-white light:text-slate-900">
                Password Reset.
              </h2>
              <p className="mt-2 text-sm text-slate-400 light:text-slate-600">
                Your password has been changed. You can now sign in with your new password.
              </p>

              <button
                type="button"
                onClick={openSignIn}
                className="
                  mt-6 w-full rounded-2xl bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A]
                  py-3.5 font-bold text-white
                  shadow-[0_15px_35px_rgba(255,153,0,.3)]
                  transition-all duration-300
                  hover:-translate-y-0.5
                "
              >
                Back to Sign In
              </button>
            </>
          ) : step === "request" ? (
            <>
              <h2 className="mt-4 text-[26px] sm:text-3xl font-black leading-tight text-white light:text-slate-900">
                Forgot Password?
              </h2>
              <p className="mt-2 text-sm text-slate-400 light:text-slate-600">
                Enter your email and we&apos;ll send you a code to reset your password.
              </p>

              <div className="mt-6 space-y-4">
                <div>
                  <label className="mb-2 block text-xs font-medium text-slate-400 light:text-slate-600">
                    Email
                  </label>
                  <div className="relative">
                    <Mail
                      size={17}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 light:text-slate-600"
                    />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleRequestCode();
                      }}
                      className="
                        w-full rounded-2xl border border-white/10 light:border-black/10
                        bg-[#07111F] light:bg-black/[0.03]
                        py-3 pl-11 pr-4
                        text-white light:text-slate-900 caret-orange-400
                        outline-none transition-all duration-300
                        placeholder:text-slate-500 light:placeholder:text-slate-600
                        focus:border-orange-400/50
                      "
                      placeholder="you@example.com"
                    />
                  </div>
                </div>

                {error && (
                  <p className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300 light:text-red-700">
                    {error}
                  </p>
                )}

                <button
                  type="button"
                  onClick={handleRequestCode}
                  disabled={loading}
                  className="
                    w-full rounded-2xl bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A]
                    py-3.5 font-bold text-white
                    shadow-[0_15px_35px_rgba(255,153,0,.3)]
                    transition-all duration-300
                    hover:-translate-y-0.5
                    disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0
                  "
                >
                  {loading ? "Sending Code..." : "Send Reset Code"}
                </button>

                <p className="text-center text-xs text-slate-400 light:text-slate-600">
                  Remembered your password?{" "}
                  <button
                    type="button"
                    onClick={openSignIn}
                    className="font-semibold text-orange-300 light:text-orange-600 transition hover:text-orange-200 light:hover:text-orange-700"
                  >
                    Sign In
                  </button>
                </p>
              </div>
            </>
          ) : (
            <>
              <h2 className="mt-4 text-[26px] sm:text-3xl font-black leading-tight text-white light:text-slate-900">
                Enter Reset Code.
              </h2>
              <p className="mt-2 text-sm text-slate-400 light:text-slate-600">
                We sent a code to <span className="text-orange-300 light:text-orange-600">{email}</span>. Enter it below with your new password.
              </p>

              <div className="mt-6 space-y-4">
                <div>
                  <label className="mb-2 block text-xs font-medium text-slate-400 light:text-slate-600">
                    Verification Code
                  </label>
                  <div className="relative">
                    <KeyRound
                      size={17}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 light:text-slate-600"
                    />
                    <input
                      type="text"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      className="
                        w-full rounded-2xl border border-white/10 light:border-black/10
                        bg-[#07111F] light:bg-black/[0.03]
                        py-3 pl-11 pr-4
                        text-white light:text-slate-900 caret-orange-400
                        outline-none transition-all duration-300
                        placeholder:text-slate-500 light:placeholder:text-slate-600
                        focus:border-orange-400/50
                      "
                      placeholder="123456"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-medium text-slate-400 light:text-slate-600">
                    New Password
                  </label>
                  <div className="relative">
                    <Lock
                      size={17}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 light:text-slate-600"
                    />
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleConfirmReset();
                      }}
                      className="
                        w-full rounded-2xl border border-white/10 light:border-black/10
                        bg-[#07111F] light:bg-black/[0.03]
                        py-3 pl-11 pr-4
                        text-white light:text-slate-900 caret-orange-400
                        outline-none transition-all duration-300
                        placeholder:text-slate-500 light:placeholder:text-slate-600
                        focus:border-orange-400/50
                      "
                      placeholder="At least 8 characters"
                    />
                  </div>
                </div>

                {error && (
                  <p className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300 light:text-red-700">
                    {error}
                  </p>
                )}

                <button
                  type="button"
                  onClick={handleConfirmReset}
                  disabled={loading}
                  className="
                    w-full rounded-2xl bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A]
                    py-3.5 font-bold text-white
                    shadow-[0_15px_35px_rgba(255,153,0,.3)]
                    transition-all duration-300
                    hover:-translate-y-0.5
                    disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0
                  "
                >
                  {loading ? "Resetting..." : "Reset Password"}
                </button>
              </div>
            </>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}
