"use client";

import { authedFetch } from "@/app/lib/apiFetch";
import { useEffect, useState } from "react";
import { Loader2, UserCog, Mail, ShieldCheck, X, Clock, Trash2, Send } from "lucide-react";
import { useAdminIdentity } from "@/app/components/admin/AdminIdentityContext";
import { TEAM_PERMISSIONS, type TeamPermission } from "@/app/lib/isAdmin";

interface TeamMemberRow {
  userId: string;
  email: string;
  name: string | null;
  permissions: TeamPermission[];
  invitedByEmail: string;
  addedAt: string;
  status: "active" | "revoked";
}

interface InvitationRow {
  invitationId: string;
  email: string;
  permissions: TeamPermission[];
  inviterEmail: string;
  createdAt: string;
  expiresAt: string;
  status: "pending" | "accepted" | "revoked";
}

const PERMISSION_LABELS: Record<TeamPermission, string> = {
  view_reports: "View reports",
  view_support: "View support messages",
  view_bugs: "View bug reports",
  view_errors: "View error logs",
  manage_navbar_theme: "Manage navbar theme",
  manage_ads: "Upload & manage advertising",
  delete_stuck_processing_videos: "Delete stuck-processing content",
};

export default function AdminTeamPage() {
  const { isMainAdmin } = useAdminIdentity();
  const [members, setMembers] = useState<TeamMemberRow[]>([]);
  const [invitations, setInvitations] = useState<InvitationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tableMissing, setTableMissing] = useState(false);

  const [email, setEmail] = useState("");
  const [selected, setSelected] = useState<Set<TeamPermission>>(new Set());
  const [inviting, setInviting] = useState(false);
  const [inviteMessage, setInviteMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [membersRes, invitesRes] = await Promise.all([
        authedFetch("/api/admin/team/members"),
        authedFetch("/api/admin/team/invitations"),
      ]);
      if (!membersRes.ok || !invitesRes.ok) throw new Error("Couldn't load team data.");
      const membersData = await membersRes.json();
      const invitesData = await invitesRes.json();
      setMembers(membersData.members || []);
      setInvitations(invitesData.invitations || []);
      setTableMissing(Boolean(membersData.tableMissing || invitesData.tableMissing));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Deferred rather than called synchronously in the effect body — same
    // pattern/reasoning as app/components/NavbarSearch.tsx and
    // app/components/InFamilyHome.tsx.
    const timer = setTimeout(() => {
      if (isMainAdmin) load();
      else setLoading(false);
    }, 0);
    return () => clearTimeout(timer);
  }, [isMainAdmin]);

  const togglePermission = (p: TeamPermission) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  };

  const sendInvite = async () => {
    if (!email.trim() || selected.size === 0 || inviting) return;
    setInviting(true);
    setInviteMessage(null);
    try {
      const res = await authedFetch("/api/admin/team/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), permissions: Array.from(selected) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't send that invitation.");
      setInviteMessage(
        data.emailSent
          ? `Invitation emailed to ${email.trim()}.`
          : `Invitation created, but the email couldn't be sent — check SES configuration. Share the acceptance the invitee needs another way, or fix SES and re-invite.`
      );
      setEmail("");
      setSelected(new Set());
      load();
    } catch (err) {
      setInviteMessage(err instanceof Error ? err.message : "Couldn't send that invitation.");
    } finally {
      setInviting(false);
    }
  };

  const revokeMember = async (userId: string) => {
    if (!confirm("Revoke this team member's admin access?")) return;
    setBusyId(userId);
    try {
      const res = await authedFetch(`/api/admin/team/members/${userId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Couldn't revoke that team member.");
      }
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusyId(null);
    }
  };

  const revokeInvitation = async (invitationId: string) => {
    setBusyId(invitationId);
    try {
      const res = await authedFetch(`/api/admin/team/invitations/${invitationId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Couldn't revoke that invitation.");
      }
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusyId(null);
    }
  };

  if (!isMainAdmin) {
    return (
      <div className="rounded-3xl border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.03] p-10 text-center">
        <ShieldCheck size={28} className="mx-auto mb-3 text-slate-500" />
        <p className="text-sm font-semibold text-slate-300 light:text-slate-700">
          Team management is only available to the main admin.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-black text-white light:text-slate-900">
          <UserCog size={24} className="text-indigo-400" />
          Team Members
        </h1>
        <p className="mt-1 text-sm text-slate-400 light:text-slate-600">
          Invite trusted people by email with strictly limited, whitelisted permissions. Invitations are the ONLY
          way to become a team member — there is no self-enrollment and no share link.
        </p>
      </div>

      {/* Invite form */}
      <div className="rounded-3xl border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.03] p-5 space-y-4">
        <div className="flex items-center gap-2 text-sm font-bold text-white light:text-slate-900">
          <Mail size={16} className="text-indigo-400" />
          Invite by email
        </div>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="teammate@example.com"
          className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none focus:border-indigo-400/60 light:border-black/10 light:bg-white light:text-slate-900"
        />
        <div className="flex flex-wrap gap-2">
          {TEAM_PERMISSIONS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => togglePermission(p)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                selected.has(p)
                  ? "border-indigo-400 bg-indigo-500/20 text-indigo-300"
                  : "border-white/10 light:border-black/10 text-slate-400 light:text-slate-600 hover:border-indigo-400/40"
              }`}
            >
              {PERMISSION_LABELS[p]}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={sendInvite}
          disabled={!email.trim() || selected.size === 0 || inviting}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-400 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
        >
          {inviting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          Send Invitation
        </button>
        {inviteMessage && <p className="text-xs text-slate-300 light:text-slate-700">{inviteMessage}</p>}
      </div>

      {tableMissing && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-xs leading-5 text-amber-300 light:text-amber-700">
          The admin team tables haven&apos;t been created in AWS yet — create two DynamoDB tables:{" "}
          <code className="rounded bg-black/20 px-1">InPlayer-Admin-Members</code> (partition key{" "}
          <code className="rounded bg-black/20 px-1">userId</code>, String) and{" "}
          <code className="rounded bg-black/20 px-1">InPlayer-Admin-Invitations</code> (partition key{" "}
          <code className="rounded bg-black/20 px-1">invitationId</code>, String). Once both exist, this page
          works automatically — no code change needed.
        </div>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 size={24} className="animate-spin text-slate-500" />
        </div>
      ) : (
        <>
          {/* Active team members */}
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-slate-300 light:text-slate-700">
              Active team members ({members.filter((m) => m.status === "active").length})
            </h2>
            {members.filter((m) => m.status === "active").length === 0 ? (
              <p className="text-xs text-slate-500">No team members yet.</p>
            ) : (
              members
                .filter((m) => m.status === "active")
                .map((m) => (
                  <div
                    key={m.userId}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 light:border-black/10 bg-white/[0.02] light:bg-black/[0.02] p-4"
                  >
                    <div>
                      <p className="text-sm font-bold text-white light:text-slate-900">{m.email}</p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        {m.permissions.map((p) => PERMISSION_LABELS[p]).join(", ")}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        Invited by {m.invitedByEmail} · {new Date(m.addedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={() => revokeMember(m.userId)}
                      disabled={busyId === m.userId}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-red-500/15 px-3 py-1.5 text-xs font-bold text-red-300 hover:bg-red-500/25 disabled:opacity-50"
                    >
                      <Trash2 size={13} />
                      Revoke
                    </button>
                  </div>
                ))
            )}
          </div>

          {/* Pending invitations */}
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-slate-300 light:text-slate-700">
              Pending invitations ({invitations.filter((i) => i.status === "pending").length})
            </h2>
            {invitations.filter((i) => i.status === "pending").length === 0 ? (
              <p className="text-xs text-slate-500">No pending invitations.</p>
            ) : (
              invitations
                .filter((i) => i.status === "pending")
                .map((inv) => (
                  <div
                    key={inv.invitationId}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 light:border-black/10 bg-white/[0.02] light:bg-black/[0.02] p-4"
                  >
                    <div>
                      <p className="text-sm font-bold text-white light:text-slate-900">{inv.email}</p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        {inv.permissions.map((p) => PERMISSION_LABELS[p]).join(", ")}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-500">
                        <Clock size={11} />
                        Expires {new Date(inv.expiresAt).toLocaleString()}
                      </p>
                    </div>
                    <button
                      onClick={() => revokeInvitation(inv.invitationId)}
                      disabled={busyId === inv.invitationId}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 light:bg-black/5 px-3 py-1.5 text-xs font-bold text-slate-300 hover:text-red-300 disabled:opacity-50"
                    >
                      <X size={13} />
                      Revoke
                    </button>
                  </div>
                ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
