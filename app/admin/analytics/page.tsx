"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchAuthSession } from "aws-amplify/auth";
import {
  Loader2,
  AlertTriangle,
  Users,
  Video,
  Film,
  Eye,
  Heart,
  MessageCircle,
  Share2,
  TrendingUp,
  Flame,
} from "lucide-react";

interface AnalyticsTotals {
  totalUsers: number;
  totalVideos: number;
  totalShorts: number;
  lifetimeViews: number;
  lifetimeShares: number;
  totalLikes: number;
  totalComments: number;
  totalSubscriptions: number;
}

interface ViewsTrendPoint {
  date: string;
  views: number;
}

interface TopVideo {
  videoId: string;
  title: string;
  uploaderName: string;
  thumbnailUrl: string | null;
  windowViews: number;
}

async function authedFetch(path: string) {
  const session = await fetchAuthSession();
  const idToken = session.tokens?.idToken?.toString();
  if (!idToken) throw new Error("Session expired — please sign in again.");
  return fetch(path, { headers: { Authorization: `Bearer ${idToken}` } });
}

function fmt(n: number): string {
  return n.toLocaleString("en-IN");
}

function SummaryCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.02] p-5">
      <div className="flex items-center gap-2 text-slate-400 light:text-slate-600">
        <Icon size={15} />
        <span className="text-xs font-bold uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-black text-white light:text-slate-900">{value}</p>
    </div>
  );
}

function ViewsTrendChart({ points }: { points: ViewsTrendPoint[] }) {
  const max = Math.max(1, ...points.map((p) => p.views));
  return (
    <div className="flex h-40 items-end gap-2">
      {points.map((p) => (
        <div key={p.date} className="flex flex-1 flex-col items-center gap-2">
          <div className="flex w-full flex-1 items-end">
            <div
              className="w-full rounded-t-md bg-gradient-to-t from-orange-500/60 to-amber-400/60"
              style={{ height: `${Math.max(2, (p.views / max) * 100)}%` }}
              title={`${p.views} view${p.views === 1 ? "" : "s"} on ${p.date}`}
            />
          </div>
          <span className="text-[10px] font-semibold text-slate-500">
            {new Date(p.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function AdminAnalyticsPage() {
  const [totals, setTotals] = useState<AnalyticsTotals | null>(null);
  const [viewsTrend, setViewsTrend] = useState<ViewsTrendPoint[]>([]);
  const [topToday, setTopToday] = useState<TopVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await authedFetch("/api/admin/analytics");
        if (!res.ok) throw new Error(`Couldn't load analytics (HTTP ${res.status}).`);
        const data = await res.json();
        if (cancelled) return;
        setTotals(data.totals);
        setViewsTrend(data.viewsTrend || []);
        setTopToday(data.topToday || []);
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

  const totalViewsThisWeek = viewsTrend.reduce((sum, p) => sum + p.views, 0);

  return (
    <div>
      <div>
        <h2 className="text-xl font-black text-white light:text-slate-900">Analytics</h2>
        <p className="mt-1 text-sm text-slate-400 light:text-slate-600">
          Platform-wide numbers, summed straight from the same tables every view/like/comment
          already writes to. A quiet chart just means there hasn&apos;t been real traffic yet —
          not a broken page.
        </p>
      </div>

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
      ) : totals ? (
        <>
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard icon={Users} label="Total users" value={fmt(totals.totalUsers)} />
            <SummaryCard icon={Video} label="Videos" value={fmt(totals.totalVideos)} />
            <SummaryCard icon={Film} label="Shorts" value={fmt(totals.totalShorts)} />
            <SummaryCard icon={Eye} label="Lifetime views" value={fmt(totals.lifetimeViews)} />
            <SummaryCard icon={Heart} label="Total likes" value={fmt(totals.totalLikes)} />
            <SummaryCard
              icon={MessageCircle}
              label="Total comments"
              value={fmt(totals.totalComments)}
            />
            <SummaryCard icon={Share2} label="Total shares" value={fmt(totals.lifetimeShares)} />
            <SummaryCard
              icon={Users}
              label="Subscriptions"
              value={fmt(totals.totalSubscriptions)}
            />
          </div>

          <div className="mt-6 rounded-3xl border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.02] p-5">
            <div className="flex items-center gap-2 text-slate-300 light:text-slate-700">
              <TrendingUp size={15} />
              <h3 className="text-sm font-black uppercase tracking-wide">
                Views, last 7 days ({fmt(totalViewsThisWeek)} total)
              </h3>
            </div>
            <div className="mt-4">
              <ViewsTrendChart points={viewsTrend} />
            </div>
          </div>

          <div className="mt-6">
            <div className="flex items-center gap-2 text-slate-300 light:text-slate-700">
              <Flame size={15} />
              <h3 className="text-sm font-black uppercase tracking-wide">Trending today</h3>
            </div>

            {topToday.length === 0 ? (
              <div className="mt-3 flex flex-col items-center gap-2 rounded-2xl border border-white/10 light:border-black/10 bg-white/[0.02] py-10 text-center">
                <Flame size={26} className="text-slate-500" />
                <p className="text-sm text-slate-500">No views recorded yet today.</p>
              </div>
            ) : (
              <div className="mt-3 space-y-2">
                {topToday.map((v, i) => (
                  <Link
                    key={v.videoId}
                    href={`/watch/${v.videoId}`}
                    target="_blank"
                    className="flex items-center gap-3 rounded-2xl border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.02] p-3 transition hover:bg-white/[0.06]"
                  >
                    <span className="w-5 flex-shrink-0 text-center text-sm font-black text-slate-500">
                      {i + 1}
                    </span>
                    {v.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={v.thumbnailUrl}
                        alt=""
                        className="h-10 w-16 flex-shrink-0 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="h-10 w-16 flex-shrink-0 rounded-lg bg-white/10" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-white light:text-slate-900">
                        {v.title}
                      </p>
                      <p className="truncate text-xs text-slate-500">{v.uploaderName}</p>
                    </div>
                    <span className="flex flex-shrink-0 items-center gap-1 text-xs font-bold text-orange-300">
                      <Eye size={12} /> {fmt(v.windowViews)}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
