"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { fetchAuthSession } from "aws-amplify/auth";
import {
  MoreVertical,
  ChevronLeft,
  X,
  Loader2,
  Clock,
  Check,
  ListMusic,
  Plus,
  Bookmark,
  Flag,
} from "lucide-react";
import { useAuthModal } from "@/app/components/auth/AuthProvider";

type PanelView = "main" | "playlists" | "report";

interface PlaylistItem {
  playlistId: string;
  name: string;
  videoIds: string[];
  reserved?: boolean;
}

interface VideoOptionsMenuProps {
  videoId: string;
  contentType?: string;
  // downloadStatus/downloadRenditions are still passed in by
  // WatchActions.tsx (sourced from real Mux rendition data) but are no
  // longer used here — Download was removed from this menu entirely.
  // Downloads is an app-only feature now, not offered on the website (see
  // app/downloads/page.tsx). Left un-destructured below rather than
  // ripping the props out of every caller, since the underlying data is
  // still genuinely real and may be worth reusing once the app exists.
  downloadStatus?: "unavailable" | "preparing" | "ready" | "errored";
  downloadRenditions?: Record<string, string>;
}

const REPORT_REASONS: { value: string; label: string }[] = [
  { value: "spam", label: "Spam or misleading" },
  { value: "harassment", label: "Harassment or bullying" },
  { value: "sexual_content", label: "Sexual content" },
  { value: "hate_speech", label: "Hate speech" },
  { value: "violence", label: "Violent or graphic content" },
  { value: "misinformation", label: "Misinformation" },
  { value: "copyright", label: "Copyright infringement" },
  { value: "other", label: "Something else" },
];

function MenuRow({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-slate-200 light:text-slate-800 transition hover:bg-white/5 light:hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center">{icon}</span>
      {label}
    </button>
  );
}

