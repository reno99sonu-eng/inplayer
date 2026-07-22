"use client";

import { useState } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import { Loader2, ShieldCheck } from "lucide-react";
import {
  PAYOUT_FREQUENCIES,
  PayoutFrequency,
  MIN_PAYOUT_AMOUNT_DEFAULT,
  MIN_PAYOUT_AMOUNT_BOUNDS,
} from "@/app/lib/creatorPayouts";

const inputClass =
  "w-full rounded-xl border border-white/10 light:border-black/10 bg-[#07111F] light:bg-[#FAF5E9] px-3 py-2.5 text-sm text-white light:text-slate-900 outline-none transition focus:border-orange-400/50";

const labelClass = "mb-1 block text-xs font-semibold text-slate-400 light:text-slate-600";

export default function KycForm({ onSubmitted }: { onSubmitted: () => void }) {
  const [legalName, setLegalName] = useState("");
  const [panNumber, setPanNumber] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pincode, setPincode] = useState("");
  const [payoutFrequency, setPayoutFrequency] = useState<PayoutFrequency>("monthly");
  const [minPayoutAmount, setMinPayoutAmount] = useState(String(MIN_PAYOUT_AMOUNT_DEFAULT));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken?.toString();

      const res = await fetch("/api/creator/kyc", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          legalName,
          panNumber,
          addressLine1,
          city,
          state,
          pincode,
          payoutFrequency,
          minPayoutAmount: Number(minPayoutAmount) || MIN_PAYOUT_AMOUNT_DEFAULT,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Couldn't submit right now. Please try again.");
        return;
      }

      onSubmitted();
    } catch (err) {
      console.error("KYC submission failed:", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-3">
      <div className="flex items-start gap-2 rounded-xl border border-orange-400/20 bg-orange-500/[0.06] px-3 py-2.5">
        <ShieldCheck size={16} className="mt-0.5 flex-shrink-0 text-orange-400" />
        <p className="text-xs leading-relaxed text-slate-300 light:text-slate-700">
          This identifies you for revenue eligibility review. Bank account
          linking happens separately and securely through Razorpay once
          it's connected — we never collect your bank details directly.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={labelClass}>Legal name</label>
          <input
            required
            value={legalName}
            onChange={(e) => setLegalName(e.target.value)}
            className={inputClass}
            placeholder="As it appears on your PAN card"
          />
        </div>

        <div>
          <label className={labelClass}>PAN number</label>
          <input
            required
            value={panNumber}
            onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
            maxLength={10}
            className={`${inputClass} uppercase tracking-wider`}
            placeholder="ABCDE1234F"
          />
        </div>

        <div>
          <label className={labelClass}>Pincode</label>
          <input
            required
            value={pincode}
            onChange={(e) => setPincode(e.target.value)}
            className={inputClass}
            placeholder="560001"
          />
        </div>

        <div className="sm:col-span-2">
          <label className={labelClass}>Address</label>
          <input
            required
            value={addressLine1}
            onChange={(e) => setAddressLine1(e.target.value)}
            className={inputClass}
            placeholder="Street address"
          />
        </div>

        <div>
          <label className={labelClass}>City</label>
          <input
            required
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>State</label>
          <input
            required
            value={state}
            onChange={(e) => setState(e.target.value)}
            className={inputClass}
          />
        </div>

        <div className="sm:col-span-2">
          <label className={labelClass}>Payout frequency — how often</label>
          <div className="grid grid-cols-4 gap-1.5">
            {PAYOUT_FREQUENCIES.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setPayoutFrequency(f)}
                className={`
                  rounded-xl px-2 py-2 text-xs font-semibold capitalize transition-all duration-300
                  ${
                    payoutFrequency === f
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

        <div className="sm:col-span-2">
          <label className={labelClass}>
            Minimum payout amount — how much
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">
              ₹
            </span>
            <input
              type="number"
              inputMode="numeric"
              min={MIN_PAYOUT_AMOUNT_BOUNDS.min}
              max={MIN_PAYOUT_AMOUNT_BOUNDS.max}
              value={minPayoutAmount}
              onChange={(e) => setMinPayoutAmount(e.target.value)}
              className={`${inputClass} pl-7`}
            />
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            We'll hold your balance until it reaches this amount, then pay it
            out on your chosen frequency above. Between ₹
            {MIN_PAYOUT_AMOUNT_BOUNDS.min} and ₹
            {MIN_PAYOUT_AMOUNT_BOUNDS.max.toLocaleString()}.
          </p>
        </div>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] py-2.5 text-sm font-bold text-white shadow-[0_10px_25px_rgba(255,153,0,.3)] transition-all hover:-translate-y-0.5 disabled:opacity-60"
      >
        {submitting ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
        {submitting ? "Submitting..." : "Submit for review"}
      </button>
    </form>
  );
}
