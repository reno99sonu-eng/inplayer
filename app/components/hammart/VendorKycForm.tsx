"use client";

import { useState } from "react";
import Link from "next/link";
import { fetchAuthSession } from "aws-amplify/auth";
import { Loader2, ShieldCheck, Upload, Check, AlertTriangle } from "lucide-react";
import { compressImageToDocument } from "@/app/lib/imageCompress";
import type { BusinessType } from "@/app/lib/hammartVendors";

const inputClass =
  "w-full rounded-xl border border-white/10 light:border-black/10 bg-[#07111F] light:bg-[#FAF5E9] px-3 py-2.5 text-sm text-white light:text-slate-900 outline-none transition focus:border-orange-400/50";

const labelClass = "mb-1 block text-xs font-semibold text-slate-400 light:text-slate-600";

type IdProofType = "aadhaar" | "passport";

// Identical upload widget to app/components/analytics/KycForm.tsx's
// DocumentUpload — kept as its own copy here (rather than a shared import)
// so Hammart's KYC surface can evolve independently of the creator-payout
// KYC surface without the two accidentally coupling.
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
      {label && <label className={labelClass}>{label}</label>}
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
          <img src={dataUrl} alt={label || "Uploaded document"} className="h-14 w-14 flex-shrink-0 rounded-lg object-cover" />
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

