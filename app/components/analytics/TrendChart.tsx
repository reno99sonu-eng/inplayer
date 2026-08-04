"use client";

import { useId, useMemo, useState } from "react";
import { TrendingUp } from "lucide-react";

export interface TrendPoint {
  date: string; // YYYY-MM-DD
  views: number;
  likes: number;
  comments: number;
  shares: number;
}

interface Metric {
  key: keyof Omit<TrendPoint, "date">;
  label: string;
}

const METRICS: Metric[] = [
  { key: "views", label: "Views" },
  { key: "likes", label: "Likes" },
  { key: "comments", label: "Comments" },
  { key: "shares", label: "Shares" },
];

const WIDTH = 640;
const HEIGHT = 220;
const PAD_X = 8;
const PAD_TOP = 16;
const PAD_BOTTOM = 28;

function formatShortDate(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// A small, dependency-free area/line chart. No charting library is in this
// project yet, so this trades a bit of polish (no fancy tooltips) for zero
// added dependencies and full control over the premium look.
export default function TrendChart({
  data,
  trendAvailable = true,
}: {
  data: TrendPoint[];
  trendAvailable?: boolean;
}) {
  const gradientId = useId();
  const [metric, setMetric] = useState<Metric["key"]>("views");

  const { pathLine, pathArea, points, maxValue } = useMemo(() => {
    if (data.length < 2) {
      return { pathLine: "", pathArea: "", points: [] as { x: number; y: number; v: number }[], maxValue: 0 };
    }

    const values = data.map((d) => d[metric]);
    const max = Math.max(...values, 1);
    const innerW = WIDTH - PAD_X * 2;
    const innerH = HEIGHT - PAD_TOP - PAD_BOTTOM;

    const pts = data.map((d, i) => {
      const x = PAD_X + (i / (data.length - 1)) * innerW;
      const y = PAD_TOP + innerH - (d[metric] / max) * innerH;
      return { x, y, v: d[metric] };
    });

    const line = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
    const area =
      line +
      ` L ${pts[pts.length - 1].x.toFixed(1)} ${(HEIGHT - PAD_BOTTOM).toFixed(1)}` +
      ` L ${pts[0].x.toFixed(1)} ${(HEIGHT - PAD_BOTTOM).toFixed(1)} Z`;

    return { pathLine: line, pathArea: area, points: pts, maxValue: max };
  }, [data, metric]);

  const hasHistory = trendAvailable && data.length >= 2;

  return (
    <div
      className="
        rounded-2xl border border-white/10 light:border-black/10
        bg-white/[0.02] light:bg-black/[0.015]
        p-4 sm:p-5
      "
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-white light:text-slate-900">
          Performance over time
        </h3>

        {trendAvailable && data.length >= 1 && (
          <div className="flex flex-wrap gap-1.5">
            {METRICS.map((m) => (
              <button
                key={m.key}
                onClick={() => setMetric(m.key)}
                className={`
                  rounded-full px-3 py-1 text-xs font-semibold transition-all duration-300
                  ${
                    metric === m.key
                      ? "bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] text-white shadow-[0_4px_14px_rgba(255,153,0,.35)]"
                      : "text-slate-400 light:text-slate-600 hover:bg-white/5 light:hover:bg-black/5"
                  }
                `}
              >
                {m.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {hasHistory ? (
        <div className="mt-3">
          <svg
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            className="h-[180px] w-full sm:h-[220px]"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FF9A00" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#FF9A00" stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Gridlines */}
            {[0.25, 0.5, 0.75].map((f) => (
              <line
                key={f}
                x1={PAD_X}
                x2={WIDTH - PAD_X}
                y1={PAD_TOP + (HEIGHT - PAD_TOP - PAD_BOTTOM) * f}
                y2={PAD_TOP + (HEIGHT - PAD_TOP - PAD_BOTTOM) * f}
                stroke="currentColor"
                strokeOpacity="0.08"
                strokeWidth="1"
                className="text-slate-400 light:text-slate-500"
              />
            ))}

            <path d={pathArea} fill={`url(#${gradientId})`} stroke="none" />
            <path
              d={pathLine}
              fill="none"
              stroke="#FF9A00"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {points.map((p, i) => (
              <circle
                key={i}
                cx={p.x}
                cy={p.y}
                r={i === points.length - 1 ? 4 : 2.5}
                fill="#FFD54A"
                stroke="#0B1220"
                strokeWidth="1.5"
              />
            ))}
          </svg>

          <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500 light:text-slate-500">
            <span>{formatShortDate(data[0].date)}</span>
            <span className="font-semibold text-slate-300 light:text-slate-600">
              peak {maxValue.toLocaleString()}
            </span>
            <span>{formatShortDate(data[data.length - 1].date)}</span>
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-dashed border-white/10 light:border-black/15 px-6 py-8">
          {trendAvailable ? (
            <div className="flex flex-col items-center text-center">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-300 light:text-emerald-700">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                Real data — no demo numbers
              </span>

              {/* The one real number we DO already have (today's, so far)
                  stands in for the chart until there's a second day to
                  draw a line between — better than an empty promise. */}
              {data.length >= 1 ? (
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="text-3xl font-black text-white light:text-slate-900">
                    {data[data.length - 1][metric].toLocaleString()}
                  </span>
                  <span className="text-sm font-semibold text-slate-400 light:text-slate-600">
                    {METRICS.find((m) => m.key === metric)?.label.toLowerCase()} today
                  </span>
                </div>
              ) : (
                <p className="mt-4 text-sm font-semibold text-slate-300 light:text-slate-700">
                  Today is day one
                </p>
              )}

              <svg viewBox="0 0 200 36" className="mx-auto mt-5 h-7 w-40 text-orange-400/40">
                <path
                  d="M2 30 L30 24 L58 27 L86 16 L114 20 L142 9 L170 13 L198 3"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeDasharray="4 4"
                  strokeLinecap="round"
                />
              </svg>

              <p className="mt-4 max-w-xs text-xs text-slate-500 light:text-slate-500">
                {data.length >= 1
                  ? "One real day logged. This line draws itself in the moment there's a second day to compare it to — no waiting on us, just on tomorrow."
                  : "Nothing logged yet today. Check back once today's numbers come in."}
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center text-center">
              <TrendingUp size={22} className="mb-2 text-orange-400/70" />
              <p className="text-sm font-semibold text-slate-300 light:text-slate-700">
                Trend history isn&apos;t set up yet
              </p>
              <p className="mt-1 max-w-xs text-xs text-slate-500 light:text-slate-500">
                Ask your developer to finish the analytics setup for day-by-day trends.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
