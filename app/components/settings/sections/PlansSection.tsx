"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, ArrowLeft, Check, Crown, Loader2, Sparkles } from "lucide-react";
import SettingsCard from "../common/SettingsCard";
import { usePremium, invalidatePremiumCache } from "@/app/hooks/usePremium";
import { useAuthModal } from "@/app/components/auth/AuthProvider";
import { authedFetch } from "@/app/lib/apiFetch";
import {
  loadRazorpayCheckoutScript,
  openPremiumCheckout,
  pollPremiumActivation,
} from "@/app/lib/premiumCheckoutClient";
import {
  FREE_BENEFITS,
  PREMIUM_BENEFITS,
  type PremiumPlanId,
} from "@/app/lib/premiumPlans";

// Premium, actually purchasable.
//
// This card used to end in a disabled "Premium billing launches soon"
// button. The tier itself was real — the 4K/1080p split is enforced at the
// player by effectiveMaxResolution() — there was just no way to buy it.
// Now there is: a real one-time Razorpay Order, granted by the signed
// payment.captured webhook (app/api/webhooks/razorpay), never by anything
// the browser says.
//
// WHERE THE PRICE APPEARS: only after a plan is chosen. Reno's rule, the
// same one the sponsorship page follows — benefits are public, the figure
// shows up when you actually go to buy. GET /api/premium/plans enforces
// that server-side too by withholding amountInr from signed-out callers,
// so it isn't merely hidden in the markup.

type PlanRow = {
  planId: PremiumPlanId;
  label: string;
  cadence: string;
  durationDays: number;
  badge?: string;
  amountInr?: number;
};

type Stage = "browse" | "confirm" | "paying" | "activating" | "active" | "pending" | "error";