export default function VendorKycForm({
  businessType,
  onSubmitted,
  rejectionReason,
}: {
  businessType: BusinessType;
  onSubmitted: () => void;
  rejectionReason?: string | null;
}) {
  const [legalName, setLegalName] = useState("");
  const [panNumber, setPanNumber] = useState("");
  const [gstNumber, setGstNumber] = useState("");
  const [udyamNumber, setUdyamNumber] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pincode, setPincode] = useState("");
  const [idProofType, setIdProofType] = useState<IdProofType>("aadhaar");
  const [aadhaarNumber, setAadhaarNumber] = useState("");
  const [passportNumber, setPassportNumber] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [bankIfsc, setBankIfsc] = useState("");
  const [upiId, setUpiId] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [panDoc, setPanDoc] = useState<string | null>(null);
  const [idDoc, setIdDoc] = useState<string | null>(null);
  const [businessDoc, setBusinessDoc] = useState<string | null>(null);
  const [bankDoc, setBankDoc] = useState<string | null>(null);
  const [selfieDoc, setSelfieDoc] = useState<string | null>(null);
  const [processingDoc, setProcessingDoc] = useState<string | null>(null);
  const [docError, setDocError] = useState<string | null>(null);

  const handleDocSelected = async (
    slot: "pan" | "id" | "business" | "bank" | "selfie",
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
      if (slot === "business") setBusinessDoc(dataUrl);
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

    const requiredDocsReady =
      businessType === "business"
        ? panDoc && businessDoc && bankDoc && selfieDoc
        : panDoc && idDoc && bankDoc && selfieDoc;

    if (!requiredDocsReady) {
      setError("Please upload all required photos before submitting.");
      return;
    }

    if (businessType === "individual") {
      if (idProofType === "aadhaar" && !/^\d{12}$/.test(aadhaarNumber.trim())) {
        setError("Please enter your 12-digit Aadhaar number.");
        return;
      }
      if (idProofType === "passport" && !/^[A-Za-z0-9]{6,9}$/.test(passportNumber.trim())) {
        setError("Please enter a valid passport number.");
        return;
      }
    } else {
      const gstValid = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gstNumber.trim().toUpperCase());
      const udyamValid = /^UDYAM-[A-Z]{2}-\d{2}-\d{7}$/.test(udyamNumber.trim().toUpperCase());
      if (!gstValid && !udyamValid) {
        setError("Please enter a valid GST number or Udyam registration number.");
        return;
      }
    }

    if (!/^\d{9,18}$/.test(bankAccountNumber.trim())) {
      setError("Please enter a valid bank account number.");
      return;
    }
    if (!/^[A-Za-z]{4}0[A-Za-z0-9]{6}$/.test(bankIfsc.trim())) {
      setError("Please enter a valid IFSC code (e.g. HDFC0001234).");
      return;
    }
    if (!/^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(upiId.trim())) {
      setError("Please enter a valid UPI ID (e.g. yourname@okhdfcbank).");
      return;
    }
    if (!termsAccepted) {
      setError("Please accept the Hammart Vendor Terms to continue.");
      return;
    }

    setSubmitting(true);

    try {
      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken?.toString();

      const documents: Record<string, string> =
        businessType === "business"
          ? { pan_card: panDoc as string, business_proof: businessDoc as string, bank_proof: bankDoc as string, selfie: selfieDoc as string }
          : { pan_card: panDoc as string, id_proof: idDoc as string, bank_proof: bankDoc as string, selfie: selfieDoc as string };

      const res = await fetch("/api/hammart/vendor/kyc", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({
          legalName,
          panNumber,
          gstNumber: businessType === "business" ? gstNumber.trim() : undefined,
          udyamNumber: businessType === "business" ? udyamNumber.trim() : undefined,
          addressLine1,
          city,
          state,
          pincode,
          idProofType: businessType === "individual" ? idProofType : undefined,
          aadhaarNumber: businessType === "individual" && idProofType === "aadhaar" ? aadhaarNumber.trim() : undefined,
          passportNumber: businessType === "individual" && idProofType === "passport" ? passportNumber.trim() : undefined,
          bankAccountNumber: bankAccountNumber.trim(),
          bankIfsc: bankIfsc.trim().toUpperCase(),
          upiId: upiId.trim(),
          vendorTermsAccepted: termsAccepted,
          documents,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Couldn't submit right now. Please try again.");
        return;
      }
      onSubmitted();
    } catch (err) {
      console.error("Vendor KYC submission failed:", err);
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
            Your last submission wasn&apos;t approved: &quot;{rejectionReason}&quot;. Fix the issue and submit again below.
          </p>
        </div>
      )}

      <div className="flex items-start gap-2 rounded-xl border border-orange-400/20 bg-orange-500/[0.06] px-3 py-2.5">
        <ShieldCheck size={16} className="mt-0.5 flex-shrink-0 text-orange-400" />
        <p className="text-xs leading-relaxed text-slate-300 light:text-slate-700">
          A real person on the InPlayer team reviews every submission by hand before you can publish
          listings — usually within a few days. Once a decision is made, your photos and address are
          deleted automatically — only your legal name, PAN, {businessType === "business" ? "GST/Udyam number, " : ""}
          and bank/UPI details stay on file. Once approved, buyers can pay you directly via the UPI ID below —
          same as always, no setup needed from you. We&apos;ll also try setting you up for automatic online
          payouts (optional, never required) — if that activates, buyers can pay online instead and your share
          is sent to your bank account automatically, minus a flat ₹0.50 InPlayer commission per order.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={labelClass}>{businessType === "business" ? "Authorized signatory's legal name" : "Legal name"}</label>
          <input required value={legalName} onChange={(e) => setLegalName(e.target.value)} className={inputClass} placeholder="As it appears on your PAN card" />
        </div>

        <div>
          <label className={labelClass}>PAN number</label>
          <input required value={panNumber} onChange={(e) => setPanNumber(e.target.value.toUpperCase())} maxLength={10} className={`${inputClass} uppercase tracking-wider`} placeholder="ABCDE1234F" />
        </div>

        <div>
          <label className={labelClass}>Pincode</label>
          <input required value={pincode} onChange={(e) => setPincode(e.target.value)} className={inputClass} placeholder="560001" />
        </div>

        <div className="sm:col-span-2">
          <label className={labelClass}>Address</label>
          <input required value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} className={inputClass} placeholder="Street address" />
        </div>

        <div>
          <label className={labelClass}>City</label>
          <input required value={city} onChange={(e) => setCity(e.target.value)} className={inputClass} />
        </div>

        <div>
          <label className={labelClass}>State</label>
          <input required value={state} onChange={(e) => setState(e.target.value)} className={inputClass} />
        </div>
      </div>

      <div className="space-y-3 rounded-2xl border border-white/10 light:border-black/10 bg-white/[0.015] light:bg-black/[0.01] p-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500">Upload real photos</p>

        <DocumentUpload label="PAN card" hint="A clear photo of the PAN card, all four corners visible." dataUrl={panDoc} busy={processingDoc === "pan"} onChange={(f) => handleDocSelected("pan", f)} />

        {businessType === "individual" ? (
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
              hint={idProofType === "aadhaar" ? "Aadhaar card — cover or blur all but the last 4 digits before photographing it; the number is typed in below." : "Passport — the photo page showing your name and photo."}
              dataUrl={idDoc}
              busy={processingDoc === "id"}
              onChange={(f) => handleDocSelected("id", f)}
            />
            <div className="mt-2">
              {idProofType === "aadhaar" ? (
                <>
                  <label className={labelClass}>Aadhaar number</label>
                  <input required value={aadhaarNumber} onChange={(e) => setAadhaarNumber(e.target.value.replace(/\D/g, "").slice(0, 12))} inputMode="numeric" maxLength={12} className={inputClass} placeholder="12-digit number" />
                </>
              ) : (
                <>
                  <label className={labelClass}>Passport number</label>
                  <input required value={passportNumber} onChange={(e) => setPassportNumber(e.target.value.toUpperCase())} maxLength={9} className={`${inputClass} uppercase tracking-wider`} placeholder="e.g. A1234567" />
                </>
              )}
            </div>
          </div>
        ) : (
          <div>
            <DocumentUpload
              label="Business proof"
              hint="Your GST registration certificate, or your Udyam (MSME) registration certificate."
              dataUrl={businessDoc}
              busy={processingDoc === "business"}
              onChange={(f) => handleDocSelected("business", f)}
            />
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <div>
                <label className={labelClass}>GST number (if registered)</label>
                <input value={gstNumber} onChange={(e) => setGstNumber(e.target.value.toUpperCase())} maxLength={15} className={`${inputClass} uppercase tracking-wider`} placeholder="22AAAAA0000A1Z5" />
              </div>
              <div>
                <label className={labelClass}>Udyam number (if registered)</label>
                <input value={udyamNumber} onChange={(e) => setUdyamNumber(e.target.value.toUpperCase())} className={`${inputClass} uppercase tracking-wider`} placeholder="UDYAM-KA-03-1234567" />
              </div>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">Enter at least one — whichever your business actually has.</p>
          </div>
        )}

        <div>
          <DocumentUpload label="Bank proof" hint="A cancelled cheque, or the first page of a passbook/bank statement showing the account name, number, and IFSC." dataUrl={bankDoc} busy={processingDoc === "bank"} onChange={(f) => handleDocSelected("bank", f)} />
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Account number</label>
              <input required value={bankAccountNumber} onChange={(e) => setBankAccountNumber(e.target.value.replace(/\D/g, "").slice(0, 18))} inputMode="numeric" className={inputClass} placeholder="Account number" />
            </div>
            <div>
              <label className={labelClass}>IFSC code</label>
              <input required value={bankIfsc} onChange={(e) => setBankIfsc(e.target.value.toUpperCase())} maxLength={11} className={`${inputClass} uppercase tracking-wider`} placeholder="HDFC0001234" />
            </div>
          </div>
        </div>

        <div>
          <label className={labelClass}>UPI ID — buyers can pay you here directly</label>
          <input required value={upiId} onChange={(e) => setUpiId(e.target.value)} className={inputClass} placeholder="yourname@okhdfcbank" />
          <p className="mt-1 text-[11px] text-slate-500">
            Shown as a QR code and payment link at checkout unless automatic online payouts have activated for
            you — then buyers pay online instead and your payout (minus InPlayer&apos;s flat ₹0.50 commission) is
            sent automatically to the bank account above. Either way, this UPI ID is required.
          </p>
        </div>

        <DocumentUpload label="Selfie" hint="A clear photo of your face, for the admin to match against your ID above." dataUrl={selfieDoc} capture="user" busy={processingDoc === "selfie"} onChange={(f) => handleDocSelected("selfie", f)} />

        {docError && <p className="text-xs text-red-400">{docError}</p>}
      </div>

      <label className="flex items-start gap-2 text-xs text-slate-400 light:text-slate-600">
        <input
          type="checkbox"
          checked={termsAccepted}
          onChange={(e) => setTermsAccepted(e.target.checked)}
          className="mt-0.5 h-4 w-4 flex-shrink-0 accent-orange-500"
        />
        <span>
          I&apos;ve read and agree to the{" "}
          <Link href="/hammart-vendor-terms" target="_blank" className="font-semibold text-orange-300 hover:underline">
            Hammart Vendor Terms
          </Link>
          , including accurate listings, honoring returns for defective/misdescribed items, and responding to buyer
          complaints within 48 hours.
        </span>
      </label>

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
