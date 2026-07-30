"use client";

import { useEffect, useState } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import {
  Loader2,
  AlertTriangle,
  IndianRupee,
  Wallet,
  Users,
  Receipt,
  ShieldCheck,
  CalendarClock,
} from "lucide-react";
import { formatTimeAgo } from "@/app/lib/formatters";

interface RevenueSummary {
  totalGrossInr: number;
  totalCreatorShareInr: number;
  totalPlatformShareInr: number;
  totalCharges: number;
  activeMemberships: number;
  verifiedCreatorCount: number;
  payoutWindowLabel: string;
  payoutWindowOpen: boolean;
}

interface CreatorRevenueRow {
  userId: string;
  username: string | null;
  kycStatus: string;
  lifetimeEarnedInr: number;
  lifetimePaidOutInr: number;
  pendingPayoutInr: number | null;
  payoutEligible: boolean;
  payoutFrequency: string | null;
  lastChargeAt: string | null;
}

async function authedFetch(path: string) {
  const session = await fetchAuthSession();
  const idToken = session.tokens?.idToken?.toString();
  if (!idToken) throw new Error("Session expired — please sign in again.");
  return fetch(path, { headers: { Authorization: `Bearer ${idToken}` } });
}

function inr(n: number): string {
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

const KYC_BADGE: Record<string, string> = {
  verified: "bg-emerald-500/15 text-emerald-300",
  pending_review: "bg-amber-500/15 text-amber-300",
  rejected: "bg-red-500/15 text-red-300",
};

function SummaryCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof IndianRupee;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.02] p-5">
      <div className="flex items-center gap-2 text-slate-400 light:text-slate-600">
        <Icon size={15} />
        <span className="text-xs font-bold uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-black text-white light:text-slate-900">{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

export default function AdminRevenuePage() {
  const [summary, setSummary] = useState<RevenueSummary | null>(null);
  const [creators, setCreators] = useState<CreatorRevenueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tableMissing, setTableMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await authedFetch("/api/admin/revenue");
        if (!res.ok) throw new Error(`Couldn't load revenue data (HTTP ${res.status}).`);
        const data = await res.json();
        if (cancelled) return;
        setSummary(data.summary);
        setCreators(data.creators || []);
        setTableMissing(Boolean(data.tableMissing));
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Something went wrong.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <div>
        <h2 className="text-xl font-black text-white light:text-slate-900">Revenue</h2>
        <p className="mt-1 text-sm text-slate-400 light:text-slate-600">
          Real money collected through paid memberships — every figure below is summed straight
          from confirmed Razorpay charges (InPlayer-Revenue-Ledger), not estimated from views.
        </p>
      </div>

      {tableMissing && (
        <div className="mt-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-xs leading-5 text-amber-300 light:text-amber-700">
          The revenue tables (InPlayer-Revenue-Ledger / InPlayer-Creator-Payouts) haven&apos;t
          been created in AWS yet, so nothing can be shown until they exist.
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
          <Loader2 size={24} className="animate-spin text-orange-400" />
        </div>
      ) : summary ? (
        <>
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <SummaryCard
              icon={IndianRupee}
              label="Total gross revenue"
              value={inr(summary.totalGrossInr)}
              sub={`${summary.totalCharges} confirmed charge${summary.totalCharges === 1 ? "" : "s"}`}
            />
            <SummaryCard
              icon={Wallet}
              label="Creator earnings (80%)"
              value={inr(summary.totalCreatorShareInr)}
            />
            <SummaryCard
              icon={Receipt}
              label="Platform's cut (20%)"
              value={inr(summary.totalPlatformShareInr)}
            />
            <SummaryCard
              icon={Users}
              label="Active memberships"
              value={String(summary.activeMemberships)}
            />
            <SummaryCard
              icon={ShieldCheck}
              label="Verified creators"
              value={String(summary.verifiedCreatorCount)}
            />
            <SummaryCard
              icon={CalendarClock}
              label="Payout window"
              value={summary.payoutWindowLabel}
              sub={summary.payoutWindowOpen ? "Open now (1st–5th)" : "Opens on the 1st"}
            />
          </div>

          <h3 className="mt-8 text-sm font-black uppercase tracking-wide text-slate-400 light:text-slate-600">
            Creator earnings
          </h3>

          {creators.length === 0 ? (
            <div className="mt-4 flex flex-col items-center gap-2 rounded-2xl border border-white/10 light:border-black/10 bg-white/[0.02] py-10 text-center">
              <Wallet size={26} className="text-slate-500" />
              <p className="text-sm text-slate-500">
                No creator has submitted KYC yet — this table fills in as real payout
                submissions come in.
              </p>
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-2xl border border-white/10 light:border-black/10">
              <table className="w-full text-left text-sm">
                <thead className="bg-white/[0.03] light:bg-black/[0.03] text-xs font-bold uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Creator</th>
                    <th className="px-4 py-3">KYC</th>
                    <th className="px-4 py-3">Lifetime earned</th>
                    <th className="px-4 py-3">Paid out</th>
                    <th className="px-4 py-3">Pending</th>
                    <th className="px-4 py-3">Frequency</th>
                    <th className="px-4 py-3">Last charge</th>
                  </tr>
                </thead>
                <tbody>
                  {creators.map((c) => (
                    <tr
                      key={c.userId}
                      className="border-t border-white/5 light:border-black/5"
                    >
                      <td className="px-4 py-3 font-semibold text-white light:text-slate-900">
                        {c.username ? `@${c.username}` : c.userId}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${
                            KYC_BADGE[c.kycStatus] || "bg-white/10 text-slate-300"
                          }`}
                        >
                          {c.kycStatus.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-200 light:text-slate-800">
                        {inr(c.lifetimeEarnedInr)}
                      </td>
                      <td className="px-4 py-3 text-slate-400">{inr(c.lifetimePaidOutInr)}</td>
                      <td className="px-4 py-3">
                        {c.pendingPayoutInr === null ? (
                          <span className="text-slate-500">—</span>
                        ) : (
                          <span
                            className={c.payoutEligible ? "text-emerald-300" : "text-slate-400"}
                          >
                            {inr(c.pendingPayoutInr)}
                            {c.payoutEligible && " · eligible"}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-400 capitalize">
                        {c.payoutFrequency || "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {c.lastChargeAt ? formatTimeAgo(c.lastChargeAt) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
