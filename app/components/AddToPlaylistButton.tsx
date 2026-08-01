"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { fetchAuthSession } from "aws-amplify/auth";
import { ListPlus, Check, Plus, Loader2, X, Lock } from "lucide-react";
import { useAuthModal } from "./auth/AuthProvider";

interface PlaylistItem {
  playlistId: string;
  name: string;
  videoIds: string[];
  reserved?: boolean;
}

interface AddToPlaylistButtonProps {
  videoId: string;
}

export default function AddToPlaylistButton({ videoId }: AddToPlaylistButtonProps) {
  const { signedIn, openSignIn } = useAuthModal();
  const [open, setOpen] = useState(false);
  const [playlists, setPlaylists] = useState<PlaylistItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !signedIn) return;
    let cancelled = false;

    async function load() {
      try {
        const session = await fetchAuthSession();
        const idToken = session.tokens?.idToken?.toString();
        if (!idToken) return;

        const res = await fetch("/api/playlists", {
          headers: { Authorization: `Bearer ${idToken}` },
        });

        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) {
          const all: PlaylistItem[] = data.playlists || [];
          setPlaylists(all.filter((p) => !p.reserved));
          setLoaded(true);
        }
      } catch (err) {
        console.error("Failed to load playlists:", err);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [open, signedIn]);

  const handleClick = () => {
    if (!signedIn) {
      openSignIn();
      return;
    }
    setOpen(true);
  };

  const togglePlaylist = async (playlistId: string, member: boolean) => {
    setBusyId(playlistId);
    try {
      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken?.toString();
      if (!idToken) return;

      const res = await fetch("/api/playlists", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
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
      setBusyId(null);
    }
  };

  const createAndAdd = async () => {
    const name = newPlaylistName.trim();
    if (!name || creating) return;
    setCreating(true);

    try {
      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken?.toString();
      if (!idToken) return;

      const res = await fetch("/api/playlists", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ action: "create", name }),
      });

      const data = await res.json();

      if (res.ok && data.playlistId) {
        await togglePlaylist(data.playlistId, true);
        setPlaylists((prev) => [
          ...prev,
          { playlistId: data.playlistId, name, videoIds: [videoId] },
        ]);
        setNewPlaylistName("");
      }
    } catch (err) {
      console.error("Failed to create playlist:", err);
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        title="Add to playlist"
        aria-label="Add to playlist"
        className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-xl transition hover:border-orange-400/40 hover:bg-white/10 light:border-black/10 light:bg-black/5 light:text-slate-800"
      >
        <ListPlus size={15} className="text-orange-400" />
        <span className="hidden sm:inline">Save</span>
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-[9990] flex items-end justify-center bg-black/60 p-4 pb-24 backdrop-blur-[2px] sm:items-center sm:pb-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-[360px] rounded-2xl border border-white/10 bg-[#0A1424] p-4 shadow-2xl light:border-black/10 light:bg-[#FBF6EA]"
            >
              <div className="mb-3 flex items-center justify-between pb-2 border-b border-white/10 light:border-black/10">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-300 light:text-slate-700">
                  Save video to...
                </p>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="text-slate-400 hover:text-white light:hover:text-slate-900"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Playlists list */}
              <div className="max-h-56 space-y-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {!loaded ? (
                  <p className="py-4 text-center text-xs text-slate-500">Loading playlists…</p>
                ) : playlists.length === 0 ? (
                  <p className="py-3 text-xs text-slate-400 light:text-slate-600">
                    No playlists yet. Create one below!
                  </p>
                ) : (
                  playlists.map((p) => {
                    const inList = p.videoIds.includes(videoId);
                    return (
                      <button
                        key={p.playlistId}
                        type="button"
                        onClick={() => togglePlaylist(p.playlistId, !inList)}
                        disabled={busyId === p.playlistId}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-xs font-semibold text-slate-200 transition hover:bg-white/5 light:text-slate-800 light:hover:bg-black/5 disabled:opacity-50"
                      >
                        <span
                          className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border transition ${
                            inList
                              ? "border-orange-400 bg-orange-500 text-white"
                              : "border-white/30 light:border-black/30"
                          }`}
                        >
                          {inList && <Check size={11} />}
                        </span>
                        <span className="truncate flex-1">{p.name}</span>
                      </button>
                    );
                  })
                )}
              </div>

              {/* Create new playlist input */}
              <div className="mt-3 flex items-center gap-2 border-t border-white/10 pt-3 light:border-black/10">
                <input
                  type="text"
                  value={newPlaylistName}
                  onChange={(e) => setNewPlaylistName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") createAndAdd();
                  }}
                  placeholder="New playlist name..."
                  className="min-w-0 flex-1 rounded-lg border border-white/10 bg-transparent px-3 py-1.5 text-xs text-white outline-none placeholder:text-slate-500 focus:border-orange-400/50 light:border-black/10 light:text-slate-900"
                />
                <button
                  type="button"
                  onClick={createAndAdd}
                  disabled={!newPlaylistName.trim() || creating}
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-r from-orange-500 to-amber-400 text-slate-900 transition disabled:opacity-40"
                >
                  {creating ? <Loader2 size={13} className="animate-spin" /> : <Plus size={15} />}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
