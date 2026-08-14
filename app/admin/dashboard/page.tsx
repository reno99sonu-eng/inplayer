"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import Link from "next/link";
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
import { useAdminRefresh } from "@/app/components/admin/AdminRefreshContext";

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
  const cancelledRef = useRef(false);
  const { setRefreshing, setLastUpdated, globalRefreshTrigger } = useAdminRefresh();

  // The API (/api/admin/dashboard-stats) already runs a fresh, uncached
  // DynamoDB scan on every single request — the numbers it returns are
  // never stale. What WAS stale is this page: it used to fetch exactly
  // once on mount and never again, so leaving the tab open showed the same
  // frozen snapshot indefinitely (no error, just no update) — that's what
  // read as "not real-time." Now it polls every 30s in the background,
  // same convention already used by Admin > Notifications and Admin >
  // Error Logs, plus this one function also backs the manual Refresh
  // button for "check right now" without waiting for the next tick.
  const load = useCallback(async (isBackgroundRefresh: boolean) => {
    if (isBackgroundRefresh) setRefreshing(true);
    try {
      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken?.toString();
      if (!idToken) throw new Error("Session expired — please sign in again.");

      const res = await fetch("/api/admin/dashboard-stats", {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!res.ok) throw new Error(`Couldn't load dashboard stats (HTTP ${res.status}).`);

      const data = await res.json();
      if (!cancelledRef.current) {
        setStats(data);
        setError(null);
        setLastUpdated(new Date());
      }
    } catch (err) {
      if (!cancelledRef.current && !isBackgroundRefresh) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      } else if (!cancelledRef.current) {
        console.error("Dashboard refresh failed:", err);
      }
    } finally {
      if (!cancelledRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [setLastUpdated, setRefreshing]);

  useEffect(() => {
    cancelledRef.current = false;
    load(false);
    const interval = setInterval(() => load(true), 30000);

    return () => {
      cancelledRef.current = true;
      clearInterval(interval);
    };
  }, [load]);

  useEffect(() => {
    if (globalRefreshTrigger > 0) {
      load(true);
    }
  }, [globalRefreshTrigger, load]);

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

  // Each card now links straight to the admin section it summarizes —
  // Reno asked for the dashboard cards to actually take you somewhere
  // instead of being read-only numbers. "Total Views" doesn't have its own
  // dedicated page anywhere in the admin panel (it's a Videos+Shorts
  // aggregate, not a section of its own), so it points at Analytics — the
  // one existing page that breaks views down further — rather than a href
  // that doesn't really represent what the number means.
  const cards = [
    {
      label: "Total Users",
      value: formatNumber(stats.totalUsers),
      icon: Users,
      href: "/admin/users",
      accent: "from-indigo-500/20 to-violet-400/10 border-indigo-400/20 text-indigo-300 light:text-indigo-700",
    },
    {
      label: "Total Videos",
      value: formatNumber(stats.totalVideos),
      icon: Video,
      href: "/admin/videos?type=video",
      accent: "from-sky-500/20 to-cyan-400/10 border-sky-400/20 text-sky-300 light:text-sky-700",
    },
    {
      label: "Total Shorts",
      value: formatNumber(stats.totalShorts),
      icon: Film,
      href: "/admin/videos?type=short",
      accent: "from-fuchsia-500/20 to-pink-400/10 border-fuchsia-400/20 text-fuchsia-300 light:text-fuchsia-700",
    },
    {
      label: "Total Views",
      value: formatNumber(stats.totalViews),
      icon: Eye,
      href: "/admin/analytics",
      accent: "from-emerald-500/20 to-teal-400/10 border-emerald-400/20 text-emerald-300 light:text-emerald-700",
    },
    {
      label: "Pending Reports",
      value: stats.reportsTableMissing ? "—" : formatNumber(stats.pendingReports),
      icon: Flag,
      href: "/admin/moderation",
      accent: "from-red-500/20 to-rose-400/10 border-red-400/20 text-red-300 light:text-red-700",
    },
    {
      label: "Processing Uploads",
      value: formatNumber(stats.processingCount),
      icon: Clock,
      href: "/admin/videos?status=processing",
      accent: "from-slate-500/20 to-slate-400/10 border-slate-400/20 text-slate-300 light:text-slate-700",
    },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-white light:text-slate-900">Overview</h2>
          <p className="mt-1 text-sm text-slate-400 light:text-slate-600">
            Live counts straight from InPlayer&apos;s database — nothing here is estimated.
            Refreshes itself every 30 seconds.
          </p>
        </div>
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
            <Link
              key={card.label}
              href={card.href}
              className={`block rounded-3xl border bg-gradient-to-br p-5 transition hover:brightness-110 hover:-translate-y-0.5 ${card.accent}`}
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
            </Link>
          );
        })}
      </div>
    </div>
  );
}
