"use client";

import { useState } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import { Loader2, ShieldCheck, Upload, Check, AlertTriangle } from "lucide-react";
import {
  PAYOUT_FREQUENCIES,
  PayoutFrequency,
  MIN_PAYOUT_AMOUNT_DEFAULT,
  MIN_PAYOUT_AMOUNT_BOUNDS,
} from "@/app/lib/creatorPayouts";
import { compressImageToDocument } from "@/app/lib/imageCompress";

const inputClass =
  "w-full rounded-xl border border-white/10 light:border-black/10 bg-[#07111F] light:bg-[#FAF5E9] px-3 py-2.5 text-sm text-white light:text-slate-900 outline-none transition focus:border-orange-400/50";

const labelClass = "mb-1 block text-xs font-semibold text-slate-400 light:text-slate-600";

type IdProofType = "aadhaar" | "passport";

// A single document upload slot — captures a photo (camera on mobile via
// the `capture` attribute, or a file picker on desktop), compresses it
// client-side (see compressImageToDocument — high enough quality that an
// admin can actually read it), and shows a preview once done. Nothing here
// is auto-verified against any government record — this is real evidence
// captured for a human (the InPlayer admin) to review, per how this KYC
// flow was actually specced: manual review, not a paid 3rd-party API.
function DocumentUpload({
  label,
  hint,
  dataUrl,
  onChange,
  capture,
  busy,
  error,
}: {
  label: string;
  hint: string;
  dataUrl: string | null;
  onChange: (file: File) => void;
  capture?: "user" | "environment";
  busy: boolean;
  error?: string | null;
}) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <label
        className={`
          flex cursor-pointer items-center gap-3 rounded-xl border border-dashed px-3 py-3 transition
          ${
            dataUrl
              ? "border-emerald-400/40 bg-emerald-500/[0.05]"
              : "border-white/15 light:border-black/15 hover:border-orange-400/40 hover:bg-white/[0.02]"
          }
        `}
      >
        <input
          type="file"
          accept="image/*"
          capture={capture}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onChange(file);
            e.target.value = "";
          }}
        />
        {dataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={dataUrl}
            alt={label}
            className="h-14 w-14 flex-shrink-0 rounded-lg object-cover"
          />
        ) : (
          <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-lg bg-white/5 light:bg-black/5 text-slate-500">
            {busy ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-200 light:text-slate-800">
            {dataUrl && <Check size={13} className="text-emerald-400" />}
            {dataUrl ? "Uploaded — tap to replace" : "Tap to upload a photo"}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">{hint}</p>
        </div>
      </label>
      {error && <p className="mt-1 text-[11px] text-red-400">{error}</p>}
    </div>
  );
}

