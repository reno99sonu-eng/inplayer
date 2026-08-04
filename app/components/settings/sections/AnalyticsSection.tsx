"use client";

import { useEffect, useState, type ReactNode } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import { BarChart3, Eye, Film, TrendingUp, Loader2 } from "lucide-react";
import SettingsCard from "../common/SettingsCard";
import { useAuthModal } from "@/app/components/auth/AuthProvider";
import { formatViews } from "@/app/lib/formatters";

interface VideoStat {
  videoId: string;
  title: string;
  views: number;
  status: string;
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.03] p-4">
      <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.06] light:bg-black/[0.05] text-slate-300 light:text-slate-700">
        {icon}
      </div>
      <p className="text-xl font-black text-white light:text-slate-900">{value}</p>
      <p className="mt-0.5 text-[11px] font-medium text-slate-500 light:text-slate-600">{label}</p>
    </div>
  );
}

export default function AnalyticsSection() {
  const { signedIn, authLoading } = useAuthModal();
  const [videos, setVideos] = useState<VideoStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;

    (() => {
      if (!signedIn) {
        setLoading(false);
        return;
      }

      async function load() {
        try {
          const session = await fetchAuthSession();
          const idToken = session.tokens?.idToken?.toString();

          const res = await fetch("/api/my-videos", {
            headers: { Authorization: `Bearer ${idToken}` },
          });
          const data = await res.json();
          setVideos(data.videos || []);
        } catch (err) {
          console.error("Failed to load analytics:", err);
        } finally {
          setLoading(false);
        }
      }

      load();
    })();
  }, [signedIn, authLoading]);

  const totalViews = videos.reduce((sum, v) => sum + (v.views || 0), 0);
  const readyVideos = videos.filter((v) => v.status === "ready");
  const topVideo = [...videos].sort(
    (a, b) => (b.views || 0) - (a.views || 0)
  )[0];
  const avgViews = readyVideos.length
    ? Math.round(totalViews / readyVideos.length)
    : 0;

  return (
    <SettingsCard
      icon={<BarChart3 size={24} />}
      title="User Analytics"
      description="Performance across everything you've uploaded."
    >
      {!signedIn && !authLoading && (
        <p className="text-sm text-slate-400 light:text-slate-600">
          Sign in to see analytics for your uploads.
        </p>
      )}

      {loading && signedIn && (
        <div className="flex items-center gap-2 text-sm text-slate-400 light:text-slate-600">
          <Loader2 size={16} className="animate-spin" />
          Loading your analytics…
        </div>
      )}

      {!loading && signedIn && videos.length === 0 && (
        <p className="text-sm text-slate-400 light:text-slate-600">
          You haven&apos;t uploaded anything yet — once you do, your views and
          performance will show up here.
        </p>
      )}

      {!loading && signedIn && videos.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              icon={<Film size={16} />}
              label="Uploads"
              value={videos.length}
            />
            <StatCard
              icon={<Eye size={16} />}
              label="Total Views"
              value={totalViews.toLocaleString()}
            />
            <StatCard
              icon={<TrendingUp size={16} />}
              label="Avg. Views"
              value={avgViews.toLocaleString()}
            />
            <StatCard
              icon={<BarChart3 size={16} />}
              label="Published"
              value={readyVideos.length}
            />
          </div>

          {topVideo && (
            <div className="mt-6 rounded-2xl border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.03] p-5">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 light:text-slate-600">
                Top Performer
              </p>
              <p className="mt-2 line-clamp-1 text-lg font-bold text-white light:text-slate-900">
                {topVideo.title}
              </p>
              <p className="mt-1 text-sm text-slate-400 light:text-slate-600">
                {formatViews(topVideo.views || 0)}
              </p>
            </div>
          )}
        </>
      )}
    </SettingsCard>
  );
}
