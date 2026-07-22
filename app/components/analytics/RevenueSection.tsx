"use client";

import { useState } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import {
  IndianRupee,
  Users,
  Eye,
  CheckCircle2,
  Clock,
  Loader2,
  Landmark,
} from "lucide-react";
import { ELIGIBILITY_THRESHOLD, PAYOUT_FREQUENCIES, PayoutFrequency } from "@/app/lib/creatorPayouts";
import KycForm from "./KycForm";

export interface PayoutStatus {
  kycStatus: "not_started" | "pending_review" | "verified";
  payoutFrequency: string | null;
  legalName: string | null;
  submittedAt: string | null;
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-white/5 light:bg-black/5">
      <div
        className="h-full rounded-full bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] transition-all duration-700"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export default function RevenueSection({
  contentLabel,
  subscriberCount,
  totalViews,
  payoutStatus,
  loading,
  onStatusChange,
}: {
  contentLabel: string;
  subscriberCount: number;
  totalViews: number;
  payoutStatus: PayoutStatus | null;
  loading: boolean;
  onStatusChange: (next: PayoutStatus) => void;
}) {
  const [showKycForm, setShowKycForm] = useState(false);
  const [updatingFrequency, setUpdatingFrequency] = useState(false);

  const meetsThreshold =
    subscriberCount >= ELIGIBILITY_THRESHOLD.subscribers &&
    totalViews >= ELIGIBILITY_THRESHOLD.views;

  const handleFrequencyChange = async (freq: PayoutFrequency) => {
    if (!payoutStatus) return;
    setUpdatingFrequency(true);
    try {
      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken?.toString();
      const res = await fetch("/api/creator/kyc", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ action: "update_frequency", payoutFrequency: freq }),
      });
      if (res.ok) {
        onStatusChange({ ...payoutStatus, payoutFrequency: freq });
      }
    } catch (err) {
      console.error("Failed to update payout frequency:", err);
    } finally {
      setUpdatingFrequency(false);
    }
  };

  return (
    <div
      className="
        rounded-2xl border border-white/10 light:border-black/10
        bg-gradient-to-br from-white/[0.03] to-transparent light:from-black/[0.02]
        p-4 sm:p-5
      "
    >
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-orange-500/20 to-amber-400/10 text-orange-400">
          <IndianRupee size={16} />
        </div>
        <h3 className="text-sm font-bold text-white light:text-slate-900">
          {contentLabel} revenue
        </h3>
      </div>

      {loading || !payoutStatus ? (
        <div className="mt-4 flex items-center justify-center py-10 text-slate-500">
          <Loader2 size={20} className="animate-spin" />
        </div>
      ) : payoutStatus.kycStatus === "verified" ? (
        <div className="mt-4 space-y-4">
          <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/[0.06] px-3 py-2.5">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
              <CheckCircle2 size={14} /> Verified — revenue tracking is live for {payoutStatus.legalName}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 light:border-black/10 bg-white/[0.02] light:bg-black/[0.015] p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500">
              Available balance
            </p>
            <p className="mt-1 text-3xl font-black text-white light:text-slate-900">₹0.00</p>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-500 light:text-slate-500">
              Your balance updates once ad/revenue-share is connected on
              InPlayer's side — the payout pipeline itself is ready and
              waiting for that switch to flip on.
            </p>
          </div>

          <div>
            <p className={`mb-1.5 text-xs font-semibold text-slate-400 light:text-slate-600`}>
              Payout frequency
            </p>
            <div className="grid grid-cols-4 gap-1.5">
              {PAYOUT_FREQUENCIES.map((f) => (
                <button
                  key={f}
                  disabled={updatingFrequency}
                  onClick={() => handleFrequencyChange(f)}
                  className={`
                    rounded-xl px-2 py-2 text-xs font-semibold capitalize transition-all duration-300 disabled:opacity-60
                    ${
                      payoutStatus.payoutFrequency === f
                        ? "bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] text-white"
                        : "border border-white/10 light:border-black/10 text-slate-400 light:text-slate-600 hover:bg-white/5 light:hover:bg-black/5"
                    }
                  `}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <button
            disabled
            title="Connect a Razorpay account to enable this"
            className="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 light:border-black/15 py-2.5 text-sm font-semibold text-slate-500 light:text-slate-500"
          >
            <Landmark size={16} />
            Connect bank account via Razorpay — coming soon
          </button>
        </div>
      ) : payoutStatus.kycStatus === "pending_review" ? (
        <div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-500/[0.06] px-3 py-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-400">
            <Clock size={14} /> KYC submitted — under review
          </p>
          <p className="mt-1 text-xs leading-relaxed text-slate-400 light:text-slate-600">
            We'll unlock live revenue tracking for {payoutStatus.legalName} as
            soon as this is verified.
          </p>
        </div>
      ) : meetsThreshold ? (
        showKycForm ? (
          <KycForm
            onSubmitted={() =>
              onStatusChange({
                kycStatus: "pending_review",
                payoutFrequency: payoutStatus.payoutFrequency,
                legalName: payoutStatus.legalName,
                submittedAt: new Date().toISOString(),
              })
            }
          />
        ) : (
          <div className="mt-4 rounded-xl border border-orange-400/20 bg-orange-500/[0.06] px-3 py-3">
            <p className="flex items-center gap-1.5 text-sm font-bold text-orange-300 light:text-orange-700">
              <CheckCircle2 size={16} /> You've unlocked monetization
            </p>
            <p className="mt-1 text-xs leading-relaxed text-slate-400 light:text-slate-600">
              You're past {ELIGIBILITY_THRESHOLD.subscribers} In-Family members
              and {ELIGIBILITY_THRESHOLD.views.toLocaleString()} views. Complete
              a short KYC to start generating revenue.
            </p>
            <button
              onClick={() => setShowKycForm(true)}
              className="mt-3 rounded-2xl bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] px-5 py-2 text-xs font-bold text-white shadow-[0_10px_25px_rgba(255,153,0,.3)] transition-all hover:-translate-y-0.5"
            >
              Start KYC
            </button>
          </div>
        )
      ) : (
        <div className="mt-4 space-y-4">
          <p className="text-xs text-slate-500 light:text-slate-500">
            Reach {ELIGIBILITY_THRESHOLD.subscribers} In-Family members and{" "}
            {ELIGIBILITY_THRESHOLD.views.toLocaleString()} views to unlock
            monetization for {contentLabel.toLowerCase()}.
          </p>

          <div>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-semibold text-slate-300 light:text-slate-700">
                <Users size={13} /> In-Family members
              </span>
              <span className="text-slate-500">
                {subscriberCount.toLocaleString()} / {ELIGIBILITY_THRESHOLD.subscribers.toLocaleString()}
              </span>
            </div>
            <ProgressBar value={subscriberCount} max={ELIGIBILITY_THRESHOLD.subscribers} />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-semibold text-slate-300 light:text-slate-700">
                <Eye size={13} /> Total views
              </span>
              <span className="text-slate-500">
                {totalViews.toLocaleString()} / {ELIGIBILITY_THRESHOLD.views.toLocaleString()}
              </span>
            </div>
            <ProgressBar value={totalViews} max={ELIGIBILITY_THRESHOLD.views} />
          </div>
        </div>
      )}
    </div>
  );
}
