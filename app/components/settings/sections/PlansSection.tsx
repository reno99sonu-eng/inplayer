"use client";

import { Check, Sparkles, Crown, Loader2 } from "lucide-react";
import SettingsCard from "../common/SettingsCard";
import { usePremium } from "@/app/hooks/usePremium";

// Was entirely static: it always said "InPlayer Free / Active" regardless of
// the account, and listed Premium benefits none of which were enforced
// anywhere. Now it reads the real tier (/api/premium/me) and the feature
// lists describe what the code actually does — the 4K/1080p split is
// genuinely enforced at the player (see app/lib/premium.ts and the
// maxResolution prop in VideoPlayer.tsx).

// Only claims that are actually true today.
const FREE_FEATURES = [
  "Unlimited streaming on InPlayer",
  "Video quality up to 1080p (Full HD)",
  "Upload your own videos & Shorts",
  "Comment, like and subscribe",
];

// Enforced: effectiveMaxResolution() in app/lib/premium.ts caps the Mux
// rendition ladder per tier. Deliberately does NOT promise ad-free viewing,
// offline downloads, lossless audio or early access — none of those are
// built, and listing them on a paid tier would be selling something that
// doesn't exist.
const PREMIUM_FEATURES = [
  "Video quality up to 4K Ultra HD (2160p)",
  "2K (1440p) streaming on supported videos",
  "Everything in InPlayer Free",
];

export default function PlansSection() {
  const { premium, premiumUntil, ready } = usePremium();

  const renewalLabel = premiumUntil
    ? new Date(premiumUntil).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <div className="space-y-6">
      <SettingsCard
        icon={<Crown size={24} />}
        title="Plans & Purchases"
        description="Manage your InPlayer membership."
      >
        <div className="rounded-2xl border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.03] p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 light:text-slate-600">
                Current Plan
              </p>
              <p className="mt-1 flex items-center gap-2 text-2xl font-black text-white light:text-slate-900">
                {!ready && <Loader2 size={18} className="animate-spin text-slate-500" />}
                {ready ? (premium ? "InPlayer Premium" : "InPlayer Free") : "Checking\u2026"}
              </p>
              {ready && premium && renewalLabel && (
                <p className="mt-1 text-xs text-slate-400 light:text-slate-600">
                  Premium until {renewalLabel}
                </p>
              )}
            </div>

            <span
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                ready && premium
                  ? "border-orange-400/40 bg-orange-500/15 text-orange-300"
                  : "border-white/15 light:border-black/15 bg-white/[0.05] light:bg-black/[0.04] text-slate-300 light:text-slate-700"
              }`}
            >
              Active
            </span>
          </div>

          <ul className="mt-5 space-y-3">
            {(ready && premium ? PREMIUM_FEATURES : FREE_FEATURES).map((feature) => (
              <li
                key={feature}
                className="flex items-center gap-3 text-sm text-slate-300 light:text-slate-700"
              >
                <Check size={16} className="shrink-0 text-slate-400 light:text-slate-600" />
                {feature}
              </li>
            ))}
          </ul>
        </div>
      </SettingsCard>

      <SettingsCard
        icon={<Sparkles size={24} />}
        title="InPlayer Premium"
        description="Unlock the full InPlayer experience."
      >
        <div className="rounded-2xl border border-orange-400/20 bg-gradient-to-br from-orange-500/[0.06] to-transparent p-5">
          <ul className="space-y-3">
            {PREMIUM_FEATURES.map((feature) => (
              <li
                key={feature}
                className="flex items-center gap-3 text-sm text-slate-200 light:text-slate-800"
              >
                <Check size={16} className="shrink-0 text-orange-300" />
                {feature}
              </li>
            ))}
          </ul>

          {ready && premium ? (
            <p className="mt-6 rounded-xl border border-orange-400/20 bg-orange-500/[0.08] py-3 text-center text-sm font-semibold text-orange-200">
              Premium is active on your account
            </p>
          ) : (
            <>
              {/* Still honest: nothing charges anyone yet. The difference from
                  before is that the TIER is real — the quality cap above is
                  enforced today — so this is "you can't buy it yet", not
                  "none of this exists". */}
              <button
                type="button"
                disabled
                className="
                  mt-6
                  w-full
                  cursor-not-allowed
                  rounded-xl
                  border
                  border-white/10 light:border-black/10
                  bg-white/[0.04] light:bg-black/[0.04]
                  py-3
                  text-sm
                  font-semibold
                  text-slate-400 light:text-slate-600
                "
              >
                Premium billing launches soon
              </button>

              <p className="mt-3 text-center text-xs text-slate-500 light:text-slate-600">
                We&apos;ll let you know the moment it&apos;s ready — no action
                needed from you.
              </p>
            </>
          )}
        </div>
      </SettingsCard>
    </div>
  );
}
