"use client";

import { useEffect, useRef, useState } from "react";
import { ListPlus, Plus, Check, X } from "lucide-react";

interface AddToPlaylistButtonProps {
  videoId: string;
}

// Playlists are stored locally on the device (localStorage) as a simple
// map of { playlistName: videoId[] }. This keeps "Add to Playlist" fully
// functional without a dedicated backend table — each viewer builds their
// own playlists on their own device. (A synced, cross-device version would
// need a Playlists DynamoDB table + API, which can be added later.)
const STORAGE_KEY = "inplayer-playlists";

type Playlists = Record<string, string[]>;

function readPlaylists(): Playlists {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Playlists) : {};
  } catch {
    return {};
  }
}

function writePlaylists(playlists: Playlists) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(playlists));
  } catch {
    // Storage full / disabled — nothing we can do, just don't crash.
  }
}

export default function AddToPlaylistButton({
  videoId,
}: AddToPlaylistButtonProps) {
  const [open, setOpen] = useState(false);
  const [playlists, setPlaylists] = useState<Playlists>({});
  const [newName, setNewName] = useState("");
  const [justAdded, setJustAdded] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPlaylists(readPlaylists());
  }, []);

  // Close the popover when clicking outside it.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const persist = (next: Playlists) => {
    setPlaylists(next);
    writePlaylists(next);
  };

  const toggleInPlaylist = (name: string) => {
    const current = playlists[name] || [];
    const exists = current.includes(videoId);
    const nextList = exists
      ? current.filter((id) => id !== videoId)
      : [...current, videoId];
    persist({ ...playlists, [name]: nextList });
    if (!exists) flashAdded();
  };

  const createPlaylist = () => {
    const name = newName.trim();
    if (!name) return;
    // Adding to an existing name just merges rather than clobbering.
    const current = playlists[name] || [];
    const nextList = current.includes(videoId)
      ? current
      : [...current, videoId];
    persist({ ...playlists, [name]: nextList });
    setNewName("");
    flashAdded();
  };

  const flashAdded = () => {
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1400);
  };

  const names = Object.keys(playlists);

  return (
    <div ref={wrapRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title="Add to playlist"
        aria-label="Add to playlist"
        className={`
          flex h-9 w-9 items-center justify-center rounded-full border
          transition-all duration-300
          ${
            open || justAdded
              ? "border-orange-400/50 bg-gradient-to-br from-orange-500/20 to-amber-400/10 text-orange-300 light:text-orange-700"
              : "border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.02] text-slate-300 light:text-slate-600 hover:border-white/20 light:hover:border-black/20 hover:bg-white/[0.06]"
          }
        `}
      >
        {justAdded ? <Check size={18} /> : <ListPlus size={18} />}
      </button>

      {open && (
        <div
          className="
            absolute right-0 z-50 mt-2 w-60 max-w-[calc(100vw-2rem)]
            rounded-2xl border border-white/10 light:border-black/10
            bg-[#0A1424] light:bg-[#FBF6EA]
            p-3 shadow-[0_25px_70px_-20px_rgba(0,0,0,.6)] backdrop-blur-xl
          "
        >
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400 light:text-slate-600">
              Save to
            </p>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="text-slate-400 transition hover:text-white light:hover:text-slate-900"
            >
              <X size={15} />
            </button>
          </div>

          <div className="max-h-44 space-y-0.5 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {names.length === 0 ? (
              <p className="px-1 py-2 text-xs text-slate-500 light:text-slate-600">
                No playlists yet. Create one below.
              </p>
            ) : (
              names.map((name) => {
                const inList = (playlists[name] || []).includes(videoId);
                return (
                  <button
                    key={name}
                    onClick={() => toggleInPlaylist(name)}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm text-slate-200 light:text-slate-800 transition hover:bg-white/5 light:hover:bg-black/5"
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
                    <span className="truncate">{name}</span>
                  </button>
                );
              })
            )}
          </div>

          <div className="mt-2 flex items-center gap-1.5 border-t border-white/10 light:border-black/10 pt-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") createPlaylist();
              }}
              placeholder="New playlist"
              className="min-w-0 flex-1 rounded-lg border border-white/10 light:border-black/10 bg-transparent px-2.5 py-1.5 text-sm text-white light:text-slate-900 outline-none placeholder:text-slate-500 focus:border-orange-400/50"
            />
            <button
              onClick={createPlaylist}
              disabled={!newName.trim()}
              aria-label="Create playlist"
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#FF7A18] to-[#FF9A00] text-white transition disabled:opacity-40"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
