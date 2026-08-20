"use client";

import { useState, useEffect } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import {
  IndianRupee,
  Users,
  Eye,
  CheckCircle2,
  Clock,
  Loader2,
  Landmark,
  Check,
  AlertTriangle,
  PlaySquare,
  Music2,
} from "lucide-react";
import {
  PAYOUT_FREQUENCIES,
  PayoutFrequency,
  MIN_PAYOUT_AMOUNT_DEFAULT,
  MIN_PAYOUT_AMOUNT_BOUNDS,
  MEMBERSHIP_PRICE_INR,
  calculateRevenueBalance,
  getNextPayoutWindow,
} from "@/app/lib/creatorPayouts";
import KycForm from "./KycForm";

function formatInr(amount: number) {
  return amount.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export interface PayoutStatus {
  kycStatus: "not_started" | "pending_review" | "verified" | "rejected";
  payoutFrequency: string | null;
  legalName: string | null;
  submittedAt: string | null;
  minPayoutAmount?: number;
  // Set only when kycStatus is "rejected" — the admin's reason, shown back
  // to the creator so a resubmission actually fixes what was wrong (see
  // app/admin/creators).
  rejectionReason?: string | null;
  // Real money, credited by app/api/webhooks/razorpay on every confirmed
  // paid-membership charge — not a views-based estimate.
  lifetimeEarnedInr?: number;
  lifetimePaidOutInr?: number;
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
  const [amountDraft, setAmountDraft] = useState(
    String(payoutStatus?.minPayoutAmount || MIN_PAYOUT_AMOUNT_DEFAULT)
  );
  const [savingAmount, setSavingAmount] = useState(false);
  const [amountError, setAmountError] = useState<string | null>(null);
  const [amountSaved, setAmountSaved] = useState(false);

  const [monetizeData, setMonetizeData] = useState<any>(null);
  const [monetizeLoading, setMonetizeLoading] = useState(true);
  const [activating, setActivating] = useState(false);

  useEffect(() => {
    async function fetchStatus() {
      try {
        const session = await fetchAuthSession();
        const idToken = session.tokens?.idToken?.toString();
        if (!idToken) return;
        const res = await fetch("/api/creator/monetize/status", {
          headers: { Authorization: `Bearer ${idToken}` }
        });
        if (res.ok) {
          const data = await res.json();
          setMonetizeData(data);
        }
      } catch (err) {
        console.error("Failed to fetch monetization status", err);
      } finally {
        setMonetizeLoading(false);
      }
    }
    fetchStatus();
  }, []);

  const handleActivateMonetization = async () => {
    setActivating(true);
    try {
      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken?.toString();
      const res = await fetch("/api/creator/monetize/activate", {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}` }
      });
      if (res.ok) {
        setMonetizeData((prev: any) => ({
          ...prev,
          state: { ...prev?.state, status: "MONETIZED" }
        }));
      }
    } catch (err) {
      console.error("Failed to activate monetization", err);
    } finally {
      setActivating(false);
    }
  };

  // Real number now: lifetimeEarnedInr is credited by the Razorpay webhook
  // handler on every confirmed paid-membership charge (this creator's 80%
  // share of each ₹{MEMBERSHIP_PRICE_INR} monthly charge) — not a
  // views-based estimate. `lifetimePaidOutInr` stays 0 until a live
  // transfer path exists (see the disabled "Connect bank account" button
  // below), so today lifetime accrued revenue and current balance are the
  // same number only until a real payout goes out.
  const revenueBalance = calculateRevenueBalance(
    payoutStatus?.lifetimeEarnedInr || 0,
    payoutStatus?.lifetimePaidOutInr || 0
  );
  const minPayoutAmount = payoutStatus?.minPayoutAmount || MIN_PAYOUT_AMOUNT_DEFAULT;
  const meetsPayoutThreshold = revenueBalance >= minPayoutAmount;
  const payoutWindow = getNextPayoutWindow();

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
        body: JSON.stringify({ action: "update_payout_prefs", payoutFrequency: freq }),
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

  const handleAmountSave = async () => {
    if (!payoutStatus) return;
    const amount = Number(amountDraft);

    if (
      !Number.isFinite(amount) ||
      amount < MIN_PAYOUT_AMOUNT_BOUNDS.min ||
      amount > MIN_PAYOUT_AMOUNT_BOUNDS.max
    ) {
      setAmountError(
        `Enter an amount between ₹${MIN_PAYOUT_AMOUNT_BOUNDS.min} and ₹${MIN_PAYOUT_AMOUNT_BOUNDS.max.toLocaleString()}.`
      );
      return;
    }

    setAmountError(null);
    setSavingAmount(true);
    try {
      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken?.toString();
      const res = await fetch("/api/creator/kyc", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ action: "update_payout_prefs", minPayoutAmount: amount }),
      });
      if (res.ok) {
        onStatusChange({ ...payoutStatus, minPayoutAmount: amount });
        setAmountSaved(true);
        setTimeout(() => setAmountSaved(false), 2000);
      } else {
        const data = await res.json().catch(() => ({}));
        setAmountError(data.error || "Couldn't save that right now.");
      }
    } catch (err) {
      console.error("Failed to update minimum payout amount:", err);
      setAmountError("Couldn't save that right now.");
    } finally {
      setSavingAmount(false);
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
  Revenue &amp; KYC
</h3>
      </div>

      {loading || monetizeLoading || !payoutStatus || !monetizeData ? (
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
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500">
                  Available balance
                </p>
                <p className="mt-1 text-3xl font-black text-white light:text-slate-900">
                  ₹{formatInr(revenueBalance)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">
                  Next payout window
                </p>
                <p
                  className={`mt-1 text-xs font-bold ${
                    payoutWindow.isOpenNow
                      ? "text-emerald-400"
                      : "text-slate-300 light:text-slate-700"
                  }`}
                >
                  {payoutWindow.label}
                </p>
              </div>
            </div>
            <p className="mt-2.5 text-xs leading-relaxed text-slate-500 light:text-slate-600">
              Your {Math.round((monetizeData?.eligibility?.thresholds?.revenueShare || 0.8) * 100)}% share of every paid
              InPlayer membership (₹{MEMBERSHIP_PRICE_INR}/month per member) —{" "}
              {meetsPayoutThreshold
                ? `you're over your ₹${minPayoutAmount.toLocaleString("en-IN")} minimum, so this queues for transfer in the payout window above`
                : `queues for transfer once it crosses your ₹${minPayoutAmount.toLocaleString("en-IN")} minimum below`}
              . Actually moving money still needs a connected bank account
              (Razorpay, below) — that switch has not been flipped on yet,
              so no transfer goes out until then.
            </p>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-semibold text-slate-400 light:text-slate-600">
              Payout frequency — how often
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

          <div>
            <p className="mb-1.5 text-xs font-semibold text-slate-400 light:text-slate-600">
              Minimum payout amount — how much
            </p>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">
                  ₹
                </span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={MIN_PAYOUT_AMOUNT_BOUNDS.min}
                  max={MIN_PAYOUT_AMOUNT_BOUNDS.max}
                  value={amountDraft}
                  onChange={(e) => setAmountDraft(e.target.value)}
                  className="w-full rounded-xl border border-white/10 light:border-black/10 bg-[#07111F] light:bg-[#FAF5E9] py-2.5 pl-7 pr-3 text-sm text-white light:text-slate-900 outline-none transition focus:border-orange-400/50"
                />
              </div>
              <button
                onClick={handleAmountSave}
                disabled={savingAmount}
                className="flex flex-shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] px-4 py-2.5 text-xs font-bold text-white transition disabled:opacity-60"
              >
                {savingAmount ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : amountSaved ? (
                  <Check size={14} />
                ) : null}
                {savingAmount ? "Saving" : amountSaved ? "Saved" : "Save"}
              </button>
            </div>
            {amountError && (
              <p className="mt-1.5 text-[11px] text-red-400">{amountError}</p>
            )}
            <p className="mt-1.5 text-[11px] text-slate-500">
              We&apos;ll hold your balance until it reaches this amount, then pay
              it out on your chosen frequency above.
            </p>
          </div>

          <button
            disabled
            title="Connect a Razorpay account to enable this"
            className="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 light:border-black/15 py-2.5 text-sm font-semibold text-slate-500 light:text-slate-600"
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
            A real person on the InPlayer team is reviewing what{" "}
            {payoutStatus.legalName} submitted — we&apos;ll unlock live revenue
            tracking as soon as it&apos;s approved.
          </p>
        </div>
      ) : payoutStatus.kycStatus === "rejected" ? (
        showKycForm ? (
          <KycForm
            rejectionReason={payoutStatus.rejectionReason}
            onSubmitted={() =>
              onStatusChange({
                kycStatus: "pending_review",
                payoutFrequency: payoutStatus.payoutFrequency,
                legalName: payoutStatus.legalName,
                submittedAt: new Date().toISOString(),
                rejectionReason: null,
              })
            }
          />
        ) : (
          <div className="mt-4 rounded-xl border border-red-500/25 bg-red-500/[0.06] px-3 py-3">
            <p className="flex items-center gap-1.5 text-sm font-bold text-red-300 light:text-red-700">
              <AlertTriangle size={16} /> KYC wasn&apos;t approved
            </p>
            {payoutStatus.rejectionReason && (
              <p className="mt-1 text-xs leading-relaxed text-slate-400 light:text-slate-600">
                &quot;{payoutStatus.rejectionReason}&quot;
              </p>
            )}
            <button
              onClick={() => setShowKycForm(true)}
              className="mt-3 rounded-2xl bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] px-5 py-2 text-xs font-bold text-white shadow-[0_10px_25px_rgba(255,153,0,.3)] transition-all hover:-translate-y-0.5"
            >
              Resubmit KYC
            </button>
          </div>
        )
      ) : monetizeData?.state?.status === "MONETIZED" ? (
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
              <CheckCircle2 size={16} /> Monetization Active
            </p>
            <p className="mt-1 text-xs leading-relaxed text-slate-400 light:text-slate-600">
              You are now earning revenue from memberships! Complete a short KYC to set up your bank account payouts.
            </p>
            <button
              onClick={() => setShowKycForm(true)}
              className="mt-3 rounded-2xl bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] px-5 py-2 text-xs font-bold text-white shadow-[0_10px_25px_rgba(255,153,0,.3)] transition-all hover:-translate-y-0.5"
            >
              Start KYC
            </button>
          </div>
        )
      ) : monetizeData?.state?.status === "ELIGIBLE" ? (
        <div className="mt-4 rounded-xl border border-orange-400/20 bg-orange-500/[0.06] px-3 py-3">
          <p className="flex items-center gap-1.5 text-sm font-bold text-orange-300 light:text-orange-700">
            <CheckCircle2 size={16} /> You're Eligible for Monetization!
          </p>
          <p className="mt-1 text-xs leading-relaxed text-slate-400 light:text-slate-600">
            You've reached the required milestones. Activate monetization to start earning your {Math.round((monetizeData?.eligibility?.thresholds?.revenueShare || 0.8) * 100)}% share of membership fees.
          </p>
          <button
            onClick={handleActivateMonetization}
            disabled={activating}
            className="mt-3 rounded-2xl bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] px-5 py-2 text-xs font-bold text-white shadow-[0_10px_25px_rgba(255,153,0,.3)] transition-all hover:-translate-y-0.5 disabled:opacity-60"
          >
            {activating ? "Activating..." : "Activate Monetization"}
          </button>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <p className="text-xs text-slate-500 light:text-slate-600">
            Monetization unlocks automatically when you reach {monetizeData?.eligibility?.thresholds?.subscribers?.toLocaleString() || 500} In-Family members
            AND either {monetizeData?.eligibility?.thresholds?.videoViews?.toLocaleString() || 50000} video views or {(monetizeData?.eligibility?.thresholds?.shortViews || 1000000).toLocaleString()} Raftaar reels views!
            {" "}Plays of your music count toward the video-views target — same
            milestone, whichever way you publish.
          </p>

          <div>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-semibold text-slate-300 light:text-slate-700">
                <Users size={13} /> In-Family members
              </span>
              <span className="text-slate-500">
                {monetizeData?.eligibility?.metrics?.subscribers?.toLocaleString() || 0} / {monetizeData?.eligibility?.thresholds?.subscribers?.toLocaleString() || 500}
              </span>
            </div>
            <ProgressBar value={monetizeData?.eligibility?.metrics?.subscribers || 0} max={monetizeData?.eligibility?.thresholds?.subscribers || 500} />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-semibold text-slate-300 light:text-slate-700">
                <Eye size={13} /> Longform Video Views
              </span>
              <span className="text-slate-500">
                {monetizeData?.eligibility?.metrics?.videoViews?.toLocaleString() || 0} / {monetizeData?.eligibility?.thresholds?.videoViews?.toLocaleString() || 50000}
              </span>
            </div>
            <ProgressBar value={monetizeData?.eligibility?.metrics?.videoViews || 0} max={monetizeData?.eligibility?.thresholds?.videoViews || 50000} />
            {/* The music line is a BREAKDOWN of the bar above, not a fourth
                milestone — see the comment on musicViews in
                app/lib/monetization.ts. Rendered only when there are
                actually music plays, so a creator who has never uploaded a
                track never sees a row of zeros. */}
            {(monetizeData?.eligibility?.metrics?.musicViews || 0) > 0 && (
              <p className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500 light:text-slate-600">
                <Music2 size={11} />
                <span>
                  including{" "}
                  <span className="font-semibold text-violet-300 light:text-violet-700">
                    {(monetizeData?.eligibility?.metrics?.musicViews || 0).toLocaleString()}
                  </span>{" "}
                  music plays
                </span>
              </p>
            )}
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-semibold text-slate-300 light:text-slate-700">
                <PlaySquare size={13} /> Raftaar Reels Views
              </span>
              <span className="text-slate-500">
                {monetizeData?.eligibility?.metrics?.shortViews?.toLocaleString() || 0} / {monetizeData?.eligibility?.thresholds?.shortViews?.toLocaleString() || 1000000}
              </span>
            </div>
            <ProgressBar value={monetizeData?.eligibility?.metrics?.shortViews || 0} max={monetizeData?.eligibility?.thresholds?.shortViews || 1000000} />
          </div>
        </div>
      )}
    </div>
  );
}
