"use client";

import { Check, Sparkles, Crown } from "lucide-react";
import SettingsCard from "../common/SettingsCard";

const FREE_FEATURES = [
  "Unlimited streaming on InPlayer",
  "Standard-definition & HD playback",
  "Upload your own videos & Shorts",
  "Comment, like and subscribe",
];

const PREMIUM_FEATURES = [
  "Ad-free viewing across InPlayer",
  "4K Ultra HD & Lossless audio streaming",
  "Offline downloads on mobile",
  "Early access to Originals & Verticals",
  "Priority support",
];

export default function PlansSection() {
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
              <p className="mt-1 text-2xl font-black text-white light:text-slate-900">
                InPlayer Free
              </p>
            </div>

            <span className="rounded-full border border-white/15 light:border-black/15 bg-white/[0.05] light:bg-black/[0.04] px-3 py-1 text-xs font-semibold text-slate-300 light:text-slate-700">
              Active
            </span>
          </div>

          <ul className="mt-5 space-y-3">
            {FREE_FEATURES.map((feature) => (
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
        </div>
      </SettingsCard>
    </div>
  );
}
