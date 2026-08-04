"use client";

import { useEffect, useMemo, useState } from "react";
import { User, Mail, Lock, X, Loader2, Check, CheckCircle2, UserX, Store } from "lucide-react";
import { signUp } from "@/app/lib/auth";
import { signInWithRedirect } from "aws-amplify/auth";
import { useAuthModal } from "./AuthProvider";
import { usePlatformSettings } from "@/app/hooks/usePlatformSettings";

interface SignUpModalProps {
  open: boolean;
  onClose: () => void;
}

// See the matching flag + comment in SignInModal.tsx — same unresolved
// bug, same reasoning, TEMPORARILY re-enabled for the same one diagnostic
// test. Keep these two in sync — set both back to `false` together.
const GOOGLE_SIGNIN_ENABLED = true;

function getPasswordStrength(password: string) {
  if (!password) return { score: 0, label: "", color: "" };

  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) return { score: 1, label: "Weak", color: "bg-red-500" };
  if (score <= 3) return { score: 2, label: "Fair", color: "bg-orange-400" };
  if (score === 4) return { score: 3, label: "Good", color: "bg-amber-400" };
  return { score: 4, label: "Strong", color: "bg-emerald-500" };
}

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export default function SignUpModal({ open, onClose }: SignUpModalProps) {
  const { openSignIn, openVerifyEmail } = useAuthModal();
  // Real Platform Settings toggle (Admin Panel -> Platform Settings). A
  // still-loading or unreachable settings fetch (settings === null) fails
  // open — never block real sign-ups over a transient network error, same
  // convention as every other consumer of usePlatformSettings.
  const { settings: platformSettings } = usePlatformSettings();
  const signupsPaused = platformSettings?.signupsEnabled === false;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [age, setAge] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [success, setSuccess] = useState(false);

  // Hammart vendor signup — "As Vendor / As User" split. A vendor account
  // is still a normal InPlayer account underneath; this just also reserves
  // a storefront ID and creates a Hammart-Vendors row the moment sign-up
  // actually completes (see the localStorage handoff below and
  // handleAcceptTerms() in AuthProvider.tsx — mirrors how "pending age"
  // already survives the email-verification step).
  const [accountType, setAccountType] = useState<"user" | "vendor">("user");
  const [businessType, setBusinessType] = useState<"individual" | "business">("individual");
  const [vendorId, setVendorId] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [vendorIdCheck, setVendorIdCheck] = useState<{
    status: "idle" | "checking" | "available" | "unavailable";
    reason?: string;
  }>({ status: "idle" });

  const strength = useMemo(() => getPasswordStrength(password), [password]);
  const emailValid = email.length > 0 && isValidEmail(email);
  const nameValid = name.trim().length > 1;
  const passwordsMatch = confirmPassword.length > 0 && confirmPassword === password;
  const passwordsMismatch = confirmPassword.length > 0 && confirmPassword !== password;

  useEffect(() => {
    const resetForm = () => {
      setName("");
      setEmail("");
      setAge("");
      setPassword("");
      setConfirmPassword("");
      setLoading(false);
      setError(null);
      setShake(false);
      setSuccess(false);
      setAccountType("user");
      setBusinessType("individual");
      setVendorId("");
      setBusinessName("");
      setVendorIdCheck({ status: "idle" });
    };
    if (!open) resetForm();
  }, [open]);

  // Live vendor-ID availability check, debounced — mirrors the same
  // pattern already used for @handle checking on the profile page.
  useEffect(() => {
    const clearCheck = () => setVendorIdCheck({ status: "idle" });

    if (accountType !== "vendor") {
      clearCheck();
      return;
    }

    const trimmed = vendorId.trim();
    if (!trimmed) {
      clearCheck();
      return;
    }

    let cancelled = false;
    const markChecking = () => setVendorIdCheck({ status: "checking" });
    markChecking();

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/hammart/vendor-id/check?vendorId=${encodeURIComponent(trimmed)}`);
        const data = await res.json();
        if (cancelled) return;
        setVendorIdCheck({
          status: data.available ? "available" : "unavailable",
          reason: data.reason,
        });
      } catch {
        if (!cancelled) {
          setVendorIdCheck({ status: "unavailable", reason: "Couldn't check that vendor ID right now." });
        }
      }
    }, 450);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [accountType, vendorId]);

  const triggerError = (message: string) => {
    setError(message);
    setShake(true);
    setTimeout(() => setShake(false), 400);
  };

  const handleSignUp = async () => {
    setError(null);

    if (!name.trim() || !email.trim() || !password) {
      triggerError("Please fill in your name, email, and password.");
      return;
    }

    if (!isValidEmail(email)) {
      triggerError("Please enter a valid email address.");
      return;
    }

    if (password.length < 8) {
      triggerError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      triggerError("Your passwords don't match.");
      return;
    }

    if (accountType === "vendor") {
      if (!vendorId.trim() || vendorIdCheck.status !== "available") {
        triggerError("Please choose an available vendor ID before continuing.");
        return;
      }
      if (businessType === "business" && !businessName.trim()) {
        triggerError("Please enter your registered business name.");
        return;
      }
    }

    setLoading(true);
    try {
      // Auto-verify age to 18 via Google account / Email verification
      localStorage.setItem("inplayer-pending-age", "18");
      if (accountType === "vendor") {
        localStorage.setItem(
          "inplayer-pending-vendor",
          JSON.stringify({
            vendorId: vendorId.trim(),
            businessType,
            businessName: businessType === "business" ? businessName.trim() : null,
          })
        );
      }
    } catch { /* ignore */ }

    try {
      const result = await signUp({
        username: email.trim(),
        password,
        options: {
          userAttributes: {
            email: email.trim(),
            name: name.trim(),
          },
        },
      });

      setSuccess(true);

      setTimeout(() => {
        if (result.nextStep?.signUpStep === "CONFIRM_SIGN_UP") {
          openVerifyEmail(email.trim());
        } else {
          openSignIn();
        }
      }, 900);
    } catch (err: unknown) {
      const name = (err as { name?: string })?.name;
      const message =
        err instanceof Error ? err.message : "Something went wrong creating your account.";

      if (name === "UsernameExistsException") {
        triggerError("An account with that email already exists.");
      } else if (name === "InvalidPasswordException") {
        triggerError("That password doesn't meet the requirements. Try a longer, stronger password.");
      } else if (name === "InvalidParameterException") {
        triggerError("Please check your details — something wasn't accepted by the server.");
      } else {
        triggerError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError(null);
    if (accountType === "vendor") {
      if (!vendorId.trim() || vendorIdCheck.status !== "available") {
        triggerError("Please choose an available vendor ID before continuing with Google.");
        return;
      }
      if (businessType === "business" && !businessName.trim()) {
        triggerError("Please enter your registered business name.");
        return;
      }
    }
    try {
      // Auto-verify age to 18 via Google account verification
      localStorage.setItem("inplayer-pending-age", "18");
      if (accountType === "vendor") {
        localStorage.setItem(
          "inplayer-pending-vendor",
          JSON.stringify({
            vendorId: vendorId.trim(),
            businessType,
            businessName: businessType === "business" ? businessName.trim() : null,
          })
        );
      }
    } catch { /* ignore */ }
    try {
      // With Google there's no separate "sign up" — the first Google
      // sign-in creates the account automatically via Cognito.
      await signInWithRedirect({ provider: "Google" });
    } catch (err) {
      console.error("Google sign-in failed:", err);
      triggerError(
        "Google sign-in isn't set up for this site yet. Please create an account with your email instead."
      );
    }
  };

  if (!open) return null;

  if (signupsPaused) {
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
          className="
            relative w-full max-w-[420px] rounded-[28px] border border-orange-400/15
            bg-gradient-to-br from-[#07111F]/95 via-[#0B1728]/95 to-[#040A14]/95
            light:from-[#FBF6EA]/98 light:via-[#EDE2C9]/98 light:to-[#FBF6EA]/98
            p-6 text-center shadow-[0_25px_90px_rgba(0,0,0,.55)]
          "
        >
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-300 transition hover:rotate-90 hover:border-orange-400/40 light:border-black/10 light:text-slate-600"
          >
            <X size={18} />
          </button>
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-amber-400/30 bg-amber-500/10">
            <UserX size={26} className="text-amber-300" />
          </div>
          <h2 className="mt-4 text-xl font-black text-white light:text-slate-900">
            Sign-ups are paused
          </h2>
          <p className="mt-2 text-sm text-slate-400 light:text-slate-600">
            InPlayer isn&apos;t accepting new accounts right now. Please check back soon.
          </p>
          <button
            type="button"
            onClick={openSignIn}
            className="mt-5 text-sm font-semibold text-orange-300 transition hover:text-orange-200 light:text-orange-600"
          >
            Already have an account? Sign In
          </button>
        </div>
      </div>
    );
  }

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
            max-h-[88vh] overflow-y-auto
            [scrollbar-width:none] [&::-webkit-scrollbar]:hidden
            rounded-[28px] sm:rounded-[30px]
            border border-orange-400/15 light:border-orange-400/25
            bg-gradient-to-br from-[#07111F]/95 via-[#0B1728]/95 to-[#040A14]/95
            light:from-[#FBF6EA]/98 light:via-[#EDE2C9]/98 light:to-[#FBF6EA]/98
            p-4 sm:p-5
            shadow-[0_25px_90px_rgba(0,0,0,.55)]
            light:shadow-[0_25px_90px_rgba(0,0,0,.18)]
            animate-modal-pop
            ${shake ? "animate-modal-shake" : ""}
          `}
        >
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
              Account Created!
            </h2>
            <p className="mt-1 text-sm text-slate-400 light:text-slate-600">
              Just one more step...
            </p>
          </div>
        ) : (
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

          <h2 className="mt-3 text-[26px] sm:text-[28px] font-black leading-none text-white light:text-slate-900">
            Create Your
            <br />
            Account.
          </h2>

          <p className="mt-1.5 text-sm text-slate-400 light:text-slate-600">
            Join InPlayer to save your favourites and get personalized recommendations.
          </p>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setAccountType("user")}
              className={`flex items-center justify-center gap-1.5 rounded-2xl border py-2.5 text-sm font-bold transition-all duration-300 ${
                accountType === "user"
                  ? "border-orange-400/50 bg-orange-500/15 text-orange-300 light:text-orange-700"
                  : "border-white/10 light:border-black/10 text-slate-400 light:text-slate-600 hover:border-white/20"
              }`}
            >
              <User size={15} /> Use InPlayer
            </button>
            <button
              type="button"
              onClick={() => setAccountType("vendor")}
              className={`flex items-center justify-center gap-1.5 rounded-2xl border py-2.5 text-sm font-bold transition-all duration-300 ${
                accountType === "vendor"
                  ? "border-orange-400/50 bg-orange-500/15 text-orange-300 light:text-orange-700"
                  : "border-white/10 light:border-black/10 text-slate-400 light:text-slate-600 hover:border-white/20"
              }`}
            >
              <Store size={15} /> Sell on Hammart
            </button>
          </div>

          {accountType === "vendor" && (
            <div className="mt-3 space-y-3 rounded-2xl border border-orange-400/15 bg-orange-500/[0.04] p-3">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setBusinessType("individual")}
                  className={`rounded-xl border py-2 text-xs font-bold transition ${
                    businessType === "individual"
                      ? "border-orange-400/50 bg-orange-500/15 text-orange-300 light:text-orange-700"
                      : "border-white/10 light:border-black/10 text-slate-400 light:text-slate-600"
                  }`}
                >
                  Individual Seller
                </button>
                <button
                  type="button"
                  onClick={() => setBusinessType("business")}
                  className={`rounded-xl border py-2 text-xs font-bold transition ${
                    businessType === "business"
                      ? "border-orange-400/50 bg-orange-500/15 text-orange-300 light:text-orange-700"
                      : "border-white/10 light:border-black/10 text-slate-400 light:text-slate-600"
                  }`}
                >
                  Registered Business
                </button>
              </div>

              {businessType === "business" && (
                <div>
                  <label className="mb-2 block text-xs font-medium text-slate-400 light:text-slate-600">
                    Business Name
                  </label>
                  <input
                    type="text"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    className="w-full rounded-2xl border border-white/10 light:border-black/10 bg-[#07111F] light:bg-black/[0.03] px-4 py-2.5 text-white light:text-slate-900 caret-orange-400 outline-none transition focus:border-orange-400/50"
                    placeholder="Your registered business name"
                  />
                </div>
              )}

              <div>
                <label className="mb-2 block text-xs font-medium text-slate-400 light:text-slate-600">
                  Vendor ID (your storefront address)
                </label>
                <div className="group relative">
                  <Store
                    size={15}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 light:text-slate-600"
                  />
                  <input
                    type="text"
                    value={vendorId}
                    onChange={(e) => setVendorId(e.target.value.toLowerCase())}
                    className="w-full rounded-2xl border border-white/10 light:border-black/10 bg-[#07111F] light:bg-black/[0.03] py-2.5 pl-10 pr-10 text-white light:text-slate-900 caret-orange-400 outline-none transition focus:border-orange-400/50"
                    placeholder="your-shop-name"
                  />
                  {vendorIdCheck.status === "checking" && (
                    <Loader2 size={15} className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-slate-400" />
                  )}
                  {vendorIdCheck.status === "available" && (
                    <CheckCircle2 size={15} className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-400" />
                  )}
                </div>
                {vendorIdCheck.status === "unavailable" && (
                  <p className="mt-1.5 text-[11px] text-red-400 light:text-red-600">{vendorIdCheck.reason}</p>
                )}
                {vendorIdCheck.status === "available" && (
                  <p className="mt-1.5 text-[11px] text-emerald-400 light:text-emerald-600">
                    inplayer.in/shop/{vendorId.trim()}
                  </p>
                )}
                <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
                  You&apos;ll complete business verification (KYC) after signing up, before you can publish listings.
                </p>
              </div>
            </div>
          )}

          <div className="mt-4 space-y-3">
            <div>
              <label className="mb-2 block text-xs font-medium text-slate-400 light:text-slate-600">
                Full Name
              </label>
              <div className="group relative">
                <User
                  size={17}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 light:text-slate-600 transition-colors duration-300 group-focus-within:text-orange-400"
                />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="
                    w-full rounded-2xl border border-white/10 light:border-black/10
                    bg-[#07111F] light:bg-black/[0.03]
                    py-2.5 pl-11 pr-10
                    text-white light:text-slate-900 caret-orange-400
                    outline-none transition-all duration-300
                    placeholder:text-slate-500 light:placeholder:text-slate-600
                    focus:border-orange-400/50 focus:shadow-[0_0_0_3px_rgba(249,115,22,.1)]
                  "
                  placeholder="Ram Kumar"
                />
                {nameValid && (
                  <CheckCircle2
                    size={17}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-400"
                  />
                )}
              </div>
            </div>

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
                    py-2.5 pl-11 pr-10
                    text-white light:text-slate-900 caret-orange-400
                    outline-none transition-all duration-300
                    placeholder:text-slate-500 light:placeholder:text-slate-600
                    focus:border-orange-400/50 focus:shadow-[0_0_0_3px_rgba(249,115,22,.1)]
                  "
                  placeholder="you@example.com"
                />
                {emailValid && (
                  <CheckCircle2
                    size={17}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-400"
                  />
                )}
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
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSignUp();
                  }}
                  className="
                    w-full rounded-2xl border border-white/10 light:border-black/10
                    bg-[#07111F] light:bg-black/[0.03]
                    py-2.5 pl-11 pr-4
                    text-white light:text-slate-900 caret-orange-400
                    outline-none transition-all duration-300
                    placeholder:text-slate-500 light:placeholder:text-slate-600
                    focus:border-orange-400/50 focus:shadow-[0_0_0_3px_rgba(249,115,22,.1)]
                  "
                  placeholder="At least 8 characters"
                />
              </div>

              {/* Live password strength meter */}
              {password && (
                <div className="mt-2">
                  <div className="flex gap-1.5">
                    {[1, 2, 3, 4].map((segment) => (
                      <div
                        key={segment}
                        className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                          segment <= strength.score
                            ? strength.color
                            : "bg-white/10 light:bg-black/10"
                        }`}
                      />
                    ))}
                  </div>
                  <p className="mt-1.5 text-[11px] text-slate-500">
                    {strength.label && (
                      <>
                        Password strength:{" "}
                        <span className="font-semibold">{strength.label}</span>
                      </>
                    )}
                  </p>
                </div>
              )}
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium text-slate-400 light:text-slate-600">
                Confirm Password
              </label>
              <div className="group relative">
                <Lock
                  size={17}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 light:text-slate-600 transition-colors duration-300 group-focus-within:text-orange-400"
                />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSignUp();
                  }}
                  className={`
                    w-full rounded-2xl border
                    bg-[#07111F] light:bg-black/[0.03]
                    py-2.5 pl-11 pr-10
                    text-white light:text-slate-900 caret-orange-400
                    outline-none transition-all duration-300
                    placeholder:text-slate-500 light:placeholder:text-slate-600
                    focus:shadow-[0_0_0_3px_rgba(249,115,22,.1)]
                    ${
                      passwordsMismatch
                        ? "border-red-500/40 focus:border-red-500/50"
                        : "border-white/10 light:border-black/10 focus:border-orange-400/50"
                    }
                  `}
                  placeholder="Re-enter your password"
                />
                {passwordsMatch && (
                  <CheckCircle2
                    size={17}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-400"
                  />
                )}
              </div>
              {passwordsMismatch && (
                <p className="mt-1.5 text-[11px] text-red-400 light:text-red-600">
                  Passwords don&apos;t match yet.
                </p>
              )}
              {passwordsMatch && (
                <p className="mt-1.5 flex items-center gap-1 text-[11px] text-emerald-400 light:text-emerald-600">
                  <CheckCircle2 size={12} /> Passwords match.
                </p>
              )}
            </div>

            <p className="text-center text-[11px] leading-relaxed text-slate-500 light:text-slate-600">
              By creating an account, you agree to InPlayer&apos;s{" "}
              <a
                href="/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-orange-300 light:text-orange-600 hover:underline"
              >
                Terms of Service
              </a>{" "}
              and{" "}
              <a
                href="/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-orange-300 light:text-orange-600 hover:underline"
              >
                Privacy Policy
              </a>
              .
            </p>

            {error && (
              <p className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300 light:text-red-700">
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={handleSignUp}
              disabled={loading}
              className="
                flex w-full items-center justify-center gap-2
                rounded-2xl bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A]
                py-3 font-bold text-white
                shadow-[0_15px_35px_rgba(255,153,0,.3)]
                transition-all duration-300
                hover:-translate-y-0.5 hover:shadow-[0_20px_45px_rgba(255,153,0,.4)]
                active:scale-[0.98]
                disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0
              "
            >
              {loading && <Loader2 size={18} className="animate-spin" />}
              {loading ? "Creating Account..." : "Create Account"}
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
              Already have an account?{" "}
              <button
                type="button"
                onClick={openSignIn}
                className="font-semibold text-orange-300 light:text-orange-600 transition hover:text-orange-200 light:hover:text-orange-700"
              >
                Sign In
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
