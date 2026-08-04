"use client";

import { authedFetch } from "@/app/lib/apiFetch";
import { useEffect, useMemo, useState } from "react";
import {
  Loader2,
  AlertTriangle,
  ScrollText,
  UserX,
  UserCheck,
  Trash2,
  RotateCcw,
  ShieldCheck,
  ShieldX,
  MessageSquareOff,
  Flag,
  Megaphone,
  MapPin,
  Monitor,
  ShieldAlert,
  Search,
  LogOut,
} from "lucide-react";
import { formatTimeAgo } from "@/app/lib/formatters";

type AuditAction =
  | "user.suspend"
  | "user.unsuspend"
  | "user.delete"
  | "user.session_revoke"
  | "user.session_revoke_all"
  | "video.delete"
  | "video.restore"
  | "kyc.approve"
  | "kyc.reject"
  | "comment.restore"
  | "comment.delete"
  | "message.restore"
  | "message.delete"
  | "report.resolve"
  | "report.reopen"
  | "notification.broadcast";

interface AuditLogItem {
  logId: string;
  createdAt: string;
  adminEmail: string;
  action: AuditAction;
  targetType: string;
  targetId: string;
  targetLabel: string | null;
  details: string | null;
  location: string | null;
  device: string | null;
  ipAddress: string | null;
}

// One entry per real action app/lib/auditLog.ts can write — see that file
// for the full list of admin routes that call it. Kept in sync by hand
// since it's just display copy, not logic.
const ACTION_META: Record<
  AuditAction,
  { label: string; icon: typeof ScrollText; tone: "red" | "amber" | "emerald" | "sky" | "purple" }
> = {
  "user.suspend": { label: "Suspended user", icon: UserX, tone: "amber" },
  "user.unsuspend": { label: "Unsuspended user", icon: UserCheck, tone: "emerald" },
  "user.delete": { label: "Permanently deleted user", icon: Trash2, tone: "red" },
  "user.session_revoke": { label: "Force-logged-out one device", icon: LogOut, tone: "amber" },
  "user.session_revoke_all": { label: "Force-logged-out every device", icon: LogOut, tone: "amber" },
  "video.delete": { label: "Permanently deleted video/Short", icon: Trash2, tone: "red" },
  "video.restore": { label: "Restored video/Short", icon: RotateCcw, tone: "emerald" },
  "kyc.approve": { label: "Approved creator KYC", icon: ShieldCheck, tone: "emerald" },
  "kyc.reject": { label: "Rejected creator KYC", icon: ShieldX, tone: "red" },
  "comment.restore": { label: "Restored comment", icon: RotateCcw, tone: "emerald" },
  "comment.delete": { label: "Deleted comment", icon: MessageSquareOff, tone: "red" },
  "message.restore": { label: "Restored message", icon: RotateCcw, tone: "emerald" },
  "message.delete": { label: "Deleted message", icon: MessageSquareOff, tone: "red" },
  "report.resolve": { label: "Marked report resolved", icon: Flag, tone: "emerald" },
  "report.reopen": { label: "Reopened report", icon: Flag, tone: "amber" },
  "notification.broadcast": { label: "Sent a broadcast notification", icon: Megaphone, tone: "sky" },
};

const TONE_CLASSES: Record<string, string> = {
  red: "bg-red-500/15 text-red-300 light:bg-red-100 light:text-red-700 font-semibold",
  amber: "bg-amber-500/15 text-amber-300 light:bg-amber-100 light:text-amber-800 font-semibold",
  emerald: "bg-emerald-500/15 text-emerald-300 light:bg-emerald-100 light:text-emerald-800 font-semibold",
  sky: "bg-sky-500/15 text-sky-300 light:bg-sky-100 light:text-sky-800 font-semibold",
  purple: "bg-purple-500/15 text-purple-300 light:bg-purple-100 light:text-purple-800 font-semibold",
};

const FILTERS = [
  { id: "all", label: "All" },
  { id: "user", label: "Users" },
  { id: "video", label: "Videos & Shorts" },
  { id: "comment", label: "Comments" },
  { id: "message", label: "Messages" },
  { id: "report", label: "Reports" },
  { id: "notification", label: "Notifications" },
] as const;


function targetDisplay(item: AuditLogItem): string {
  if (item.targetType === "user" && item.targetLabel) return `@${item.targetLabel}`;
  // Trim the raw id so long DynamoDB keys (e.g. "videoId#commentId") don't
  // blow out the row — the full value is still in the title attribute.
  const id = item.targetId || "";
  return id.length > 28 ? `${id.slice(0, 28)}…` : id;
}