export default function KycForm({
  onSubmitted,
  rejectionReason,
}: {
  onSubmitted: () => void;
  rejectionReason?: string | null;
}) {
  const [legalName, setLegalName] = useState("");
  const [panNumber, setPanNumber] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pincode, setPincode] = useState("");
  const [idProofType, setIdProofType] = useState<IdProofType>("aadhaar");
  const [aadhaarNumber, setAadhaarNumber] = useState("");
  const [passportNumber, setPassportNumber] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [bankIfsc, setBankIfsc] = useState("");
  const [payoutFrequency, setPayoutFrequency] = useState<PayoutFrequency>("monthly");
  const [minPayoutAmount, setMinPayoutAmount] = useState(String(MIN_PAYOUT_AMOUNT_DEFAULT));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [panDoc, setPanDoc] = useState<string | null>(null);
  const [idDoc, setIdDoc] = useState<string | null>(null);
  const [bankDoc, setBankDoc] = useState<string | null>(null);
  const [selfieDoc, setSelfieDoc] = useState<string | null>(null);
  const [processingDoc, setProcessingDoc] = useState<string | null>(null);
  const [docError, setDocError] = useState<string | null>(null);

  const handleDocSelected = async (
    slot: "pan" | "id" | "bank" | "selfie",
    file: File
  ) => {
    if (!file.type.startsWith("image/")) {
      setDocError("Please upload an image file (photo or screenshot).");
      return;
    }
    setDocError(null);
    setProcessingDoc(slot);
    try {
      const dataUrl = await compressImageToDocument(file);
      if (slot === "pan") setPanDoc(dataUrl);
      if (slot === "id") setIdDoc(dataUrl);
      if (slot === "bank") setBankDoc(dataUrl);
      if (slot === "selfie") setSelfieDoc(dataUrl);
    } catch (err) {
      console.error("Document processing failed:", err);
      setDocError("Couldn't process that photo. Please try a different one.");
    } finally {
      setProcessingDoc(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!panDoc || !idDoc || !bankDoc || !selfieDoc) {
      setError("Please upload all four photos before submitting.");
      return;
    }

    if (idProofType === "aadhaar" && !/^\d{12}$/.test(aadhaarNumber.trim())) {
      setError("Please enter your 12-digit Aadhaar number.");
      return;
    }
    if (idProofType === "passport" && !/^[A-Za-z0-9]{6,9}$/.test(passportNumber.trim())) {
      setError("Please enter a valid passport number.");
      return;
    }
    if (!/^\d{9,18}$/.test(bankAccountNumber.trim())) {
      setError("Please enter a valid bank account number.");
      return;
    }
    if (!/^[A-Za-z]{4}0[A-Za-z0-9]{6}$/.test(bankIfsc.trim())) {
      setError("Please enter a valid IFSC code (e.g. HDFC0001234).");
      return;
    }

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
          idProofType,
          aadhaarNumber: idProofType === "aadhaar" ? aadhaarNumber.trim() : undefined,
          passportNumber: idProofType === "passport" ? passportNumber.trim() : undefined,
          bankAccountNumber: bankAccountNumber.trim(),
          bankIfsc: bankIfsc.trim().toUpperCase(),
          payoutFrequency,
          minPayoutAmount: Number(minPayoutAmount) || MIN_PAYOUT_AMOUNT_DEFAULT,
          documents: {
            pan_card: panDoc,
            id_proof: idDoc,
            bank_proof: bankDoc,
            selfie: selfieDoc,
          },
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
      {rejectionReason && (
        <div className="flex items-start gap-2 rounded-xl border border-red-500/25 bg-red-500/[0.06] px-3 py-2.5">
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0 text-red-400" />
          <p className="text-xs leading-relaxed text-slate-300 light:text-slate-700">
            Your last submission wasn&apos;t approved: &quot;{rejectionReason}&quot;. Fix
            the issue and submit again below.
          </p>
        </div>
      )}

      <div className="flex items-start gap-2 rounded-xl border border-orange-400/20 bg-orange-500/[0.06] px-3 py-2.5">
        <ShieldCheck size={16} className="mt-0.5 flex-shrink-0 text-orange-400" />
        <p className="text-xs leading-relaxed text-slate-300 light:text-slate-700">
          A real person on the InPlayer team reviews every submission by hand
          before revenue tracking unlocks — usually within a few days. Once a
          decision is made, your photos and address are deleted automatically
          — only your legal name and the ID/account numbers below stay on
          file. Actual payouts are still linked and moved separately and
          securely through Razorpay; we never store your PIN, CVV, or online
          banking password.
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
      </div>

      {/* --- Real document uploads --- */}
      <div className="space-y-3 rounded-2xl border border-white/10 light:border-black/10 bg-white/[0.015] light:bg-black/[0.01] p-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500">
          Upload real photos
        </p>

        <DocumentUpload
          label="PAN card"
          hint="A clear photo of your PAN card, all four corners visible."
          dataUrl={panDoc}
          busy={processingDoc === "pan"}
          onChange={(f) => handleDocSelected("pan", f)}
        />

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className={labelClass + " mb-0"}>Second ID proof</label>
            <div className="flex gap-1">
              {(["aadhaar", "passport"] as IdProofType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setIdProofType(t)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-bold capitalize transition ${
                    idProofType === t
                      ? "bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] text-white"
                      : "border border-white/10 light:border-black/10 text-slate-400 light:text-slate-600"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <DocumentUpload
            label=""
            hint={
              idProofType === "aadhaar"
                ? "Aadhaar card — please cover or blur all but the last 4 digits of the number before photographing it, for your own privacy. The number itself is typed in below."
                : "Passport — the photo page showing your name and photo."
            }
            dataUrl={idDoc}
            busy={processingDoc === "id"}
            onChange={(f) => handleDocSelected("id", f)}
          />
          <div className="mt-2">
            {idProofType === "aadhaar" ? (
              <>
                <label className={labelClass}>Aadhaar number</label>
                <input
                  required
                  value={aadhaarNumber}
                  onChange={(e) => setAadhaarNumber(e.target.value.replace(/\D/g, "").slice(0, 12))}
                  inputMode="numeric"
                  maxLength={12}
                  className={inputClass}
                  placeholder="12-digit number"
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  This number stays on file after review; the photo above is
                  only used to confirm it matches and is deleted afterward.
                </p>
              </>
            ) : (
              <>
                <label className={labelClass}>Passport number</label>
                <input
                  required
                  value={passportNumber}
                  onChange={(e) => setPassportNumber(e.target.value.toUpperCase())}
                  maxLength={9}
                  className={`${inputClass} uppercase tracking-wider`}
                  placeholder="e.g. A1234567"
                />
              </>
            )}
          </div>
        </div>

        <div>
          <DocumentUpload
            label="Bank proof"
            hint="A cancelled cheque, or the first page of a passbook/bank statement showing your name, account number, and IFSC."
            dataUrl={bankDoc}
            busy={processingDoc === "bank"}
            onChange={(f) => handleDocSelected("bank", f)}
          />
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Account number</label>
              <input
                required
                value={bankAccountNumber}
                onChange={(e) => setBankAccountNumber(e.target.value.replace(/\D/g, "").slice(0, 18))}
                inputMode="numeric"
                className={inputClass}
                placeholder="Account number"
              />
            </div>
            <div>
              <label className={labelClass}>IFSC code</label>
              <input
                required
                value={bankIfsc}
                onChange={(e) => setBankIfsc(e.target.value.toUpperCase())}
                maxLength={11}
                className={`${inputClass} uppercase tracking-wider`}
                placeholder="HDFC0001234"
              />
            </div>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            These numbers stay on file after review; the photo above is only
            used to confirm them and is deleted afterward.
          </p>
        </div>

        <DocumentUpload
          label="Selfie"
          hint="A clear photo of your face, for the admin to match against your ID above."
          dataUrl={selfieDoc}
          capture="user"
          busy={processingDoc === "selfie"}
          onChange={(f) => handleDocSelected("selfie", f)}
        />

        {docError && <p className="text-xs text-red-400">{docError}</p>}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
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
            We&apos;ll hold your balance until it reaches this amount, then pay it
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
