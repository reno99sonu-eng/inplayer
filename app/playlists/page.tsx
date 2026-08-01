"use client";

import { useEffect, useState } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import { ListMusic, Loader2, Plus, Film, Trash2, Bookmark } from "lucide-react";
import Link from "next/link";
import BackButton from "@/app/components/BackButton";
import { useAuthModal } from "@/app/components/auth/AuthProvider";

interface PlaylistItem {
  playlistId: string;
  name: string;
  videoIds: string[];
  reserved?: boolean;
  createdAt?: string;
}

export default function PlaylistsPage() {
  const { signedIn, openSignIn } = useAuthModal();
  const [playlists, setPlaylists] = useState<PlaylistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [creating, setCreating] = useState(false);
  const [selectedPlaylist, setSelectedPlaylist] = useState<PlaylistItem | null>(null);

  useEffect(() => {
    if (!signedIn) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadPlaylists() {
      setLoading(true);
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
          setPlaylists(data.playlists || []);
        }
      } catch (err) {
        console.error("Failed to load playlists:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadPlaylists();
    return () => {
      cancelled = true;
    };
  }, [signedIn]);

  const handleCreate = async () => {
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
        setPlaylists((prev) => [
          ...prev,
          { playlistId: data.playlistId, name, videoIds: [] },
        ]);
        setNewPlaylistName("");
      }
    } catch (err) {
      console.error("Failed to create playlist:", err);
    } finally {
      setCreating(false);
    }
  };

  if (!signedIn) {
    return (
      <main className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8">
        <BackButton />
        <div className="mt-8 flex flex-col items-center justify-center rounded-3xl border border-white/10 bg-[#07111F] p-12 text-center light:border-black/10 light:bg-white">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-orange-500/10 text-orange-400">
            <ListMusic size={32} />
          </div>
          <h1 className="mt-4 text-2xl font-black text-white light:text-slate-900">Sign in to view your Playlists</h1>
          <p className="mt-2 max-w-sm text-sm text-slate-400 light:text-slate-600">
            Create custom playlists and save your favorite videos in one organized place.
          </p>
          <button
            onClick={openSignIn}
            className="mt-6 rounded-full bg-gradient-to-r from-orange-500 to-amber-400 px-6 py-2.5 text-sm font-bold text-slate-900 shadow-lg hover:scale-105 transition"
          >
            Sign In
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-4">
        <BackButton />
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-amber-400 text-slate-900 shadow-lg">
            <ListMusic size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white sm:text-3xl light:text-slate-900">Playlists</h1>
            <p className="text-xs text-slate-400 light:text-slate-600 font-medium">
              {playlists.length} {playlists.length === 1 ? "playlist" : "playlists"}
            </p>
          </div>
        </div>

        {/* Create Playlist Field */}
        <div className="flex items-center gap-2 max-w-md w-full">
          <input
            type="text"
            value={newPlaylistName}
            onChange={(e) => setNewPlaylistName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
            }}
            placeholder="New playlist name..."
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#07111F] px-4 py-2 text-sm text-white caret-orange-400 outline-none focus:border-orange-400/50 light:border-black/10 light:bg-white light:text-slate-900"
          />
          <button
            onClick={handleCreate}
            disabled={!newPlaylistName.trim() || creating}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-400 px-4 py-2 text-xs font-bold text-slate-900 shadow transition hover:opacity-95 disabled:opacity-40"
          >
            {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Create
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 size={32} className="animate-spin text-orange-400" />
        </div>
      ) : playlists.length === 0 ? (
        <div className="mt-8 flex flex-col items-center justify-center rounded-3xl border border-white/10 bg-[#07111F] p-12 text-center light:border-black/10 light:bg-white">
          <Film size={36} className="text-slate-500 mb-3" />
          <h2 className="text-lg font-bold text-white light:text-slate-900">No playlists created yet</h2>
          <p className="mt-1 max-w-sm text-sm text-slate-400 light:text-slate-600">
            Use the field above or click &quot;+ Playlist&quot; below any video to create your first playlist.
          </p>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {playlists.map((p) => (
            <div
              key={p.playlistId}
              className="group relative flex flex-col justify-between rounded-2xl border border-white/10 bg-[#07111F] p-5 backdrop-blur-xl transition hover:border-orange-400/40 light:border-black/10 light:bg-white"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {p.reserved ? (
                      <Bookmark size={18} className="text-orange-400" />
                    ) : (
                      <ListMusic size={18} className="text-orange-400" />
                    )}
                    <h3 className="font-bold text-white light:text-slate-900">{p.name}</h3>
                  </div>
                  <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] font-bold text-slate-300 light:bg-black/10 light:text-slate-700">
                    {p.videoIds.length} {p.videoIds.length === 1 ? "video" : "videos"}
                  </span>
                </div>

                <p className="mt-3 text-xs text-slate-400 light:text-slate-600 line-clamp-2">
                  {p.videoIds.length > 0
                    ? `Contains ${p.videoIds.length} saved item(s)`
                    : "Empty playlist"}
                </p>
              </div>

              {p.videoIds.length > 0 && (
                <div className="mt-4 pt-3 border-t border-white/10 light:border-black/10 flex items-center justify-between">
                  <Link
                    href={`/watch/${p.videoIds[0]}`}
                    className="text-xs font-bold text-orange-400 hover:underline"
                  >
                    Play All ({p.videoIds.length})
                  </Link>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
