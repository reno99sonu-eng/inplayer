"use client";

import React, { useEffect, useState } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import {
  Film,
  Check,
  X,
  Clock,
  ExternalLink,
  Search,
  AlertCircle,
  Loader2,
  UserCheck,
  UserX,
} from "lucide-react";

interface Application {
  applicationId: string;
  userId: string;
  channelName: string;
  companyName?: string;
  personalName: string;
  username: string;
  phoneNumber?: string;
  email?: string;
  profilePicUrl?: string;
  bio?: string;
  portfolioLinks?: string[];
  socialLinks?: Record<string, string>;
  status: "pending" | "approved" | "rejected";
  submittedAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  rejectionReason?: string;
}

export default function RaftaarFilmsApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");
  const [search, setSearch] = useState("");

  const [actingId, setActingId] = useState<string | null>(null);
  const [rejectModalApp, setRejectModalApp] = useState<Application | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const getToken = async (): Promise<string | null> => {
    try {
      const session = await fetchAuthSession();
      return session.tokens?.idToken?.toString() || null;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    loadApplications();
  }, [filter]);

  const loadApplications = async () => {
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) return;

      const url =
        filter === "all"
          ? "/api/admin/raftaar-films/applications"
          : `/api/admin/raftaar-films/applications?status=${filter}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setApplications(data.applications || []);
      }
    } catch (err) {
      console.error("Failed to load applications:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (applicationId: string, action: "approve" | "reject", reason?: string) => {
    setActingId(applicationId);
    try {
      const token = await getToken();
      if (!token) return;

      const res = await fetch(`/api/admin/raftaar-films/applications/${applicationId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action, rejectionReason: reason }),
      });

      if (res.ok) {
        setApplications((prev) =>
          prev.map((app) =>
            app.applicationId === applicationId
              ? {
                  ...app,
                  status: action === "approve" ? "approved" : "rejected",
                  rejectionReason: reason,
                  reviewedAt: new Date().toISOString(),
                }
              : app
          )
        );
        if (rejectModalApp?.applicationId === applicationId) {
          setRejectModalApp(null);
          setRejectionReason("");
        }
      }
    } catch (err) {
      console.error("Action error:", err);
    } finally {
      setActingId(null);
    }
  };

  const filtered = applications.filter((app) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      app.channelName.toLowerCase().includes(q) ||
      app.personalName.toLowerCase().includes(q) ||
      app.username.toLowerCase().includes(q) ||
      (app.companyName && app.companyName.toLowerCase().includes(q))
    );
  });

  const pendingCount = applications.filter((a) => a.status === "pending").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-white/10 bg-[#071120] p-5 light:border-black/10 light:bg-white">
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-500/15 text-orange-400">
            <Film size={24} />
          </div>
          <div>
            <h1 className="text-xl font-black text-white light:text-slate-900 sm:text-2xl">
              Raftaar Films Creator Applications
            </h1>
            <p className="text-xs text-slate-400 light:text-slate-600">
              Manual editorial approval queue • 48–72 hours SLA target
            </p>
          </div>
        </div>

        {/* SLA Badge */}
        <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2 text-xs font-bold text-amber-300">
          <Clock size={15} className="text-amber-400" />
          <span>{pendingCount} Pending Review</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          {(["pending", "approved", "rejected", "all"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-wider transition ${
                filter === s
                  ? "bg-gradient-to-r from-[#FF7A18] to-[#FFD54A] text-white shadow"
                  : "border border-white/10 bg-[#071120] text-slate-400 hover:text-white light:border-black/10 light:bg-white light:text-slate-600"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search applicants..."
            className="w-full rounded-xl border border-white/10 bg-[#071120] pl-9 pr-3.5 py-2 text-xs text-white outline-none focus:border-orange-400 light:border-black/10 light:bg-white light:text-slate-900"
          />
        </div>
      </div>

      {/* Applications List */}
      {loading ? (
        <div className="flex min-h-[300px] items-center justify-center">
          <Loader2 size={30} className="animate-spin text-orange-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-[#071120] p-12 text-center text-slate-400 light:border-black/10 light:bg-white">
          <AlertCircle size={32} className="mx-auto mb-2 text-slate-500" />
          <p className="text-sm font-semibold">No applications found under &quot;{filter}&quot;.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filtered.map((app) => {
            const isPending = app.status === "pending";
            const isApproved = app.status === "approved";
            const isRejected = app.status === "rejected";

            return (
              <div
                key={app.applicationId}
                className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-[#071120] p-5 light:border-black/10 light:bg-white lg:flex-row lg:items-center lg:justify-between"
              >
                {/* Creator Profile Info */}
                <div className="flex items-start gap-4 min-w-0 flex-1">
                  <img
                    src={app.profilePicUrl || "/default-avatar.png"}
                    alt={app.channelName}
                    className="h-14 w-14 flex-shrink-0 rounded-full object-cover ring-2 ring-white/10"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-black text-white light:text-slate-900 truncate">
                        {app.channelName}
                      </h3>
                      <span className="text-xs text-slate-400">@{app.username}</span>
                      {app.companyName && (
                        <span className="rounded-md bg-white/5 px-2 py-0.5 text-[11px] font-medium text-slate-300 light:bg-black/5 light:text-slate-700">
                          🏢 {app.companyName}
                        </span>
                      )}
                      <span
                        className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          isApproved
                            ? "bg-emerald-500/15 text-emerald-400"
                            : isRejected
                            ? "bg-red-500/15 text-red-400"
                            : "bg-amber-500/15 text-amber-400"
                        }`}
                      >
                        {app.status}
                      </span>
                    </div>

                    {app.bio && (
                      <p className="mt-1 text-xs text-slate-300 light:text-slate-700 line-clamp-2">
                        {app.bio}
                      </p>
                    )}

                    <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400">
                      <span>👤 Legal Name: {app.personalName}</span>
                      {app.email && <span>✉️ Email: <strong className="text-slate-200">{app.email}</strong></span>}
                      {app.phoneNumber && <span>📞 Phone: <strong className="text-slate-200">{app.phoneNumber}</strong></span>}
                      <span>📅 Submitted: {new Date(app.submittedAt).toLocaleDateString()}</span>
                      {app.reviewedBy && <span>Reviewed by: {app.reviewedBy}</span>}
                    </div>

                    {/* Portfolio & Social links */}
                    {((app.portfolioLinks && app.portfolioLinks.length > 0) || (app.socialLinks && Object.keys(app.socialLinks).length > 0)) && (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {app.portfolioLinks?.map((link, idx) => (
                          <a
                            key={idx}
                            href={link}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-orange-400 hover:underline"
                          >
                            Portfolio {idx + 1} <ExternalLink size={10} />
                          </a>
                        ))}
                        {app.socialLinks &&
                          Object.entries(app.socialLinks).map(([k, v]) => (
                            <span key={k} className="text-[11px] text-slate-400">
                              {k}: <strong className="text-slate-200">{v}</strong>
                            </span>
                          ))}
                      </div>
                    )}

                    {isRejected && app.rejectionReason && (
                      <div className="mt-2 rounded-xl bg-red-500/10 p-2.5 text-xs text-red-300">
                        <strong>Reason:</strong> {app.rejectionReason}
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                {isPending && (
                  <div className="flex items-center gap-2 self-end lg:self-center">
                    <button
                      onClick={() => handleAction(app.applicationId, "approve")}
                      disabled={actingId === app.applicationId}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-bold text-white shadow transition hover:bg-emerald-600 disabled:opacity-50"
                    >
                      <UserCheck size={14} />
                      Approve
                    </button>
                    <button
                      onClick={() => {
                        setRejectModalApp(app);
                        setRejectionReason("");
                      }}
                      disabled={actingId === app.applicationId}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-red-500/15 px-4 py-2.5 text-xs font-bold text-red-400 hover:bg-red-500 hover:text-white transition disabled:opacity-50"
                    >
                      <UserX size={14} />
                      Reject
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Reject Reason Modal */}
      {rejectModalApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-white/15 bg-[#0B1526] p-6 shadow-2xl text-white light:border-black/15 light:bg-white light:text-slate-900">
            <h3 className="text-lg font-bold">Reject Application</h3>
            <p className="mt-1 text-xs text-slate-400">
              Provide a constructive reason for rejecting &quot;{rejectModalApp.channelName}&quot;. The creator will receive this in their notification.
            </p>

            <textarea
              rows={4}
              required
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g. Please link sample micro-drama scripts or vertical video reels from your portfolio..."
              className="mt-4 w-full rounded-xl border border-white/10 bg-[#060D18] p-3 text-xs text-white outline-none focus:border-red-400 light:border-black/10 light:bg-white light:text-slate-900"
            />

            <div className="mt-5 flex items-center justify-end gap-2.5">
              <button
                onClick={() => setRejectModalApp(null)}
                className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => handleAction(rejectModalApp.applicationId, "reject", rejectionReason.trim())}
                disabled={!rejectionReason.trim() || actingId === rejectModalApp.applicationId}
                className="rounded-xl bg-red-500 px-5 py-2 text-xs font-bold text-white shadow hover:bg-red-600 disabled:opacity-50"
              >
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
