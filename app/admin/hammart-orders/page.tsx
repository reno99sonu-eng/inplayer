"use client";

import { authedFetch } from "@/app/lib/apiFetch";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, AlertTriangle, Search, Receipt, Clock, CheckCircle2, XCircle, Send } from "lucide-react";

type Tab = "all" | "placed" | "payment_pending" | "paid" | "vendor_confirmed" | "payment_failed" | "vendor_cancelled";

interface AdminOrderRow {
  orderId: string;
  productTitle: string;
  productImageUrl: string | null;
  priceInr: number;
  quantity: number;
  totalInr: number;
  buyerName: string;
  buyerEmail: string;
  vendorId: string;
  vendorUserId: string;
  status: string;
  paymentMethod: "razorpay" | "upi";
  buyerClaimedPaidAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const TAB_LABELS: { key: Tab; label: string }[] = [
  { key: "all", label: "All orders" },
  { key: "placed", label: "Awaiting vendor (UPI)" },
  { key: "payment_pending", label: "Awaiting payment (Razorpay)" },
  { key: "paid", label: "Paid (Razorpay)" },
  { key: "vendor_confirmed", label: "Confirmed" },
  { key: "payment_failed", label: "Payment failed" },
  { key: "vendor_cancelled", label: "Cancelled" },
];

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string; Icon: typeof Clock }> = {
    placed: { label: "Awaiting vendor (UPI)", cls: "bg-amber-500/15 text-amber-300", Icon: Clock },
    payment_pending: { label: "Awaiting payment", cls: "bg-amber-500/15 text-amber-300", Icon: Clock },
    paid: { label: "Paid (Razorpay)", cls: "bg-sky-500/15 text-sky-300", Icon: CheckCircle2 },
    vendor_confirmed: { label: "Confirmed", cls: "bg-emerald-500/15 text-emerald-300", Icon: CheckCircle2 },
    payment_failed: { label: "Payment failed", cls: "bg-red-500/15 text-red-300", Icon: XCircle },
    vendor_cancelled: { label: "Cancelled", cls: "bg-red-500/15 text-red-300", Icon: XCircle },
  };
  const entry = map[status] || { label: status, cls: "bg-white/10 text-slate-400", Icon: Clock };
  const Icon = entry.Icon;
  return (
    <span className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${entry.cls}`}>
      <Icon size={11} /> {entry.label}
    </span>
  );
}

export default function AdminHammartOrdersPage() {
  const [tab, setTab] = useState<Tab>("all");
  const [items, setItems] = useState<AdminOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tableMissing, setTableMissing] = useState(false);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (o) =>
        o.productTitle.toLowerCase().includes(q) ||
        o.vendorId.toLowerCase().includes(q) ||
        o.buyerName.toLowerCase().includes(q) ||
        o.buyerEmail.toLowerCase().includes(q) ||
        o.orderId.toLowerCase().includes(q)
    );
  }, [items, query]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authedFetch(`/api/admin/hammart-orders?tab=${tab}`);
      if (!res.ok) throw new Error(`Couldn't load orders (HTTP ${res.status}).`);
      const data = await res.json();
      setItems(data.items || []);
      setTableMissing(Boolean(data.tableMissing));
      if (data.counts) setCounts(data.counts);
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

  return (
    <div>
      <div>
        <h2 className="flex items-center gap-2 text-xl font-black text-white light:text-slate-900">
          <Receipt size={20} className="text-indigo-400" /> Hammart Orders
        </h2>
        <p className="mt-1 text-sm text-slate-400 light:text-slate-600">
          Every order across every vendor, read-only. Status here is never set from this page — a direct-UPI order
          only moves once its own vendor confirms they actually received the payment (Vendor → Orders Received), and
          a Razorpay order only moves once Razorpay's signature-verified webhook says so. This is purely visibility.
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {TAB_LABELS.map((t) => (
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
          placeholder="Search by product, vendor ID, buyer name/email, or order ID…"
          className="w-full bg-transparent text-sm text-white light:text-slate-900 outline-none placeholder:text-slate-500 light:placeholder:text-slate-600 font-medium"
        />
      </div>

      {tableMissing && (
        <div className="mt-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-xs leading-5 text-amber-300 light:text-amber-800 font-semibold">
          Hammart-Orders hasn&apos;t been created in AWS yet, so nothing can be listed until it exists.
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
          <Loader2 size={24} className="animate-spin text-indigo-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-8 flex flex-col items-center gap-2 py-8 text-center">
          <Receipt size={28} className="text-slate-500" />
          <p className="text-sm text-slate-500">{query ? `Nothing matches "${query}".` : "No orders here yet."}</p>
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {filtered.map((o) => (
            <div key={o.orderId} className="flex items-center gap-3 rounded-2xl border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.02] p-3">
              {o.productImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={o.productImageUrl} alt={o.productTitle} className="h-14 w-14 flex-shrink-0 rounded-xl border border-white/10 object-cover" />
              ) : (
                <div className="h-14 w-14 flex-shrink-0 rounded-xl bg-white/5" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-bold text-white light:text-slate-900">{o.productTitle}</p>
                  <StatusBadge status={o.status} />
                  <span className="rounded-full bg-white/5 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-400">
                    {o.paymentMethod === "razorpay" ? "Razorpay" : "Direct UPI"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-400 light:text-slate-600">
                  ₹{o.totalInr.toLocaleString("en-IN")}{o.quantity > 1 ? ` (${o.quantity} × ₹${o.priceInr})` : ""} · Sold by {o.vendorId} · Buyer {o.buyerName} ({o.buyerEmail})
                </p>
                {o.buyerClaimedPaidAt && o.status === "placed" && (
                  <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-sky-300">
                    <Send size={11} /> Buyer says they&apos;ve paid — vendor was notified {new Date(o.buyerClaimedPaidAt).toLocaleString("en-IN")}
                  </p>
                )}
              </div>
              <span className="flex-shrink-0 text-[11px] text-slate-500">{new Date(o.createdAt).toLocaleDateString("en-IN")}</span>
            </div>
          ))}
        </div>
      )}

      <Link href="/admin/hammart-vendors" className="mt-6 block text-xs font-semibold text-indigo-300 hover:text-indigo-200">
        ← Back to Vendors & KYC
      </Link>
    </div>
  );
}