export default function PlansSection() {
  const { premium, premiumUntil, ready } = usePremium();
  const { signedIn, openSignIn, user } = useAuthModal();

  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [premiumBenefits, setPremiumBenefits] = useState<string[]>(PREMIUM_BENEFITS);
  const [freeBenefits, setFreeBenefits] = useState<string[]>(FREE_BENEFITS);

  const [stage, setStage] = useState<Stage>("browse");
  const [chosen, setChosen] = useState<PlanRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [grantedUntil, setGrantedUntil] = useState<string | null>(null);

  // Refetched when the session changes so a just-signed-in member has the
  // real amountInr in memory by the time they reach the confirm step.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = signedIn
          ? await authedFetch("/api/premium/plans")
          : await fetch("/api/premium/plans");
        const data = await res.json().catch(() => ({}));
        if (cancelled || !res.ok) return;
        if (Array.isArray(data.plans)) setPlans(data.plans);
        if (Array.isArray(data.premiumBenefits)) setPremiumBenefits(data.premiumBenefits);
        if (Array.isArray(data.freeBenefits)) setFreeBenefits(data.freeBenefits);
      } catch (err) {
        console.error("Couldn't load Premium plans:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [signedIn]);

  const formatDate = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleDateString(undefined, {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : null;

  const choosePlan = (plan: PlanRow) => {
    if (!signedIn) {
      openSignIn();
      return;
    }
    setChosen(plan);
    setError(null);
    setStage("confirm");
  };

  const pay = async () => {
    if (!chosen) return;
    setError(null);
    setStage("paying");

    try {
      const res = await authedFetch("/api/premium/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: chosen.planId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Couldn't start payment right now.");

      await loadRazorpayCheckoutScript();
      const outcome = await openPremiumCheckout({
        razorpayOrderId: data.razorpayOrderId,
        razorpayKeyId: data.razorpayKeyId,
        planLabel: data.planLabel || chosen.label,
        name: user?.name,
        email: user?.email,
      });

      if (outcome === "unavailable") {
        throw new Error("Payments aren't available right now. Please try again shortly.");
      }
      if (outcome === "dismissed") {
        setStage("confirm");
        setError("Payment was closed before finishing — nothing was charged.");
        return;
      }

      // Gateway accepted it. Premium only becomes real once the webhook
      // writes premiumUntil, so wait for the account to actually say so.
      setStage("activating");
      const result = await pollPremiumActivation({ authedFetch });

      // Any tier change has to bust the module-level cache in usePremium,
      // otherwise the player and every other consumer keep serving the
      // pre-purchase answer for the rest of the session.
      invalidatePremiumCache();

      if (result === "active") {
        const meRes = await authedFetch("/api/premium/me");
        const me = await meRes.json().catch(() => ({}));
        setGrantedUntil(me?.premiumUntil || null);
        setStage("active");
      } else {
        setStage("pending");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setStage("error");
    }
  };

  const currentlyPremium = ready && premium;
  const renewalLabel = formatDate(premiumUntil);

  return (
    <div className="space-y-6">
      {/* ── Current plan ─────────────────────────────────────────────── */}
      <SettingsCard
        icon={<Crown size={24} />}
        title="Plans & Purchases"
        description="Manage your InPlayer membership."
      >
        <div className="rounded-2xl border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.03] p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 light:text-slate-600">
                Current Plan
              </p>
              <p className="mt-1 flex items-center gap-2 text-2xl font-black text-white light:text-slate-900">
                {!ready && <Loader2 size={18} className="animate-spin text-slate-500" />}
                {ready ? (premium ? "InPlayer Premium" : "InPlayer Free") : "Checking…"}
              </p>
              {currentlyPremium && renewalLabel && (
                <p className="mt-1 text-xs text-slate-400 light:text-slate-600">
                  Premium until {renewalLabel}
                </p>
              )}
            </div>

            <span
              className={`flex-shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${
                currentlyPremium
                  ? "border-orange-400/40 bg-orange-500/15 text-orange-300"
                  : "border-white/15 light:border-black/15 bg-white/[0.05] light:bg-black/[0.04] text-slate-300 light:text-slate-700"
              }`}
            >
              Active
            </span>
          </div>

          <ul className="mt-5 space-y-3">
            {(currentlyPremium ? premiumBenefits : freeBenefits).map((feature) => (
              <li
                key={feature}
                className="flex items-start gap-3 text-sm text-slate-300 light:text-slate-700"
              >
                <Check size={16} className="mt-0.5 shrink-0 text-slate-400 light:text-slate-600" />
                {feature}
              </li>
            ))}
          </ul>
        </div>
      </SettingsCard>

      {/* ── Buy / manage Premium ─────────────────────────────────────── */}
      <SettingsCard
        icon={<Sparkles size={24} />}
        title="InPlayer Premium"
        description="Unlock the full InPlayer experience."
      >
        <div className="rounded-2xl border border-orange-400/20 bg-gradient-to-br from-orange-500/[0.06] to-transparent p-5">
          <ul className="space-y-3">
            {premiumBenefits.map((feature) => (
              <li
                key={feature}
                className="flex items-start gap-3 text-sm text-slate-200 light:text-slate-800"
              >
                <Check size={16} className="mt-0.5 shrink-0 text-orange-300 light:text-orange-600" />
                {feature}
              </li>
            ))}
          </ul>

          {currentlyPremium && stage !== "active" ? (
            <div className="mt-6 space-y-3">
              <p className="rounded-xl border border-orange-400/20 bg-orange-500/[0.08] py-3 text-center text-sm font-semibold text-orange-200 light:text-orange-800">
                Premium is active on your account
                {renewalLabel ? ` until ${renewalLabel}` : ""}
              </p>
              {/* Extending is allowed — grantPremiumFromPayment adds time to
                  the END of what's left rather than overwriting it, so a
                  member who buys again never loses remaining days. */}
              {stage === "browse" && (
                <PlanGrid plans={plans} onChoose={choosePlan} label="Add more time" />
              )}
              {stage !== "browse" && (
                <CheckoutPanel
                  stage={stage}
                  chosen={chosen}
                  error={error}
                  grantedUntil={formatDate(grantedUntil)}
                  onBack={() => {
                    setStage("browse");
                    setError(null);
                  }}
                  onPay={pay}
                />
              )}
            </div>
          ) : (
            <div className="mt-6">
              {stage === "browse" && (
                <>
                  <PlanGrid
                    plans={plans}
                    onChoose={choosePlan}
                    label={signedIn ? "Choose a plan" : "Sign in to see pricing"}
                  />
                  <p className="mt-3 text-center text-xs text-slate-500 light:text-slate-600">
                    Pricing is shown at checkout. One payment — nothing recurring,
                    no card stored, no auto-renewal.
                  </p>
                </>
              )}

              {stage !== "browse" && (
                <CheckoutPanel
                  stage={stage}
                  chosen={chosen}
                  error={error}
                  grantedUntil={formatDate(grantedUntil)}
                  onBack={() => {
                    setStage("browse");
                    setError(null);
                  }}
                  onPay={pay}
                />
              )}
            </div>
          )}
        </div>
      </SettingsCard>
    </div>
  );
}

// The public face: plan names and cadence, never a figure.
function PlanGrid({
  plans,
  onChoose,
  label,
}: {
  plans: PlanRow[];
  onChoose: (plan: PlanRow) => void;
  label: string;
}) {
  if (plans.length === 0) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 size={18} className="animate-spin text-slate-500" />
      </div>
    );
  }

  return (
    <div>
      <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-slate-500 light:text-slate-600">
        {label}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {plans.map((plan) => (
          <button
            key={plan.planId}
            type="button"
            onClick={() => onChoose(plan)}
            className="
              group flex flex-col items-start rounded-2xl border border-white/10 bg-white/[0.04]
              p-4 text-left transition-all duration-300
              hover:-translate-y-0.5 hover:border-orange-400/40 hover:bg-white/[0.07]
              light:border-black/10 light:bg-black/[0.03] light:hover:bg-black/[0.05]
            "
          >
            <span className="flex w-full items-center justify-between gap-2">
              <span className="text-base font-black text-white light:text-slate-900">
                {plan.label}
              </span>
              {plan.badge && (
                <span className="rounded-full bg-orange-500/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-orange-300 light:text-orange-700">
                  {plan.badge}
                </span>
              )}
            </span>
            <span className="mt-1 text-xs leading-5 text-slate-400 light:text-slate-600">
              {plan.cadence}
            </span>
            <span className="mt-3 text-xs font-bold text-orange-300 light:text-orange-600">
              Continue — see price →
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// Everything after a plan is picked: the one place the price is allowed to
// be on screen, then the payment / activation / result states.
function CheckoutPanel({
  stage,
  chosen,
  error,
  grantedUntil,
  onBack,
  onPay,
}: {
  stage: Stage;
  chosen: PlanRow | null;
  error: string | null;
  grantedUntil: string | null;
  onBack: () => void;
  onPay: () => void;
}) {
  if (stage === "activating") {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center">
        <Loader2 size={26} className="animate-spin text-orange-400" />
        <p className="text-sm font-bold text-white light:text-slate-900">
          Confirming your payment…
        </p>
        <p className="text-xs text-slate-400 light:text-slate-600">
          This usually takes a few seconds.
        </p>
      </div>
    );
  }

  if (stage === "active") {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center">
        <Check size={26} className="text-emerald-400" />
        <p className="text-sm font-bold text-white light:text-slate-900">
          You&apos;re on InPlayer Premium
        </p>
        <p className="text-xs text-slate-400 light:text-slate-600">
          {grantedUntil ? `Active until ${grantedUntil}.` : "Your account has been upgraded."}{" "}
          4K and 2K unlock the next time a video loads.
        </p>
      </div>
    );
  }

  if (stage === "pending") {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center">
        <Loader2 size={26} className="animate-spin text-orange-400" />
        <p className="text-sm font-bold text-white light:text-slate-900">
          Payment received — finishing up
        </p>
        <p className="text-xs text-slate-400 light:text-slate-600">
          Your bank has confirmed it but our side is still catching up. Premium
          will switch on by itself within a few minutes — nothing else to do.
        </p>
        <button
          type="button"
          onClick={onBack}
          className="mt-2 text-xs font-semibold text-orange-300 hover:text-orange-200"
        >
          Back to plans
        </button>
      </div>
    );
  }

  const busy = stage === "paying";

  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        disabled={busy}
        className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-slate-400 transition hover:-translate-x-1 hover:text-white disabled:opacity-50 light:text-slate-600 light:hover:text-slate-900"
      >
        <ArrowLeft size={14} /> Back to plans
      </button>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 light:border-black/10 light:bg-black/[0.03]">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3 light:border-black/10">
          <div>
            <p className="text-sm font-black text-white light:text-slate-900">
              InPlayer Premium · {chosen?.label}
            </p>
            <p className="text-xs text-slate-400 light:text-slate-600">
              {chosen?.durationDays} days from the moment it activates
            </p>
          </div>
          <p className="text-2xl font-black text-white light:text-slate-900">
            {chosen?.amountInr === undefined
              ? "—"
              : `₹${chosen.amountInr.toLocaleString("en-IN")}`}
          </p>
        </div>

        {error && (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs font-semibold text-red-300 light:text-red-800">
            <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="button"
          onClick={onPay}
          disabled={busy}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] py-3 text-sm font-black text-white shadow-lg transition-all duration-300 hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy && <Loader2 size={16} className="animate-spin" />}
          {busy
            ? "Opening payment gateway…"
            : chosen?.amountInr === undefined
              ? "Continue to payment"
              : `Pay ₹${chosen.amountInr.toLocaleString("en-IN")}`}
        </button>

        <p className="mt-2 text-center text-[11px] leading-4 text-slate-500">
          One payment. Nothing is stored or charged again — buy more time
          whenever you want it.
        </p>
      </div>
    </div>
  );
}
