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

type Tab = "pending_review" | "verified" | "rejected" | "not_started" | "all";

interface VendorKyc {
  userId: string;
  username: string | null;
  vendorId: string | null;
  // Present on every row now (see app/api/admin/hammart-vendors/route.ts) so
  // the "All" tab can tell rows apart, and so a card can be judged on its
  // own real status instead of assuming every card on screen shares
  // whatever tab is currently selected.
  kycStatus: "not_started" | "pending_review" | "verified" | "rejected";
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
  createdAt?: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  rejectionReason: string | null;
  suspended: boolean;
  razorpayAccountId: string | null;
  razorpayAccountStatus: "not_started" | "pending" | "active" | "failed";
  razorpayAccountError: string | null;
  totalProducts?: number;
  totalSold?: number;
  totalRevenueInr?: number;
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
  // Real counts across EVERY kyc status, refreshed on every load regardless
  // of which tab is open — shown as badges on the tab buttons below so a
  // vendor sitting in a tab you're not currently viewing is never
  // invisible. This is what actually fixes "the vendor has no visible
  // record here" reports: most of the time the vendor is exactly where
  // they should be (Verified, since that's required before any listing can
  // go live — see app/api/hammart/products/route.ts), just not on the
  // Pending tab this page used to open on by default with no indication
  // there was anyone to see elsewhere.
  const [counts, setCounts] = useState<Record<string, number>>({
    pending_review: 0,
    verified: 0,
    rejected: 0,
    not_started: 0,
  });
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
      if (data.counts) {
        setCounts((prev) => ({ ...prev, ...data.counts }));
      }
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

