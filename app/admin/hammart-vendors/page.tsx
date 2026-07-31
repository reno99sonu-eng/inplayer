"use client";

import { authedFetch } from "@/app/lib/apiFetch";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  AlertTriangle,
  ShieldCheck,
  Check,
  X,
  ExternalLink,
  Search,
  Store,
  Ban,
  RotateCcw,
} from "lucide-react";

type Tab = "pending_review" | "verified" | "rejected";

interface VendorKyc {
  userId: string;
  username: string | null;
  vendorId: string | null;
  businessType: "individual" | "business";
  businessName: string | null;
  legalName: string | null;
  panNumber: string | null;
  gstNumber: string | null;
  udyamNumber: string | null;
  idProofType: string | null;
  aadhaarNumber: string | null;
  passportNumber: string | null;
  bankAccountNumber: string | null;
  bankIfsc: string | null;
  upiId: string | null;
  addressLine1: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  rejectionReason: string | null;
  suspended: boolean;
  documents: Record<string, string>;
}

const DOC_LABELS_INDIVIDUAL: Record<string, string> = {
  pan_card: "PAN card",
  id_proof: "ID proof",
  bank_proof: "Bank proof",
  selfie: "Selfie",
};
const DOC_LABELS_BUSINESS: Record<string, string> = {
  pan_card: "PAN card",
  business_proof: "GST/Udyam proof",
  bank_proof: "Bank proof",
  selfie: "Selfie",
};

function DocThumb({ label, src }: { label: string; src?: string }) {
  const [open, setOpen] = useState(false);
  if (!src) {
    return (
      <div className="flex h-20 w-20 flex-shrink-0 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-white/10 text-center text-[10px] text-slate-600">
        Missing
      </div>
    );
  }
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="group flex flex-col items-center gap-1">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={label} className="h-20 w-20 flex-shrink-0 rounded-xl border border-white/10 object-cover transition group-hover:border-indigo-400/50" />
        <span className="text-[10px] font-semibold text-slate-400">{label}</span>
      </button>
      {open && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/85 p-6" onClick={() => setOpen(false)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={label} className="max-h-[90vh] max-w-[90vw] rounded-2xl object-contain" />
        </div>
      )}
    </>
  );
}

