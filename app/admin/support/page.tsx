"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  LifeBuoy,
  RefreshCw,
  Sparkles,
  User,
  ChevronDown,
  AlertCircle,
} from "lucide-react";
import { authedFetch } from "@/app/lib/apiFetch";
import { useAdminMode } from "@/app/components/admin/AdminModeContext";
import type {
  SupportTicket,
  SupportTicketStatus,
} from "@/app/lib/supportChat";

// ── AI Support Desk: admin view ─────────────────────────────────────────
// Reads its domain straight off the current admin mode, so the InPlayer
// panel and the Hammart panel each show only their own conversations —
// the same per-panel isolation Error Logs and Bug Reports already apply.
// Sponsorship has no support desk of its own (that panel's contact route
// is email), so it shows an honest empty state rather than InPlayer's data.

const STATUS_TABS: { id: SupportTicketStatus | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "open", label: "Needs a human" },
  { id: "in_progress", label: "In progress" },
  { id: "ai_resolved", label: "AI resolved" },
  { id: "resolved", label: "Closed" },
  { id: "abandoned", label: "Unfinished" },
];

const STATUS_STYLES: Record<SupportTicketStatus, string> = {
  open: "bg-red-500/10 text-red-300 light:bg-red-100 light:text-red-800",
  in_progress: "bg-amber-500/10 text-amber-300 light:bg-amber-100 light:text-amber-800",
  ai_resolved: "bg-emerald-500/10 text-emerald-300 light:bg-emerald-100 light:text-emerald-800",
  resolved: "bg-sky-500/10 text-sky-300 light:bg-sky-100 light:text-sky-800",
  abandoned: "bg-white/5 text-slate-400 light:bg-slate-200 light:text-slate-700",
};

const STATUS_LABELS: Record<SupportTicketStatus, string> = {
  open: "Needs a human",
  in_progress: "In progress",
  ai_resolved: "AI resolved",
  resolved: "Closed",
  abandoned: "Unfinished",
};

const PRIORITY_STYLES: Record<string, string> = {
  urgent: "bg-red-500/15 text-red-300 light:bg-red-100 light:text-red-800",
  high: "bg-orange-500/15 text-orange-300 light:bg-orange-100 light:text-orange-800",
  normal: "bg-white/5 text-slate-400 light:bg-slate-200 light:text-slate-700",
  low: "bg-white/5 text-slate-400 light:bg-slate-200 light:text-slate-700",
};

interface Counts {
  total: number;
  open: number;
  in_progress: number;
  ai_resolved: number;
  resolved: number;
  abandoned: number;
}