// The watch page's "More options" panel — YouTube's three-dot menu, wired
// to real backends throughout:
//  - Download reuses the exact prepare/poll/quality flow the old
//    standalone DownloadButton used (see app/api/videos/[videoId]/*).
//  - Watch Later calls the same /api/watchlist the hero's own Watch Later
//    button uses.
//  - Save to playlist and the quick Save action are both backed by the
//    new app/api/playlists (a real DynamoDB table) — Save to playlist
//    manages your named playlists, quick Save is a one-tap bookmark into
//    your own reserved "Saved" shelf, same backend either way.
//  - Report writes a real row to app/api/reports.
export default function VideoOptionsMenu({
  videoId,
  contentType,
}: VideoOptionsMenuProps) {
  const { signedIn, openSignIn } = useAuthModal();

  const [open, setOpen] = useState(false);
  const [view, setView] = useState<PanelView>("main");

  // Watch Later
  const [watchLater, setWatchLater] = useState(false);
  const [watchLaterBusy, setWatchLaterBusy] = useState(false);

  // Quick Save (reserved "saved" playlist)
  const [saved, setSaved] = useState(false);
  const [savedBusy, setSavedBusy] = useState(false);

  // Save to playlist
  const [playlists, setPlaylists] = useState<PlaylistItem[]>([]);
  const [playlistsLoaded, setPlaylistsLoaded] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [creatingPlaylist, setCreatingPlaylist] = useState(false);
  const [playlistBusyId, setPlaylistBusyId] = useState<string | null>(null);

  // Report
  const [reported, setReported] = useState(false);
  const [reportReason, setReportReason] = useState<string | null>(null);
  const [reportDetails, setReportDetails] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportSubmitted, setReportSubmitted] = useState(false);

  async function authHeaders(): Promise<HeadersInit> {
    const session = await fetchAuthSession();
    const idToken = session.tokens?.idToken?.toString();
    return idToken ? { Authorization: `Bearer ${idToken}` } : {};
  }

  // Load real status for everything the panel shows the moment it opens —
  // always fresh (the Watch Later button in the hero above, or another
  // tab, could have changed things since this last opened).
  useEffect(() => {
    if (!open || !signedIn) return;
    let cancelled = false;

    (async () => {
      try {
        const headers = await authHeaders();

        const [watchlistRes, playlistsRes, reportRes] = await Promise.all([
          fetch(`/api/watchlist?videoId=${videoId}`, { headers }),
          fetch("/api/playlists", { headers }),
          fetch(`/api/reports?videoId=${videoId}`, { headers }),
        ]);

        if (cancelled) return;

        const watchlistData = await watchlistRes.json();
        setWatchLater(!!watchlistData.inWatchlist);

        const playlistsData = await playlistsRes.json();
        const all: PlaylistItem[] = playlistsData.playlists || [];
        setPlaylists(all.filter((p) => !p.reserved));
        setSaved(all.some((p) => p.reserved && p.videoIds.includes(videoId)));
        setPlaylistsLoaded(true);

        const reportData = await reportRes.json();
        setReported(!!reportData.reported);
      } catch (err) {
        console.error("Failed to load video options status:", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, signedIn, videoId]);

  const closeAll = () => {
    setOpen(false);
    setView("main");
    setReportReason(null);
    setReportDetails("");
    setReportSubmitted(false);
  };

  // ---------------- Watch Later ----------------

  const toggleWatchLater = async () => {
    if (!signedIn) {
      openSignIn();
      return;
    }
    setWatchLaterBusy(true);
    const next = !watchLater;

    try {
      const headers = await authHeaders();
      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ videoId, action: next ? "add" : "remove" }),
      });
      if (res.ok) setWatchLater(next);
    } catch (err) {
      console.error("Failed to toggle watch later:", err);
    } finally {
      setWatchLaterBusy(false);
    }
  };

  // ---------------- Quick Save ----------------

  const toggleSaved = async () => {
    if (!signedIn) {
      openSignIn();
      return;
    }
    setSavedBusy(true);
    const next = !saved;

    try {
      const headers = await authHeaders();
      const res = await fetch("/api/playlists", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ action: "quick-save", videoId, member: next }),
      });
      if (res.ok) setSaved(next);
    } catch (err) {
      console.error("Failed to toggle save:", err);
    } finally {
      setSavedBusy(false);
    }
  };

  // ---------------- Save to Playlist ----------------

  const togglePlaylistMembership = async (playlistId: string, member: boolean) => {
    setPlaylistBusyId(playlistId);
    try {
      const headers = await authHeaders();
      const res = await fetch("/api/playlists", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ action: "toggle", playlistId, videoId, member }),
      });
      if (res.ok) {
        setPlaylists((prev) =>
          prev.map((p) =>
            p.playlistId === playlistId
              ? {
                  ...p,
                  videoIds: member
                    ? [...p.videoIds, videoId]
                    : p.videoIds.filter((id) => id !== videoId),
                }
              : p
          )
        );
      }
    } catch (err) {
      console.error("Failed to update playlist:", err);
    } finally {
      setPlaylistBusyId(null);
    }
  };

  const createPlaylist = async () => {
    const name = newPlaylistName.trim();
    if (!name || creatingPlaylist) return;
    setCreatingPlaylist(true);

    try {
      const headers = await authHeaders();
      const res = await fetch("/api/playlists", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ action: "create", name }),
      });
      const data = await res.json();

      if (res.ok && data.playlistId) {
        await togglePlaylistMembership(data.playlistId, true);
        setPlaylists((prev) => [...prev, { playlistId: data.playlistId, name, videoIds: [videoId] }]);
        setNewPlaylistName("");
      }
    } catch (err) {
      console.error("Failed to create playlist:", err);
    } finally {
      setCreatingPlaylist(false);
    }
  };

  // ---------------- Report ----------------

  const submitReport = async () => {
    if (!reportReason || reportSubmitting) return;
    if (!signedIn) {
      openSignIn();
      return;
    }
    setReportSubmitting(true);

    try {
      const headers = await authHeaders();
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ videoId, reason: reportReason, details: reportDetails }),
      });

      if (res.ok) {
        setReported(true);
        setReportSubmitted(true);
        setTimeout(() => closeAll(), 1600);
      }
    } catch (err) {
      console.error("Failed to submit report:", err);
    } finally {
      setReportSubmitting(false);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="More options"
        aria-label="More options"
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.02] text-slate-300 light:text-slate-600 transition-all duration-300 hover:border-white/20 light:hover:border-black/20 hover:bg-white/[0.06] sm:h-9 sm:w-9"
      >
        <MoreVertical size={16} className="sm:hidden" />
        <MoreVertical size={18} className="hidden sm:block" />
      </button>

      {/* Portaled to <body> as a bottom sheet (centered on larger
          screens) — same pattern already used by the download/playlist
          pickers elsewhere on this page, so it always sits above
          everything regardless of where in the row this button lives. */}
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            onClick={closeAll}
            className="fixed inset-0 z-[9990] flex items-end justify-center bg-black/50 p-4 pb-24 backdrop-blur-[2px] sm:items-center sm:pb-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-[380px] rounded-2xl border border-white/10 light:border-black/10 bg-[#0A1424] light:bg-[#FBF6EA] p-3 shadow-[0_25px_70px_-20px_rgba(0,0,0,.6)]"
            >
              <div className="mb-1 flex items-center justify-between px-1 pb-2">
                <div className="flex items-center gap-1.5">
                  {view !== "main" && (
                    <button
                      type="button"
                      onClick={() => setView("main")}
                      aria-label="Back"
                      className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition hover:bg-white/5 hover:text-white light:hover:bg-black/5 light:hover:text-slate-900"
                    >
                      <ChevronLeft size={16} />
                    </button>
                  )}
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400 light:text-slate-600">
                    {view === "main" && "More options"}
                    {view === "playlists" && "Save to playlist"}
                    {view === "report" && "Report this video"}
                  </p>
                </div>
                <button
                  onClick={closeAll}
                  aria-label="Close"
                  className="text-slate-400 transition hover:text-white light:text-slate-600 light:hover:text-slate-900"
                >
                  <X size={15} />
                </button>
              </div>

              {view === "main" && (
                <div className="space-y-0.5">
                  <MenuRow
                    icon={watchLater ? <Check size={18} className="text-orange-300" /> : <Clock size={18} />}
                    label={watchLater ? "Remove from Watch Later" : "Watch Later"}
                    onClick={toggleWatchLater}
                    disabled={watchLaterBusy}
                  />
                  <MenuRow
                    icon={<ListMusic size={18} />}
                    label="Save to playlist"
                    onClick={() => setView("playlists")}
                  />
                  <MenuRow
                    icon={<Bookmark size={18} className={saved ? "fill-current text-orange-300" : ""} />}
                    label={saved ? "Saved" : "Save"}
                    onClick={toggleSaved}
                    disabled={savedBusy}
                  />
                  <MenuRow
                    icon={<Flag size={18} className={reported ? "text-red-400" : ""} />}
                    label={reported ? "Reported" : "Report"}
                    onClick={() => !reported && setView("report")}
                    disabled={reported}
                  />
                </div>
              )}

              {view === "playlists" && (
                <div>
                  <div className="max-h-56 space-y-0.5 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {!playlistsLoaded ? (
                      <p className="px-3 py-4 text-xs text-slate-500">Loading your playlists…</p>
                    ) : playlists.length === 0 ? (
                      <p className="px-3 py-2 text-xs text-slate-500 light:text-slate-600">
                        No playlists yet. Create one below.
                      </p>
                    ) : (
                      playlists.map((p) => {
                        const inList = p.videoIds.includes(videoId);
                        return (
                          <button
                            key={p.playlistId}
                            onClick={() => togglePlaylistMembership(p.playlistId, !inList)}
                            disabled={playlistBusyId === p.playlistId}
                            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm text-slate-200 light:text-slate-800 transition hover:bg-white/5 light:hover:bg-black/5 disabled:opacity-50"
                          >
                            <span
                              className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border ${
                                inList
                                  ? "border-orange-400 bg-orange-500 text-white"
                                  : "border-white/25 light:border-black/25"
                              }`}
                            >
                              {inList && <Check size={12} />}
                            </span>
                            <span className="truncate">{p.name}</span>
                          </button>
                        );
                      })
                    )}
                  </div>

                  <div className="mt-2 flex items-center gap-1.5 border-t border-white/10 light:border-black/10 pt-2">
                    <input
                      value={newPlaylistName}
                      onChange={(e) => setNewPlaylistName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") createPlaylist();
                      }}
                      placeholder="New playlist"
                      className="min-w-0 flex-1 rounded-lg border border-white/10 light:border-black/10 bg-transparent px-2.5 py-1.5 text-sm text-white light:text-slate-900 outline-none placeholder:text-slate-500 focus:border-orange-400/50"
                    />
                    <button
                      onClick={createPlaylist}
                      disabled={!newPlaylistName.trim() || creatingPlaylist}
                      aria-label="Create playlist"
                      className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#FF7A18] to-[#FF9A00] text-white transition disabled:opacity-40"
                    >
                      {creatingPlaylist ? <Loader2 size={14} className="animate-spin" /> : <Plus size={16} />}
                    </button>
                  </div>
                </div>
              )}

              {view === "report" && (
                <div>
                  {reportSubmitted ? (
                    <div className="flex flex-col items-center gap-2 px-3 py-8 text-center">
                      <Check size={28} className="text-emerald-400" />
                      <p className="text-sm font-semibold text-white light:text-slate-900">
                        Thanks — we&apos;ll review this.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="max-h-52 space-y-0.5 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        {REPORT_REASONS.map((r) => (
                          <button
                            key={r.value}
                            onClick={() => setReportReason(r.value)}
                            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm text-slate-200 light:text-slate-800 transition hover:bg-white/5 light:hover:bg-black/5"
                          >
                            <span
                              className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border ${
                                reportReason === r.value
                                  ? "border-orange-400 bg-orange-500"
                                  : "border-white/25 light:border-black/25"
                              }`}
                            >
                              {reportReason === r.value && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                            </span>
                            <span className="truncate">{r.label}</span>
                          </button>
                        ))}
                      </div>

                      <textarea
                        value={reportDetails}
                        onChange={(e) => setReportDetails(e.target.value)}
                        rows={2}
                        placeholder="Add details (optional)"
                        className="mt-2 w-full resize-none rounded-xl border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.03] px-3 py-2 text-sm text-white light:text-slate-900 outline-none placeholder:text-slate-500 focus:border-orange-400/50"
                      />

                      <button
                        onClick={submitReport}
                        disabled={!reportReason || reportSubmitting}
                        className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-red-500 to-rose-500 py-2.5 text-sm font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {reportSubmitting ? <Loader2 size={15} className="animate-spin" /> : <Flag size={15} />}
                        Submit report
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