export default function AdminHammartVendorsPage() {
  const [tab, setTab] = useState<Tab>("pending_review");
  const [items, setItems] = useState<VendorKyc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tableMissing, setTableMissing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [query, setQuery] = useState("");

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (v) =>
        (v.legalName || "").toLowerCase().includes(q) ||
        (v.vendorId || "").toLowerCase().includes(q) ||
        (v.businessName || "").toLowerCase().includes(q) ||
        (v.username || "").toLowerCase().includes(q) ||
        (v.panNumber || "").toLowerCase().includes(q) ||
        v.userId.toLowerCase().includes(q)
    );
  }, [items, query]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authedFetch(`/api/admin/hammart-vendors?tab=${tab}`);
      if (!res.ok) throw new Error(`Couldn't load the list (HTTP ${res.status}).`);
      const data = await res.json();
      setItems(data.items || []);
      setTableMissing(Boolean(data.tableMissing));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      await load();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const runAction = async (userId: string, action: "approve" | "reject" | "suspend" | "unsuspend", reason?: string) => {
    setBusyId(userId);
    try {
      const res = await authedFetch("/api/admin/hammart-vendors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, action, reason }),
      });
      if (res.ok) {
        if (action === "approve" || action === "reject") {
          setItems((prev) => prev.filter((i) => i.userId !== userId));
        } else {
          setItems((prev) => prev.map((i) => (i.userId === userId ? { ...i, suspended: action === "suspend" } : i)));
        }
        setRejectingId(null);
        setRejectReason("");
      } else {
        const data = await res.json().catch(() => ({}));
        window.alert(data.error || "Couldn't save that right now.");
      }
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <div>
        <h2 className="text-xl font-black text-white light:text-slate-900">Hammart Vendors — KYC review</h2>
        <p className="mt-1 text-sm text-slate-400 light:text-slate-600">
          Every submission here is a real vendor&apos;s real business documents. Approving unlocks their
          ability to publish listings; buyers pay them directly via the UPI ID shown below — InPlayer
          never routes that money.
        </p>
      </div>

      <div className="mt-4 flex items-center gap-2">
        {(
          [
            { key: "pending_review", label: "Pending" },
            { key: "verified", label: "Verified" },
            { key: "rejected", label: "Rejected" },
          ] as { key: Tab; label: string }[]
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${
              tab === t.key ? "bg-indigo-500 text-white" : "bg-white/5 text-slate-400 hover:bg-white/10 light:bg-black/5"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-2 rounded-2xl border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.02] px-4 py-3">
        <Search size={16} className="text-slate-500" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by vendor ID, business name, legal name, PAN, or user ID…"
          className="w-full bg-transparent text-sm text-white light:text-slate-900 outline-none placeholder:text-slate-500"
        />
      </div>

      {tableMissing && (
        <div className="mt-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-xs leading-5 text-amber-300 light:text-amber-700">
          Hammart-Vendors hasn&apos;t been created in AWS yet, so nothing can be listed until it exists.
        </div>
      )}

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300 light:text-red-700">
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <Loader2 size={24} className="animate-spin text-indigo-400" />
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="mt-8 flex flex-col items-center gap-2 py-8 text-center">
          <ShieldCheck size={28} className="text-emerald-400" />
          <p className="text-sm text-slate-500">
            {query ? `Nothing matches "${query}".` : tab === "pending_review" ? "Nothing waiting on review." : "Nothing here yet."}
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {filteredItems.map((v) => (
            <div key={v.userId} className="rounded-2xl border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.02] p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="flex items-center gap-1.5 text-sm font-bold text-white light:text-slate-900">
                    <Store size={13} className="text-orange-400" /> {v.vendorId || "(no vendor id)"}
                    {v.suspended && (
                      <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-black uppercase text-red-300">Suspended</span>
                    )}
                  </p>
                  <p className="mt-1 text-xs text-slate-400 light:text-slate-600">
                    {v.businessType === "business" ? v.businessName || "(business)" : v.legalName || "(individual)"} · {v.businessType}
                  </p>
                  <p className="text-xs text-slate-400 light:text-slate-600">PAN: {v.panNumber || "—"}</p>
                  {v.businessType === "business" ? (
                    <p className="text-xs text-slate-400 light:text-slate-600">GST/Udyam: {v.gstNumber || v.udyamNumber || "—"}</p>
                  ) : (
                    <p className="text-xs text-slate-400 light:text-slate-600">
                      {v.idProofType === "passport" ? "Passport" : "Aadhaar"}: {v.aadhaarNumber || v.passportNumber || "—"}
                    </p>
                  )}
                  <p className="text-xs text-slate-400 light:text-slate-600">
                    Bank a/c: {v.bankAccountNumber || "—"}
                    {v.bankIfsc ? ` (IFSC ${v.bankIfsc})` : ""}
                  </p>
                  <p className="text-xs text-slate-400 light:text-slate-600">UPI: {v.upiId || "—"}</p>
                  {v.addressLine1 && (
                    <p className="mt-0.5 text-xs text-slate-500">
                      {v.addressLine1}, {v.city}, {v.state} {v.pincode}
                    </p>
                  )}
                  {v.username && (
                    <Link href={`/u/${encodeURIComponent(v.username)}`} target="_blank" className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-indigo-300 hover:text-indigo-200">
                      <ExternalLink size={11} /> @{v.username}
                    </Link>
                  )}
                </div>
                {v.submittedAt && (
                  <span className="text-[11px] text-slate-500">Submitted {new Date(v.submittedAt).toLocaleDateString("en-IN")}</span>
                )}
              </div>

              {v.rejectionReason && (
                <p className="mt-2 rounded-lg bg-red-500/10 px-2.5 py-1.5 text-[11px] text-red-300">Rejected: &quot;{v.rejectionReason}&quot;</p>
              )}

              {tab === "pending_review" ? (
                <div className="mt-3 flex flex-wrap gap-3">
                  {Object.entries(v.businessType === "business" ? DOC_LABELS_BUSINESS : DOC_LABELS_INDIVIDUAL).map(([key, label]) => (
                    <DocThumb key={key} label={label} src={v.documents[key]} />
                  ))}
                </div>
              ) : tab === "verified" ? (
                <p className="mt-3 text-[11px] italic text-slate-600">Documents and address were purged automatically after this review.</p>
              ) : null}

              {tab === "pending_review" && (
                <div className="mt-3">
                  {rejectingId === v.userId ? (
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <input
                        autoFocus
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="Reason (shown to the vendor)"
                        className="flex-1 rounded-xl border border-white/10 bg-[#07111F] light:bg-[#FAF5E9] px-3 py-2 text-xs text-white light:text-slate-900 outline-none focus:border-red-400/50"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={busyId === v.userId || !rejectReason.trim()}
                          onClick={() => runAction(v.userId, "reject", rejectReason.trim())}
                          className="flex items-center gap-1 rounded-xl bg-red-500/20 px-3 py-2 text-xs font-bold text-red-300 disabled:opacity-50"
                        >
                          {busyId === v.userId ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />}
                          Confirm reject
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRejectingId(null);
                            setRejectReason("");
                          }}
                          className="rounded-xl px-3 py-2 text-xs font-semibold text-slate-400 hover:bg-white/5"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={busyId === v.userId}
                        onClick={() => runAction(v.userId, "approve")}
                        className="flex items-center gap-1.5 rounded-xl bg-emerald-500/15 px-3 py-1.5 text-xs font-bold text-emerald-300 transition hover:bg-emerald-500/25 disabled:opacity-60"
                      >
                        {busyId === v.userId ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={busyId === v.userId}
                        onClick={() => setRejectingId(v.userId)}
                        className="flex items-center gap-1.5 rounded-xl bg-red-500/15 px-3 py-1.5 text-xs font-bold text-red-300 transition hover:bg-red-500/25 disabled:opacity-60"
                      >
                        <X size={13} /> Reject
                      </button>
                    </div>
                  )}
                </div>
              )}

              {tab === "verified" && (
                <div className="mt-3">
                  {v.suspended ? (
                    <button
                      type="button"
                      disabled={busyId === v.userId}
                      onClick={() => runAction(v.userId, "unsuspend")}
                      className="flex items-center gap-1.5 rounded-xl bg-emerald-500/15 px-3 py-1.5 text-xs font-bold text-emerald-300 transition hover:bg-emerald-500/25 disabled:opacity-60"
                    >
                      {busyId === v.userId ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
                      Reinstate vendor
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={busyId === v.userId}
                      onClick={() => runAction(v.userId, "suspend")}
                      className="flex items-center gap-1.5 rounded-xl bg-red-500/15 px-3 py-1.5 text-xs font-bold text-red-300 transition hover:bg-red-500/25 disabled:opacity-60"
                    >
                      {busyId === v.userId ? <Loader2 size={13} className="animate-spin" /> : <Ban size={13} />}
                      Suspend vendor
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