export default function AdminSupportPage() {
  const { mode } = useAdminMode();
  const domain = mode === "hammart" ? "hammart" : "inplayer";
  const supported = mode === "inplayer" || mode === "hammart";

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [tableMissing, setTableMissing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<SupportTicketStatus | "all">("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supported) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const qs = new URLSearchParams({ domain });
      if (filter !== "all") qs.set("status", filter);
      const res = await authedFetch(`/api/admin/support?${qs.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setTickets(data.tickets || []);
        setCounts(data.counts || null);
        setTableMissing(Boolean(data.tableMissing));
      }
    } catch (err) {
      console.error("Failed to load support tickets:", err);
    } finally {
      setLoading(false);
    }
  }, [domain, filter, supported]);

  useEffect(() => {
    load();
  }, [load]);

  const setStatus = async (ticketId: string, status: SupportTicketStatus) => {
    setUpdating(ticketId);
    try {
      const res = await authedFetch("/api/admin/support", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId, status }),
      });
      if (res.ok) {
        setTickets((cur) =>
          cur.map((t) => (t.ticketId === ticketId ? { ...t, status } : t))
        );
      }
    } catch (err) {
      console.error("Failed to update ticket:", err);
    } finally {
      setUpdating(null);
    }
  };

  const productName = domain === "hammart" ? "Hammart" : "InPlayer";

  if (!supported) {
    return (
      <div className="p-6">
        <EmptyCard
          title="No support desk on this panel"
          body="The AI Support Desk runs for InPlayer and Hammart. Switch panels to see their conversations."
        />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-500/15">
            <LifeBuoy size={20} className="text-orange-400 light:text-orange-600" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-white light:text-slate-900">
              {productName} Support Desk
            </h1>
            <p className="text-xs font-medium text-slate-400 light:text-slate-600">
              Every AI support conversation from {productName}, newest first.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 rounded-xl border border-white/10 light:border-slate-300 bg-white/5 light:bg-white px-3 py-2 text-xs font-bold text-slate-200 light:text-slate-800 light:shadow-sm transition hover:border-orange-400/50 disabled:opacity-50"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Status tabs with real counts */}
      <div className="mb-4 flex flex-wrap gap-2">
        {STATUS_TABS.map((tab) => {
          const count =
            tab.id === "all" ? counts?.total : counts?.[tab.id as keyof Counts];
          const active = filter === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                active
                  ? "bg-orange-500 text-white"
                  : "border border-white/10 light:border-slate-300 bg-white/5 light:bg-white text-slate-300 light:text-slate-700 light:shadow-sm hover:border-orange-400/50"
              }`}
            >
              {tab.label}
              {typeof count === "number" && (
                <span
                  className={`rounded-full px-1.5 text-[10px] ${
                    active
                      ? "bg-white/25"
                      : "bg-white/10 light:bg-slate-200 light:text-slate-800"
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {tableMissing && (
        <div className="mb-4 flex items-start gap-2 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3">
          <AlertCircle size={16} className="mt-0.5 flex-shrink-0 text-amber-400 light:text-amber-600" />
          <p className="text-xs font-medium leading-5 text-amber-300 light:text-amber-800">
            The <span className="font-mono font-bold">InPlayer-Support-Tickets</span>{" "}
            table doesn&apos;t exist in DynamoDB yet — create it with{" "}
            <span className="font-mono font-bold">ticketId</span> as the partition
            key. Until then, support chat still answers people normally; the
            conversations just aren&apos;t being recorded here.
          </p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-orange-400" />
        </div>
      ) : tickets.length === 0 ? (
        <EmptyCard
          title="No conversations yet"
          body={`When someone opens support on ${productName}, the full conversation shows up here.`}
        />
      ) : (
        <div className="space-y-2.5">
          {tickets.map((t) => {
            const isOpen = expanded === t.ticketId;
            return (
              <div
                key={t.ticketId}
                className="overflow-hidden rounded-2xl border border-white/10 light:border-slate-300 bg-white/[0.02] light:bg-white light:shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : t.ticketId)}
                  className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-white/[0.03] light:hover:bg-orange-50/60"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${STATUS_STYLES[t.status]}`}
                      >
                        {STATUS_LABELS[t.status]}
                      </span>
                      {t.status === "open" && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${PRIORITY_STYLES[t.priority] || PRIORITY_STYLES.normal}`}
                        >
                          {t.priority}
                        </span>
                      )}
                      <span className="rounded-full bg-white/5 light:bg-slate-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-400 light:text-slate-700">
                        {t.role}
                      </span>
                      <span className="font-mono text-[10px] font-bold text-slate-500 light:text-slate-600">
                        {t.ticketId.slice(0, 8).toUpperCase()}
                      </span>
                    </div>

                    <p className="mt-1.5 truncate text-sm font-bold text-white light:text-slate-900">
                      {t.subject}
                    </p>

                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] font-medium text-slate-400 light:text-slate-600">
                      <span className="inline-flex items-center gap-1">
                        <User size={10} />
                        {t.userName || t.userEmail || "Unknown"}
                      </span>
                      <span>·</span>
                      <span>{new Date(t.createdAt).toLocaleString()}</span>
                      <span>·</span>
                      <span>{t.messages?.length || 0} messages</span>
                    </p>

                    {t.escalationReason && (
                      <p className="mt-1.5 flex items-start gap-1.5 text-[11px] font-medium leading-5 text-orange-300 light:text-orange-700">
                        <Sparkles size={11} className="mt-0.5 flex-shrink-0" />
                        {t.escalationReason}
                      </p>
                    )}
                  </div>

                  <ChevronDown
                    size={16}
                    className={`mt-1 flex-shrink-0 text-slate-500 light:text-slate-600 transition-transform ${isOpen ? "rotate-180" : ""}`}
                  />
                </button>

                {isOpen && (
                  <div className="border-t border-white/10 light:border-slate-200 px-4 py-3">
                    <div className="mb-3 space-y-2">
                      {(t.messages || []).map((m, i) => (
                        <div
                          key={i}
                          className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={
                              m.role === "user"
                                ? "max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-orange-500/15 px-3 py-2 text-xs leading-5 text-orange-100 light:bg-orange-100 light:text-orange-900"
                                : "max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-bl-md bg-white/5 light:bg-slate-100 px-3 py-2 text-xs leading-5 text-slate-300 light:text-slate-800"
                            }
                          >
                            {m.content}
                          </div>
                        </div>
                      ))}
                    </div>

                    {t.pageUrl && (
                      <p className="mb-3 text-[11px] font-medium text-slate-500 light:text-slate-600">
                        Opened from <span className="font-mono">{t.pageUrl}</span>
                        {t.userEmail ? ` · ${t.userEmail}` : ""}
                      </p>
                    )}

                    <div className="flex flex-wrap gap-2">
                      {(["in_progress", "resolved", "open"] as SupportTicketStatus[])
                        .filter((s) => s !== t.status)
                        .map((s) => (
                          <button
                            key={s}
                            type="button"
                            disabled={updating === t.ticketId}
                            onClick={() => setStatus(t.ticketId, s)}
                            className="rounded-xl border border-white/10 light:border-slate-300 bg-white/5 light:bg-white px-3 py-1.5 text-[11px] font-bold text-slate-200 light:text-slate-800 light:shadow-sm transition hover:border-orange-400/50 disabled:opacity-50"
                          >
                            {updating === t.ticketId ? "Saving…" : `Mark ${STATUS_LABELS[s]}`}
                          </button>
                        ))}
                    </div>
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

function EmptyCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-white/10 light:border-slate-300 bg-white/[0.02] light:bg-white px-6 py-14 text-center light:shadow-sm">
      <LifeBuoy size={32} className="mb-3 text-orange-400 light:text-orange-600 opacity-80" />
      <p className="text-sm font-bold text-white light:text-slate-900">{title}</p>
      <p className="mt-1 max-w-sm text-xs leading-5 text-slate-400 light:text-slate-600">
        {body}
      </p>
    </div>
  );
}