export default function AuditLogsPage() {
  const [items, setItems] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tableMissing, setTableMissing] = useState(false);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [query, setQuery] = useState("");
  const [viewerLocation, setViewerLocation] = useState<string | null>(null);
  const [viewerDevice, setViewerDevice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await authedFetch("/api/admin/audit-logs");
        if (!res.ok) throw new Error(`Couldn't load the audit log (HTTP ${res.status}).`);
        const data = await res.json();
        if (cancelled) return;
        setItems(data.items || []);
        setTableMissing(Boolean(data.tableMissing));
        setViewerLocation(data.viewerLocation || null);
        setViewerDevice(data.viewerDevice || null);
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

  const filtered = useMemo(() => {
    const byCategory = filter === "all" ? items : items.filter((i) => i.targetType === filter);
    const q = query.trim().toLowerCase();
    if (!q) return byCategory;
    return byCategory.filter((i) => {
      const label = (ACTION_META[i.action]?.label || i.action).toLowerCase();
      return (
        label.includes(q) ||
        i.targetId.toLowerCase().includes(q) ||
        (i.targetLabel || "").toLowerCase().includes(q) ||
        i.adminEmail.toLowerCase().includes(q) ||
        (i.details || "").toLowerCase().includes(q)
      );
    });
  }, [items, filter, query]);

  return (
    <div>
      <div>
        <h2 className="text-xl font-black text-white light:text-slate-900">Audit Logs</h2>
        <p className="mt-1 text-sm text-slate-400 light:text-slate-600">
          A real, permanent record of every admin action taken on InPlayer — what happened, when,
          and which browser/city it came from. Since there&apos;s only one admin email, device and
          location (not the email, which is always the same) are the real signal for spotting
          activity that wasn&apos;t actually you or your client — written the instant each action
          actually happens, nothing here is backfilled or simulated.
        </p>
        {(viewerDevice || viewerLocation) && (
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
            <span className="font-semibold text-slate-400">Your current session:</span>
            {viewerDevice && (
              <span className="flex items-center gap-1">
                <Monitor size={11} /> {viewerDevice}
              </span>
            )}
            {viewerLocation && (
              <span className="flex items-center gap-1">
                <MapPin size={11} /> {viewerLocation}
              </span>
            )}
          </p>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${
              filter === f.id
                ? "bg-indigo-500 text-white"
                : "bg-white/5 text-slate-400 light:text-slate-700 hover:bg-white/10 light:bg-black/5"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-2 rounded-2xl border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.02] px-4 py-3">
        <Search size={16} className="text-slate-500" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by action, target ID/username, admin, or details…"
          className="w-full bg-transparent text-sm text-white light:text-slate-900 outline-none placeholder:text-slate-500"
        />
      </div>

      {tableMissing && (
        <div className="mt-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-xs leading-5 text-amber-300 light:text-amber-700">
          The Audit Logs table (InPlayer-Audit-Logs) hasn&apos;t been created in AWS yet, so
          nothing can be logged or shown until it exists.
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
          <Loader2 size={24} className="animate-spin text-indigo-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-8 flex flex-col items-center gap-2 py-8 text-center">
          <ScrollText size={28} className="text-slate-500" />
          <p className="text-sm text-slate-500">
            {query
              ? `Nothing matches "${query}".`
              : items.length === 0
                ? "No admin actions logged yet."
                : "Nothing in this category yet."}
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {filtered.map((item) => {
            const meta = ACTION_META[item.action] || {
              label: item.action,
              icon: ScrollText,
              tone: "sky" as const,
            };
            const Icon = meta.icon;
            // A neutral "heads up" — not an alarm. Reno may genuinely use
            // more than one real device/location himself, so this is
            // informational (compare against what you actually remember
            // using), never a hard accusation.
            const deviceDiffers =
              Boolean(viewerDevice) && Boolean(item.device) && item.device !== viewerDevice;
            const locationDiffers =
              Boolean(viewerLocation) &&
              Boolean(item.location) &&
              item.location !== viewerLocation;
            const flagged = deviceDiffers || locationDiffers;

            return (
              <div
                key={item.logId}
                className={`flex items-start gap-3 rounded-2xl border p-4 ${
                  flagged
                    ? "border-amber-500/30 bg-amber-500/[0.06]"
                    : "border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.02]"
                }`}
              >
                <span
                  className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl ${TONE_CLASSES[meta.tone]}`}
                >
                  <Icon size={15} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white light:text-slate-900">
                    {meta.label}{" "}
                    <span
                      className="font-mono text-xs font-normal text-slate-400"
                      title={item.targetId}
                    >
                      {targetDisplay(item)}
                    </span>
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {item.adminEmail} · {formatTimeAgo(item.createdAt)}
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-400 light:text-slate-600">
                    <span className="flex items-center gap-1">
                      <Monitor size={11} /> {item.device || "Unknown device"}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin size={11} /> {item.location || "Unknown location"}
                    </span>
                    {item.ipAddress && (
                      <span className="font-mono text-[10px] text-slate-500">
                        {item.ipAddress}
                      </span>
                    )}
                    {flagged && (
                      <span className="flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-amber-300">
                        <ShieldAlert size={10} /> Different from your current session
                      </span>
                    )}
                  </p>
                  {item.details && (
                    <p className="mt-1 text-xs text-slate-400 light:text-slate-600">
                      &ldquo;{item.details}&rdquo;
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
