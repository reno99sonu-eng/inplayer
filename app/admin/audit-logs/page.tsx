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
  | "notification.broadcast"
  // Everything below was already being WRITTEN by the admin routes but was
  // missing from this map, so each one rendered as its raw action string
  // (e.g. "vendor.kyc_approve") with the generic fallback icon.
  | "monetization.suspend"
  | "monetization.unsuspend"
  | "settings.update"
  | "copyright.strike"
  | "copyright.dismiss"
  | "copyright.autosuspend"
  | "user.ban_strike"
  | "user.ban_lift"
  | "ad.create"
  | "ad.update"
  | "ad.delete"
  | "midroll_ad.create"
  | "midroll_ad.update"
  | "midroll_ad.delete"
  | "vendor.kyc_approve"
  | "vendor.kyc_reject"
  | "vendor.suspend"
  | "vendor.unsuspend"
  | "vendor.razorpay_retry"
  | "vendor.razorpay_sync"
  | "hammart_product.remove"
  | "hammart_product.restore"
  | "sponsorship.activate"
  | "sponsorship.cancel"
  | "sponsorship.banner_assets_uploaded";

type AuditDomain = "inplayer" | "hammart" | "sponsorship";

interface AuditLogItem {
  logId: string;
  createdAt: string;
  adminEmail: string;
  action: AuditAction;
  // Derived server-side from the action name (see auditDomainForAction in
  // app/lib/auditLog.ts) — not stored on the row, so historic entries
  // classify correctly too.
  domain: AuditDomain;
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
  "monetization.suspend": { label: "Suspended monetization", icon: ShieldX, tone: "amber" },
  "monetization.unsuspend": { label: "Restored monetization", icon: ShieldCheck, tone: "emerald" },
  "settings.update": { label: "Changed platform settings", icon: ScrollText, tone: "sky" },
  "copyright.strike": { label: "Issued a copyright strike", icon: ShieldAlert, tone: "red" },
  "copyright.dismiss": { label: "Dismissed a copyright claim", icon: ShieldCheck, tone: "emerald" },
  "copyright.autosuspend": { label: "Auto-suspended on 3rd copyright strike", icon: ShieldAlert, tone: "red" },
  "user.ban_strike": { label: "Upheld a strike-3 suspension", icon: ShieldAlert, tone: "red" },
  "user.ban_lift": { label: "Lifted a ban and reset strikes", icon: UserCheck, tone: "emerald" },
  "ad.create": { label: "Created an ad", icon: Megaphone, tone: "sky" },
  "ad.update": { label: "Updated an ad", icon: Megaphone, tone: "sky" },
  "ad.delete": { label: "Deleted an ad", icon: Trash2, tone: "red" },
  "midroll_ad.create": { label: "Created a mid-roll ad", icon: Megaphone, tone: "sky" },
  "midroll_ad.update": { label: "Updated a mid-roll ad", icon: Megaphone, tone: "sky" },
  "midroll_ad.delete": { label: "Deleted a mid-roll ad", icon: Trash2, tone: "red" },
  "vendor.kyc_approve": { label: "Approved vendor KYC", icon: ShieldCheck, tone: "emerald" },
  "vendor.kyc_reject": { label: "Rejected vendor KYC", icon: ShieldX, tone: "red" },
  "vendor.suspend": { label: "Suspended vendor", icon: UserX, tone: "amber" },
  "vendor.unsuspend": { label: "Unsuspended vendor", icon: UserCheck, tone: "emerald" },
  "vendor.razorpay_retry": { label: "Retried vendor Razorpay onboarding", icon: RotateCcw, tone: "sky" },
  "vendor.razorpay_sync": { label: "Synced vendor Razorpay status", icon: RotateCcw, tone: "sky" },
  "hammart_product.remove": { label: "Removed a Hammart product", icon: Trash2, tone: "red" },
  "hammart_product.restore": { label: "Restored a Hammart product", icon: RotateCcw, tone: "emerald" },
  "sponsorship.activate": { label: "Activated a sponsorship", icon: ShieldCheck, tone: "emerald" },
  "sponsorship.cancel": { label: "Cancelled a sponsorship", icon: ShieldX, tone: "red" },
  "sponsorship.banner_assets_uploaded": { label: "Uploaded sponsor banner assets", icon: Megaphone, tone: "sky" },
};

// Which admin panel each log belongs to. Previously every panel's actions
// were mixed into one list, so "what changed on Hammart today" was
// unanswerable — this is the same per-domain split the rest of the admin
// panel already uses (app/lib/siteDomain.ts).
const DOMAIN_TABS = [
  { id: "all", label: "All panels" },
  { id: "inplayer", label: "InPlayer" },
  { id: "hammart", label: "Ham Mart" },
  { id: "sponsorship", label: "Sponsorship" },
] as const;

const DOMAIN_BADGE: Record<AuditDomain, { label: string; className: string }> = {
  inplayer: { label: "InPlayer", className: "bg-orange-500/15 text-orange-300" },
  hammart: { label: "Ham Mart", className: "bg-emerald-500/15 text-emerald-300" },
  sponsorship: { label: "Sponsorship", className: "bg-purple-500/15 text-purple-300" },
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
  // These targetTypes are all written by logAdminAction but had no chip, so
  // their rows were reachable only under "All".
  { id: "settings", label: "Settings" },
  { id: "ad", label: "Ads" },
  { id: "midroll_ad", label: "Mid-roll ads" },
  { id: "vendor", label: "Vendors" },
  { id: "hammart_product", label: "Products" },
  { id: "sponsorship", label: "Sponsorships" },
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
  const [domain, setDomain] = useState<(typeof DOMAIN_TABS)[number]["id"]>("all");
  const [query, setQuery] = useState("");
  const [viewerLocation, setViewerLocation] = useState<string | null>(null);
  const [viewerDevice, setViewerDevice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        // Scoping happens server-side so the 300-row cap applies WITHIN the
        // chosen panel — filtering client-side would mean a busy InPlayer
        // day pushes every Hammart entry out of the window before it ever
        // reaches the browser.
        const res = await authedFetch(
          `/api/admin/audit-logs${domain === "all" ? "" : `?domain=${domain}`}`
        );
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
  }, [domain]);

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
        {DOMAIN_TABS.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => setDomain(d.id)}
            className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${
              domain === d.id
                ? "bg-orange-500 text-white shadow-md shadow-orange-500/20"
                : "bg-white/5 text-slate-400 light:text-slate-700 hover:bg-white/10 light:bg-black/5"
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
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
                  <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm font-semibold text-white light:text-slate-900">
                    {/* Which panel this came from — only worth showing in the
                        "All panels" view; inside a single panel every row
                        would carry the same badge. */}
                    {domain === "all" && item.domain && DOMAIN_BADGE[item.domain] && (
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide ${DOMAIN_BADGE[item.domain].className}`}
                      >
                        {DOMAIN_BADGE[item.domain].label}
                      </span>
                    )}
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