  const runAction = async (
    userId: string,
    action: "approve" | "reject" | "suspend" | "unsuspend" | "retry_razorpay" | "sync_razorpay",
    reason?: string
  ) => {
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
        } else if (action === "suspend" || action === "unsuspend") {
          setItems((prev) => prev.map((i) => (i.userId === userId ? { ...i, suspended: action === "suspend" } : i)));
        } else {
          // retry_razorpay / sync_razorpay changed the vendor's Razorpay
          // fields server-side — reload this vendor's real state instead
          // of guessing at it client-side, since the whole point of these
          // two actions is to find out what Razorpay actually says.
          await load();
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
          Every submission here is a real vendor&apos;s real business documents. Approving unlocks their ability to
          publish listings and immediately lets them sell — buyers can check out with them via direct UPI payment
          right away, no Razorpay required. Approving also automatically attempts onboarding them onto Razorpay
          Route (best-effort, using the bank/PAN details below) — this is purely an upgrade, never a requirement:
          if/when their status below reads &quot;Active&quot;, checkout for that vendor switches to real Razorpay
          payment (InPlayer keeps a flat ₹0.50 per order, the rest paid out automatically) instead of the UPI
          fallback. Until then, or if Razorpay onboarding fails/stays pending, the vendor keeps selling via UPI —
          checkout is never blocked over Razorpay status alone.
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {(
          [
            { key: "pending_review", label: "Pending" },
            { key: "verified", label: "Verified" },
            { key: "rejected", label: "Rejected" },
            { key: "not_started", label: "Not started" },
            { key: "all", label: "All vendors" },
          ] as { key: Tab; label: string }[]
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold transition ${
              tab === t.key
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                : "bg-white/5 text-slate-400 light:text-slate-700 light:bg-slate-200/80 hover:bg-white/10 hover:text-white light:hover:text-slate-900"
            }`}
          >
            {t.label}
            {t.key !== "all" && (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-black ${
                  tab === t.key ? "bg-white/20 text-white" : "bg-white/10 light:bg-black/10 text-slate-400 light:text-slate-700"
                }`}
              >
                {counts[t.key] ?? 0}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-2 rounded-2xl border border-white/10 light:border-slate-300 bg-white/[0.03] light:bg-white px-4 py-3 light:shadow-sm">
        <Search size={16} className="text-slate-400 light:text-slate-600" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by vendor ID, business name, legal name, PAN, or user ID…"
          className="w-full bg-transparent text-sm text-white light:text-slate-900 outline-none placeholder:text-slate-500 light:placeholder:text-slate-600 font-medium"
        />
      </div>

      {tableMissing && (
        <div className="mt-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-xs leading-5 text-amber-300 light:text-amber-800 font-semibold">
          Hammart-Vendors hasn&apos;t been created in AWS yet, so nothing can be listed until it exists.
        </div>
      )}

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300 light:text-red-800 font-semibold">
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <Loader2 size={24} className="animate-spin text-indigo-500" />
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="mt-8 flex flex-col items-center gap-2 py-8 text-center">
          <ShieldCheck size={28} className="text-emerald-500" />
          <p className="text-sm font-semibold text-slate-400 light:text-slate-700">
            {query
              ? `Nothing matches "${query}".`
              : tab === "pending_review"
              ? "Nothing waiting on review."
              : tab === "all"
              ? "No vendor accounts yet."
              : "Nothing here yet."}
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {filteredItems.map((v) => (
            <div key={v.userId} className="rounded-2xl border border-white/10 light:border-slate-300 bg-white/[0.03] light:bg-white p-4 light:shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="flex items-center gap-1.5 text-sm font-bold text-white light:text-slate-900">
                    <Store size={13} className="text-indigo-500 light:text-indigo-600" /> {v.vendorId || "(no vendor id)"}
                    {tab === "all" && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${
                          v.kycStatus === "verified"
                            ? "bg-emerald-500/15 text-emerald-300 light:text-emerald-700"
                            : v.kycStatus === "rejected"
                            ? "bg-red-500/15 text-red-300 light:text-red-700"
                            : v.kycStatus === "pending_review"
                            ? "bg-amber-500/15 text-amber-300 light:text-amber-700"
                            : "bg-white/10 text-slate-400 light:text-slate-600"
                        }`}
                      >
                        {v.kycStatus.replace("_", " ")}
                      </span>
                    )}
                    {v.suspended && (
                      <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-black uppercase text-red-300 light:text-red-700">Suspended</span>
                    )}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-3 rounded-xl border border-white/5 light:border-slate-200 bg-black/20 light:bg-slate-100 px-3 py-1.5 text-xs text-slate-300 light:text-slate-800">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 light:text-slate-600 block">Listings</span>
                      <span className="font-bold text-white light:text-slate-900">{v.totalProducts || 0} products</span>
                    </div>
                    <div className="h-4 w-px bg-white/10 light:bg-slate-300" />
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 light:text-slate-600 block">Items Sold</span>
                      <span className="font-bold text-emerald-400 light:text-emerald-700">{v.totalSold || 0} sold</span>
                    </div>
                    <div className="h-4 w-px bg-white/10 light:bg-slate-300" />
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 light:text-slate-600 block">Total Revenue</span>
                      <span className="font-bold text-indigo-400 light:text-indigo-700">₹{(v.totalRevenueInr || 0).toLocaleString("en-IN")}</span>
                    </div>
                  </div>
                  <p className="mt-2 text-xs font-medium text-slate-400 light:text-slate-700">
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
                {v.submittedAt ? (
                  <span className="text-[11px] text-slate-500">Submitted {new Date(v.submittedAt).toLocaleDateString("en-IN")}</span>
                ) : v.createdAt ? (
                  <span className="text-[11px] text-slate-500">Joined {new Date(v.createdAt).toLocaleDateString("en-IN")}</span>
                ) : null}
              </div>

              {v.rejectionReason && (
                <p className="mt-2 rounded-lg bg-red-500/10 px-2.5 py-1.5 text-[11px] text-red-300">Rejected: &quot;{v.rejectionReason}&quot;</p>
              )}

              {v.kycStatus === "pending_review" ? (
                <div className="mt-3 flex flex-wrap gap-3">
                  {Object.entries(v.businessType === "business" ? DOC_LABELS_BUSINESS : DOC_LABELS_INDIVIDUAL).map(([key, label]) => (
                    <DocThumb key={key} label={label} src={v.documents[key]} />
                  ))}
                </div>
              ) : v.kycStatus === "verified" || v.kycStatus === "rejected" ? (
                <p className="mt-3 text-[11px] italic text-slate-600">Documents and address were purged automatically after this review.</p>
              ) : (
                <p className="mt-3 text-[11px] italic text-slate-600">Hasn&apos;t submitted business verification (KYC) yet.</p>
              )}

              {v.kycStatus === "pending_review" && (
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
                          className="rounded-xl px-3 py-2 text-xs font-semibold text-slate-400 light:text-slate-600 hover:bg-white/5 light:hover:bg-black/5"
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

              {v.kycStatus === "verified" && (
                <div className="mt-3 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${
                        v.razorpayAccountStatus === "active"
                          ? "bg-emerald-500/15 text-emerald-300 light:text-emerald-700"
                          : v.razorpayAccountStatus === "pending"
                          ? "bg-amber-500/15 text-amber-300 light:text-amber-700"
                          : v.razorpayAccountStatus === "failed"
                          ? "bg-red-500/15 text-red-300 light:text-red-700"
                          : "bg-white/10 text-slate-400 light:text-slate-600"
                      }`}
                    >
                      Razorpay: {v.razorpayAccountStatus === "not_started" ? "not set up" : v.razorpayAccountStatus}
                    </span>
                    {v.razorpayAccountStatus !== "active" && (
                      <>
                        <button
                          type="button"
                          disabled={busyId === v.userId}
                          onClick={() => runAction(v.userId, "retry_razorpay")}
                          className="flex items-center gap-1.5 rounded-xl bg-indigo-500/15 px-3 py-1.5 text-xs font-bold text-indigo-300 transition hover:bg-indigo-500/25 disabled:opacity-60"
                        >
                          {busyId === v.userId ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
                          {v.razorpayAccountId ? "Retry setup" : "Set up Razorpay payouts"}
                        </button>
                        {v.razorpayAccountId && (
                          <button
                            type="button"
                            disabled={busyId === v.userId}
                            onClick={() => runAction(v.userId, "sync_razorpay")}
                            className="flex items-center gap-1.5 rounded-xl bg-white/5 px-3 py-1.5 text-xs font-bold text-slate-300 light:text-slate-700 transition hover:bg-white/10 disabled:opacity-60"
                          >
                            Check status
                          </button>
                        )}
                      </>
                    )}
                  </div>
                  {v.razorpayAccountError && (
                    <p className="text-[11px] text-red-400">{v.razorpayAccountError}</p>
                  )}
                  {v.razorpayAccountStatus !== "active" && (
                    <p className="text-[11px] text-slate-500">
                      Not required to sell — this vendor&apos;s listings use direct UPI checkout until this reads
                      &quot;Active&quot;, then checkout switches to real Razorpay payment automatically.
                    </p>
                  )}

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
