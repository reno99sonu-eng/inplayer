"use client";

import { useEffect, useState } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import {
  Users,
  Video,
  Film,
  Eye,
  Flag,
  Loader2,
  AlertTriangle,
  Clock,
} from "lucide-react";

interface DashboardStats {
  totalUsers: number;
  totalVideos: number;
  totalShorts: number;
  totalViews: number;
  processingCount: number;
  pendingReports: number;
  reportsTableMissing: boolean;
}

function formatNumber(n: number): string {
  return n.toLocaleString("en-IN");
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const session = await fetchAuthSession();
        const idToken = session.tokens?.idToken?.toString();
        if (!idToken) throw new Error("Session expired — please sign in again.");

        const res = await fetch("/api/admin/dashboard-stats", {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        if (!res.ok) throw new Error(`Couldn't load dashboard stats (HTTP ${res.status}).`);

        const data = await res.json();
        if (!cancelled) setStats(data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Something went wrong.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 size={26} className="animate-spin text-indigo-400" />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="flex items-start gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300 light:text-red-700">
        <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
        <span>{error || "Couldn't load dashboard stats."}</span>
      </div>
    );
  }

  const cards = [
    {
      label: "Total Users",
      value: formatNumber(stats.totalUsers),
      icon: Users,
      accent: "from-indigo-500/20 to-violet-400/10 border-indigo-400/20 text-indigo-300",
    },
    {
      label: "Total Videos",
      value: formatNumber(stats.totalVideos),
      icon: Video,
      accent: "from-sky-500/20 to-cyan-400/10 border-sky-400/20 text-sky-300",
    },
    {
      label: "Total Shorts",
      value: formatNumber(stats.totalShorts),
      icon: Film,
      accent: "from-fuchsia-500/20 to-pink-400/10 border-fuchsia-400/20 text-fuchsia-300",
    },
    {
      label: "Total Views",
      value: formatNumber(stats.totalViews),
      icon: Eye,
      accent: "from-emerald-500/20 to-teal-400/10 border-emerald-400/20 text-emerald-300",
    },
    {
      label: "Pending Reports",
      value: stats.reportsTableMissing ? "—" : formatNumber(stats.pendingReports),
      icon: Flag,
      accent: "from-red-500/20 to-rose-400/10 border-red-400/20 text-red-300",
    },
    {
      label: "Processing Uploads",
      value: formatNumber(stats.processingCount),
      icon: Clock,
      accent: "from-slate-500/20 to-slate-400/10 border-slate-400/20 text-slate-300",
    },
  ];

  return (
    <div>
      <div>
        <h2 className="text-xl font-black text-white light:text-slate-900">Overview</h2>
        <p className="mt-1 text-sm text-slate-400 light:text-slate-600">
          Live counts straight from InPlayer&apos;s database — nothing here is estimated.
        </p>
      </div>

      {stats.reportsTableMissing && (
        <div className="mt-4 flex items-start gap-2 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-300 light:text-amber-700">
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
          <span>
            The Reports table (InPlayer-Reports) hasn&apos;t been created in AWS yet, so
            &quot;Pending Reports&quot; can&apos;t be counted until it exists. This doesn&apos;t
            affect anything else here.
          </span>
        </div>
      )}

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className={`rounded-3xl border bg-gradient-to-br p-5 ${card.accent}`}
            >
              <div className="flex items-center gap-2">
                <Icon size={18} />
                <span className="text-xs font-bold uppercase tracking-[.14em] text-slate-300 light:text-slate-700">
                  {card.label}
                </span>
              </div>
              <p className="mt-3 text-3xl font-black text-white light:text-slate-900">
                {card.value}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
