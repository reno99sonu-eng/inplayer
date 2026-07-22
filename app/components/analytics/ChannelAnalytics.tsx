"use client";

import { Eye, Heart, MessageCircle, Share2, Radar } from "lucide-react";
import StatCard from "./StatCard";
import TrendChart, { TrendPoint } from "./TrendChart";

export interface ContentStats {
  count: number;
  reach: number;
  views: number;
  likes: number;
  comments: number;
  shares: number;
}

export default function ChannelAnalytics({
  stats,
  trend,
  trendAvailable,
  loading,
}: {
  stats: ContentStats;
  trend: TrendPoint[];
  trendAvailable: boolean;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-[92px] animate-pulse rounded-2xl bg-white/[0.02] light:bg-black/[0.02]"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Reach" value={stats.reach} icon={Radar} />
        <StatCard label="Views" value={stats.views} icon={Eye} />
        <StatCard label="Likes" value={stats.likes} icon={Heart} />
        <StatCard label="Comments" value={stats.comments} icon={MessageCircle} />
        <StatCard label="Shares" value={stats.shares} icon={Share2} />
      </div>

      <TrendChart data={trend} trendAvailable={trendAvailable} />
    </div>
  );
}
