"use client";

import { authedFetch } from "@/app/lib/apiFetch";
import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { Loader2, AlertTriangle, Search, Megaphone, Clock, CheckCircle2, XCircle, Ban } from "lucide-react";
import { useAdminRefresh } from "@/app/components/admin/AdminRefreshContext";

type Tab = "all" | "pending_payment" | "awaiting_assets" | "active" | "expired" | "cancelled";

interface AdminSponsorshipRow {
  sponsorshipId: string;
  companyName: string;
  contactEmail: string;
  packageType: string;
  sections: string[];
  amountInr: number;
  paymentStatus: string;
  status: Tab | string;
  assetCount: number;
  activatedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

const TAB_LABELS: { key: Tab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending_payment", label: "Awaiting payment" },
  { key: "awaiting_assets", label: "Awaiting assets" },
  { key: "active", label: "Live" },
  { key: "expired", label: "Expired" },
  { key: "cancelled", label: "Cancelled" },
];

const STATUS_META: Record<string, { label: string; cls: string; Icon: typeof Clock }> = {
  pending_payment: { label: "Awaiting payment", cls: "bg-amber-500/15 text-amber-300 light:bg-amber-100 light:text-amber-800", Icon: Clock },
  awaiting_assets: { label: "Awaiting assets", cls: "bg-sky-500/15 text-sky-300 light:bg-sky-100 light:text-sky-700", Icon: Clock },
  active: { label: "Live", cls: "bg-emerald-500/15 text-emerald-300 light:bg-emerald-100 light:text-emerald-700", Icon: CheckCircle2 },
  expired: { label: "Expired", cls: "bg-white/10 light:bg-black/10 text-slate-400 light:text-slate-600", Icon: XCircle },
  cancelled: { label: "Cancelled", cls: "bg-red-500/15 text-red-300 light:bg-red-100 light:text-red-700", Icon: Ban },
};

export default function AdminSponsorshipsPage() {
  const [tab, setTab] = useState<Tab>("all");
  const [items, setItems] = useState<AdminSponsorshipRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tableMissing, setTableMissing] = useState(false);
  const [query, setQuery] = useState("");
  const { setRefreshing, setLastUpdated, globalRefreshTrigger } = useAdminRefresh();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((s) => tab === "all" || s.status === tab)
      .filter(
        (s) =>
          !q ||
          s.companyName.toLowerCase().includes(q) ||
          s.contactEmail.toLowerCase().includes(q) ||
          s.sponsorshipId.toLowerCase().includes(q)
      );
  }, [items, tab, query]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const s of items) c[s.status] = (c[s.status] || 0) + 1;
    return c;
  }, [items]);

  const load = useCallback(async (isBackgroundRefresh = false) => {
    if (!isBackgroundRefresh) setLoading(true);
    if (isBackgroundRefresh) setRefreshing(true);
    setError(null);
    try {
      const res = await authedFetch("/api/admin/sponsorships");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't load sponsorships.");
      setItems(data.items || []);
      setTableMissing(Boolean(data.tableMissing));
      setLastUpdated(new Date());
    } catch (err) {
      if (!isBackgroundRefresh) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    } finally {
      setLoading(false);
      if (isBackgroundRefresh) setRefreshing(false);
    }
  }, [setLastUpdated, setRefreshing]);

  useEffect(() => {
    load(false);
  }, [load]);

  useEffect(() => {
    if (globalRefreshTrigger > 0) {
      load(true);
    }
  }, [globalRefreshTrigger, load]);

  return (
    <div>
      <h2 className="flex items-center gap-2 text-xl font-black text-white light:text-slate-900">
        <Megaphone size={20} className="text-indigo-400" /> Sponsorships
      </h2>
      <p className="mt-1 text-sm text-slate-400 light:text-slate-600">
        Every ad-sponsorship order — upload a sponsor's emailed assets and activate their 7-day run here.
      </p>

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
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-black ${tab === t.key ? "bg-white/20 text-white" : "bg-white/10 light:bg-black/10 text-slate-400 light:text-slate-700"}`}>
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
          placeholder="Search by company, email, or reference…"
          className="w-full bg-transparent text-sm text-white light:text-slate-900 outline-none placeholder:text-slate-500 light:placeholder:text-slate-600 font-medium"
        />
      </div>

      {tableMissing && (
        <div className="mt-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-xs leading-5 text-amber-300 light:text-amber-800 font-semibold">
          InPlayer-Sponsorships hasn&apos;t been created in AWS yet, so nothing can be listed until it exists.
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
          <Megaphone size={28} className="text-slate-500" />
          <p className="text-sm text-slate-500">{query ? `Nothing matches "${query}".` : "No sponsorships here yet."}</p>
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {filtered.map((s) => {
            const meta = STATUS_META[s.status] || STATUS_META.pending_payment;
            const Icon = meta.Icon;
            return (
              <Link
                key={s.sponsorshipId}
                href={`/admin/sponsorships/${s.sponsorshipId}`}
                className="flex items-center gap-3 rounded-2xl border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.02] p-3 transition hover:border-indigo-500/30"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-bold text-white light:text-slate-900">{s.companyName}</p>
                    <span className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide ${meta.cls}`}>
                      <Icon size={11} /> {meta.label}
                    </span>
                    {s.assetCount > 0 && (
                      <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-bold text-slate-400">{s.assetCount} asset(s)</span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-slate-400 light:text-slate-600">
                    {s.sections.join(", ")} · ₹{s.amountInr.toLocaleString("en-IN")} · {s.contactEmail}
                  </p>
                </div>
                <span className="flex-shrink-0 text-[11px] text-slate-500">{new Date(s.createdAt).toLocaleDateString("en-IN")}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
