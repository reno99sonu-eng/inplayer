"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, AlertTriangle, Eye, MousePointerClick, Clock, CheckCircle2, XCircle, Ban } from "lucide-react";
import { useAuthModal } from "@/app/components/auth/AuthProvider";
import { authedFetch } from "@/app/lib/apiFetch";

interface SponsorshipRow {
  sponsorshipId: string;
  companyName: string;
  packageType: string;
  sections: string[];
  amountInr: number;
  paymentStatus: "pending" | "paid" | "failed";
  status: "pending_payment" | "awaiting_assets" | "active" | "expired" | "cancelled";
  activatedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

interface AnalyticsRow {
  section: string;
  impressions: number;
  clicks: number;
  skips?: number;
}

const SECTION_LABELS: Record<string, string> = {
  midroll: "Mid-Roll Video Ad",
  homepage_banner: "Homepage Banner",
  watch_banner: "Watch Page Banner",
};

const STATUS_META: Record<string, { label: string; cls: string; Icon: typeof Clock }> = {
  pending_payment: { label: "Awaiting payment", cls: "bg-amber-500/15 text-amber-300", Icon: Clock },
  awaiting_assets: { label: "Awaiting your assets", cls: "bg-sky-500/15 text-sky-300", Icon: Clock },
  active: { label: "Live", cls: "bg-emerald-500/15 text-emerald-300", Icon: CheckCircle2 },
  expired: { label: "Expired", cls: "bg-white/10 text-slate-400", Icon: XCircle },
  cancelled: { label: "Cancelled", cls: "bg-red-500/15 text-red-300", Icon: Ban },
};

function timeRemaining(expiresAt: string | null): string | null {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return null;
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  const hours = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  return days > 0 ? `${days}d ${hours}h left` : `${hours}h left`;
}

export default function SponsorshipDashboardPage() {
  const { signedIn, authLoading, openSignIn } = useAuthModal();
  const [rows, setRows] = useState<SponsorshipRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<Record<string, AnalyticsRow[]>>({});
  const [analyticsLoading, setAnalyticsLoading] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!signedIn) {
      openSignIn();
      return;
    }
    (async () => {
      try {
        const res = await authedFetch("/api/sponsorships");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Couldn't load your sponsorships.");
        setRows(data.sponsorships || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      } finally {
        setLoading(false);
      }
    })();
  }, [authLoading, signedIn, openSignIn]);

  const toggleExpand = async (sponsorshipId: string) => {
    if (expandedId === sponsorshipId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(sponsorshipId);
    if (!analytics[sponsorshipId]) {
      setAnalyticsLoading(sponsorshipId);
      try {
        const res = await authedFetch(`/api/sponsorships/${sponsorshipId}`);
        const data = await res.json();
        setAnalytics((prev) => ({ ...prev, [sponsorshipId]: data.analytics || [] }));
      } catch (err) {
        console.error("Failed to load sponsorship analytics:", err);
      } finally {
        setAnalyticsLoading(null);
      }
    }
  };

  return (
    <div className="mx-auto max-w-[900px] px-4 py-8 sm:px-6 lg:px-8">
      <Link href="/sponsorships" className="mb-4 flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white light:text-slate-600 light:hover:text-slate-900">
        <ArrowLeft size={14} /> Back to sponsorship packages
      </Link>

      <h1 className="text-xl font-black text-white light:text-slate-900 sm:text-2xl">My Sponsorships</h1>
      <p className="mt-1 text-xs text-slate-400 light:text-slate-600 sm:text-sm">
        Every ad campaign you've purchased on InPlayer, with real views and clicks once it's live.
      </p>

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm font-semibold text-red-300 light:text-red-800">
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <Loader2 size={24} className="animate-spin text-indigo-400" />
        </div>
      ) : rows.length === 0 ? (
        <div className="mt-8 flex flex-col items-center gap-2 py-10 text-center">
          <p className="text-sm text-slate-500">You haven't sponsored an ad yet.</p>
          <Link href="/sponsorships" className="mt-2 rounded-xl bg-orange-500 px-4 py-2 text-xs font-bold text-white">
            View packages
          </Link>
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {rows.map((row) => {
            const meta = STATUS_META[row.status] || STATUS_META.pending_payment;
            const Icon = meta.Icon;
            const remaining = row.status === "active" ? timeRemaining(row.expiresAt) : null;
            const isExpanded = expandedId === row.sponsorshipId;
            const rowAnalytics = analytics[row.sponsorshipId] || [];

            return (
              <div key={row.sponsorshipId} className="rounded-2xl border border-white/10 bg-[#071120] p-4 light:border-black/10 light:bg-white">
                <button
                  onClick={() => toggleExpand(row.sponsorshipId)}
                  className="flex w-full flex-wrap items-center justify-between gap-2 text-left"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-black text-white light:text-slate-900">{row.companyName}</p>
                      <span className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide ${meta.cls}`}>
                        <Icon size={11} /> {meta.label}
                      </span>
                      {remaining && (
                        <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-bold text-slate-300 light:bg-black/5 light:text-slate-700">
                          {remaining}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-slate-400 light:text-slate-600">
                      {row.sections.map((s) => SECTION_LABELS[s] || s).join(", ")} · ₹{row.amountInr.toLocaleString("en-IN")}
                    </p>
                  </div>
                  <span className="text-[11px] text-slate-500">{new Date(row.createdAt).toLocaleDateString("en-IN")}</span>
                </button>

                {row.status === "pending_payment" && (
                  <p className="mt-2 text-[11px] text-amber-300">Payment not confirmed yet — this may just need a moment.</p>
                )}
                {row.status === "awaiting_assets" && (
                  <p className="mt-2 text-[11px] text-sky-300">
                    Paid — email your assets to inplayerdigital@gmail.com with reference {row.sponsorshipId} to go live.
                  </p>
                )}

                {isExpanded && (
                  <div className="mt-3 border-t border-white/10 pt-3 light:border-black/10">
                    {analyticsLoading === row.sponsorshipId ? (
                      <Loader2 size={16} className="animate-spin text-indigo-400" />
                    ) : rowAnalytics.length === 0 ? (
                      <p className="text-xs text-slate-500">No views or clicks yet.</p>
                    ) : (
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {rowAnalytics.map((a) => (
                          <div key={a.section} className="rounded-xl bg-white/[0.03] p-2.5 light:bg-black/[0.02]">
                            <p className="text-[11px] font-bold text-slate-300 light:text-slate-700">{SECTION_LABELS[a.section] || a.section}</p>
                            <div className="mt-1 flex items-center gap-3 text-[11px] text-slate-400 light:text-slate-600">
                              <span className="flex items-center gap-1"><Eye size={11} /> {a.impressions.toLocaleString("en-IN")}</span>
                              <span className="flex items-center gap-1"><MousePointerClick size={11} /> {a.clicks.toLocaleString("en-IN")}</span>
                              {typeof a.skips === "number" && <span>{a.skips.toLocaleString("en-IN")} skipped</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
