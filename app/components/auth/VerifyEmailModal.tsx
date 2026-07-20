"use client";

import { useEffect, useState } from "react";
import { KeyRound, X } from "lucide-react";
import { confirmSignUp, resendSignUpCode } from "aws-amplify/auth";
import { useAuthModal } from "./AuthProvider";

interface VerifyEmailModalProps {
  open: boolean;
  onClose: () => void;
  email: string;
}

export default function VerifyEmailModal({
  open,
  onClose,
  email,
}: VerifyEmailModalProps) {
  const { openSignIn } = useAuthModal();

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setCode("");
      setLoading(false);
      setResending(false);
      setError(null);
      setResendMessage(null);
    }
  }, [open]);

  const handleVerify = async () => {
    setError(null);

    if (!code.trim()) {
      setError("Please enter the verification code.");
      return;
    }

    if (!email) {
      setError("Missing email address — please sign up again.");
      return;
    }

    setLoading(true);

    try {
      await confirmSignUp({
        username: email,
        confirmationCode: code.trim(),
      });

      openSignIn();
    } catch (err: unknown) {
      const name = (err as { name?: string })?.name;
      const message =
        err instanceof Error ? err.message : "Something went wrong. Please try again.";

      if (name === "CodeMismatchException") {
        setError("That code doesn't match. Please check and try again.");
      } else if (name === "ExpiredCodeException") {
        setError("That code has expired. Tap 'Resend Code' below for a new one.");
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError(null);
    setResendMessage(null);

    if (!email) return;

    setResending(true);

    try {
      await resendSignUpCode({ username: email });
      setResendMessage("A new code has been sent to your email.");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Couldn't resend the code. Please try again.";
      setError(message);
    } finally {
      setResending(false);
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

          <h2 className="mt-4 text-[26px] sm:text-3xl font-black leading-tight text-white light:text-slate-900">
            Verify Your Email.
          </h2>

          <p className="mt-2 text-sm text-slate-400 light:text-slate-600">
            We sent a verification code to{" "}
            {email ? (
              <span className="text-orange-300 light:text-orange-600">{email}</span>
            ) : (
              "your email"
            )}
            . Enter it below to activate your account.
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
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleVerify();
                  }}
                  className="
                    w-full rounded-2xl border border-white/10 light:border-black/10
                    bg-[#07111F] light:bg-black/[0.03]
                    py-3 pl-11 pr-4
                    text-white light:text-slate-900 caret-orange-400
                    outline-none transition-all duration-300
                    placeholder:text-slate-500 light:placeholder:text-slate-400
                    focus:border-orange-400/50
                  "
                  placeholder="123456"
                />
              </div>
            </div>

            {error && (
              <p className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300 light:text-red-700">
                {error}
              </p>
            )}

            {resendMessage && (
              <p className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-300 light:text-emerald-700">
                {resendMessage}
              </p>
            )}

            <button
              type="button"
              onClick={handleVerify}
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
              {loading ? "Verifying..." : "Verify Email"}
            </button>

            <button
              type="button"
              onClick={handleResend}
              disabled={resending}
              className="
                w-full rounded-2xl border border-white/10 light:border-black/10
                py-3 text-sm font-semibold text-slate-200 light:text-slate-700
                transition-all duration-300
                hover:border-orange-400/30 hover:bg-white/5 light:hover:bg-black/5
                disabled:cursor-not-allowed disabled:opacity-60
              "
            >
              {resending ? "Sending..." : "Resend Code"}
            </button>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
