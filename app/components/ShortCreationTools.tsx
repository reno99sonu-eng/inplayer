"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import { Link2, Loader2, Music2, Pause, Play, ShieldCheck, SlidersHorizontal, Upload, Wand2 } from "lucide-react";
import {
  searchSoundtracks,
  toResolvedSoundtrack,
  ResolvedSoundtrack,
  CUSTOM_AUDIO_MAX_SECONDS,
} from "@/app/data/soundtracks";

export interface ShortSettings {
  soundtrack: ResolvedSoundtrack | null;
  musicClipSeconds: 20 | 30;
  filter: "original" | "warm" | "vivid" | "mono";
}

// Soundtrack picker, clip length, and look filter — originally Shorts-only,
// now offered for Video uploads too (see app/upload/page.tsx and
// VideoPlayer.tsx). Two catalogs feed the same picker: InPlayer's own local
// instrumentals (app/data/soundtracks.ts — 100% synthesized, no licensing
// needed at all) and a live search against real Creative Commons music via
// Jamendo (app/api/music/search) — the "works now, real commercial
// licensing later" stopgap. Whichever is picked gets stored in full (id/
// title/artist/url/duration/source), not just an id, so playback never has
// to re-look-up an external track.
export default function ShortCreationTools({
  value,
  onChange,
  contentType,
}: {
  value: ShortSettings;
  onChange: (value: ShortSettings) => void;
  // Music-clip length only means anything for a Short (a fixed-length clip
  // cut short of the track's natural end) — a Video instead loops the
  // track for its whole runtime (see VideoPlayer.tsx), so that control is
  // hidden when this is "video".
  contentType: "video" | "short" | "music";
}) {
  const [query, setQuery] = useState("");
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  // --- "Your own music": upload a file, or paste a direct link -----------
  // Third source alongside the local catalog and CC search. Whatever the
  // creator brings here is stored with source: "custom", which every player
  // treats as hard-capped at CUSTOM_AUDIO_MAX_SECONDS (see
  // soundtrackClipSeconds in app/data/soundtracks.ts) — InPlayer holds no
  // licence for it, so only that much of it may ever be heard.
  const [customTab, setCustomTab] = useState<"upload" | "link">("upload");
  const [linkUrl, setLinkUrl] = useState("");
  const [customBusy, setCustomBusy] = useState(false);
  const [customError, setCustomError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Loads the audio far enough to confirm the browser can actually decode
  // and play it, and reports its true length. Used for both tabs: a pasted
  // link that 404s or isn't really audio fails here rather than silently
  // publishing a Short with a soundtrack that never plays. Cross-origin
  // media needs no CORS headers for plain playback/metadata, so this works
  // against any ordinary direct audio URL.
  const probeAudio = (src: string) =>
    new Promise<number>((resolve, reject) => {
      const probe = new Audio();
      probe.preload = "metadata";
      const cleanup = () => {
        probe.onloadedmetadata = null;
        probe.onerror = null;
        probe.src = "";
      };
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error("Timed out loading that audio."));
      }, 20_000);
      probe.onloadedmetadata = () => {
        clearTimeout(timer);
        const seconds = Number.isFinite(probe.duration) && probe.duration > 0 ? probe.duration : 0;
        cleanup();
        resolve(seconds);
      };
      probe.onerror = () => {
        clearTimeout(timer);
        cleanup();
        reject(new Error("That doesn't seem to be a playable audio file."));
      };
      probe.src = src;
    });

  const selectCustomTrack = (track: ResolvedSoundtrack) => {
    onChange({ ...value, soundtrack: track });
  };

  // Passed straight to onClick rather than wrapped in an inline arrow, for
  // the same React Compiler lint reason documented on handlePreviewClick
  // below: a ref-touching function called through a closure created fresh
  // each render is something the rule can't positively verify.
  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChosen = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Let the same file be re-picked after an error without the input
    // silently ignoring it as "unchanged".
    event.target.value = "";
    if (!file) return;

    setCustomError(null);
    setCustomBusy(true);
    try {
      // Confirm it's real, decodable audio in the browser before spending a
      // round-trip uploading it.
      const objectUrl = URL.createObjectURL(file);
      try {
        await probeAudio(objectUrl);
      } finally {
        URL.revokeObjectURL(objectUrl);
      }

      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken?.toString();

      const body = new FormData();
      body.append("file", file);

      const res = await fetch("/api/music/upload", {
        method: "POST",
        headers: idToken ? { Authorization: `Bearer ${idToken}` } : undefined,
        body,
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        // 501 = storage isn't configured yet; the link tab still works, so
        // point the creator straight at it instead of a dead end.
        if (res.status === 501) setCustomTab("link");
        throw new Error(data?.error || "Couldn't upload that file.");
      }

      selectCustomTrack(data.track as ResolvedSoundtrack);
    } catch (err) {
      setCustomError(err instanceof Error ? err.message : "Couldn't upload that file.");
    } finally {
      setCustomBusy(false);
    }
  };

  const handleLinkAdd = async () => {
    const url = linkUrl.trim();
    if (!url || customBusy) return;

    setCustomError(null);

    if (!/^https:\/\//i.test(url)) {
      setCustomError("Use a direct https:// link to an audio file (MP3, M4A, WAV, OGG).");
      return;
    }

    setCustomBusy(true);
    try {
      const seconds = await probeAudio(url);
      let name = "My audio";
      try {
        const last = new URL(url).pathname.split("/").pop();
        if (last) name = decodeURIComponent(last).replace(/\.[^.]+$/, "").slice(0, 120) || name;
      } catch {
        // Unparseable URL still probed fine — keep the default title.
      }

      selectCustomTrack({
        id: `custom:${url}`,
        title: name,
        artist: "Your own music",
        url,
        // Never claim more than the cap: nothing will play past it anyway.
        durationSeconds: seconds > 0 ? Math.min(seconds, CUSTOM_AUDIO_MAX_SECONDS) : CUSTOM_AUDIO_MAX_SECONDS,
        source: "custom",
      });
      setLinkUrl("");
    } catch (err) {
      setCustomError(
        err instanceof Error
          ? `${err.message} Make sure it's a direct link to the audio file itself, not a page it's embedded on.`
          : "Couldn't load that link."
      );
    } finally {
      setCustomBusy(false);
    }
  };

  const localResults = searchSoundtracks(query).map(toResolvedSoundtrack);

  const [jamendoResults, setJamendoResults] = useState<ResolvedSoundtrack[]>([]);
  const [jamendoLoading, setJamendoLoading] = useState(false);
  const [jamendoError, setJamendoError] = useState<string | null>(null);

  const trimmedQuery = query.trim();

  // Debounced live search against real music — only once there's an
  // actual query, so the picker doesn't fire a network request on every
  // page load just to show the (already-instant) local catalog. When the
  // query is cleared, the effect just does nothing further (no setState)
  // — any stale jamendoResults/jamendoLoading/jamendoError from a previous
  // search are gated out below by trimmedQuery instead of being reset
  // here, so clearing the box can't flash a stray "couldn't search" error
  // or spinner from the last search.
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) return;

    let cancelled = false;

    const timer = setTimeout(async () => {
      if (cancelled) return;
      // Loading/error state only flips once the debounce actually elapses
      // and a real request is about to go out — not the instant a
      // keystroke lands — so these live inside the timer callback rather
      // than synchronously in the effect body.
      setJamendoLoading(true);
      setJamendoError(null);
      try {
        const res = await fetch(`/api/music/search?q=${encodeURIComponent(trimmed)}`);
        const data = await res.json();
        if (cancelled) return;

        if (!res.ok) {
          setJamendoError(data.error || "Couldn't search real music right now.");
          setJamendoResults([]);
        } else {
          setJamendoResults(Array.isArray(data.tracks) ? data.tracks : []);
        }
      } catch (err) {
        console.error("Music search failed:", err);
        if (!cancelled) {
          setJamendoError("Couldn't search real music right now.");
          setJamendoResults([]);
        }
      } finally {
        if (!cancelled) setJamendoLoading(false);
      }
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const results = [...localResults, ...(trimmedQuery ? jamendoResults : [])];
  const showJamendoLoading = trimmedQuery && jamendoLoading;
  const showJamendoError = trimmedQuery ? jamendoError : null;

  // Stop any preview if the creator navigates away mid-upload.
  useEffect(() => {
    const audio = previewAudioRef.current;
    return () => {
      audio?.pause();
    };
  }, []);

  // Reads which track to preview from the clicked button's own
  // data-track-id/data-url attributes (via currentTarget), and is passed
  // straight to onClick below with no per-item wrapper arrow. The React
  // Compiler ESLint rule flags a ref-touching function when it's invoked
  // through an inline closure created fresh on every render (as the old
  // `onClick={() => togglePreview(track.id, track.url)}` did) — passing
  // the handler directly, with the per-track data read off the event
  // instead of closed over, is what the rule can positively verify never
  // runs during render. No behavior change, same audio element, same
  // play/pause logic.
  const handlePreviewClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      const { trackId, url } = event.currentTarget.dataset;
      if (!trackId || !url) return;

      const audio = previewAudioRef.current;
      if (!audio) return;

      if (previewingId === trackId) {
        audio.pause();
        setPreviewingId(null);
        return;
      }

      audio.src = url;
      audio.currentTime = 0;
      void audio.play().catch(() => {
        // Blocked-autoplay rejection can't actually happen off a direct click
        // like this one, but fail quietly rather than throw either way.
      });
      setPreviewingId(trackId);
    },
    [previewingId]
  );

  return (
    <section className="rounded-3xl border border-orange-400/20 bg-orange-500/[0.04] p-4 sm:p-5">
      <audio ref={previewAudioRef} onEnded={() => setPreviewingId(null)} className="hidden" />

      <div>
        <p className="flex items-center gap-2 text-sm font-black text-white light:text-slate-900">
          <Music2 size={17} className="text-orange-400" />
          Short creation tools
        </p>
        <p className="mt-1 text-xs leading-5 text-slate-400 light:text-slate-600">
          {contentType === "short"
            ? "Choose an optional soundtrack clip and a look for your Short."
            : "Choose an optional background soundtrack and a look for your video — both are entirely optional and off by default."}
        </p>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-bold uppercase tracking-[.16em] text-slate-400 light:text-slate-600">
            Sound collection
          </p>
          {value.soundtrack && (
            <button
              type="button"
              onClick={() => onChange({ ...value, soundtrack: null })}
              className="text-[11px] font-semibold text-orange-300 hover:text-orange-200"
            >
              Clear
            </button>
          )}
        </div>

        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search InPlayer Sounds, or type a song/artist to find real music"
          className="mt-2 w-full rounded-xl border border-white/10 light:border-black/10 bg-[#07111F] light:bg-black/[0.03] px-3 py-2 text-xs text-white light:text-slate-900 outline-none focus:border-orange-400/50"
        />

        <div className="mt-2 grid max-h-64 grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
          {results.length === 0 ? (
            showJamendoLoading ? (
              <p className="col-span-full flex items-center justify-center gap-2 py-3 text-xs text-slate-500">
                <Loader2 size={13} className="animate-spin" /> Searching…
              </p>
            ) : (
              <p className="col-span-full py-3 text-center text-xs text-slate-500">
                No sounds match &quot;{query}&quot;.
              </p>
            )
          ) : (
            results.map((track) => {
              const selected = value.soundtrack?.id === track.id;
              const previewing = previewingId === track.id;
              return (
                <div
                  key={track.id}
                  className={`flex items-center gap-2 rounded-2xl border p-3 transition ${
                    selected
                      ? "border-orange-400/60 bg-orange-500/15"
                      : "border-white/10 bg-white/[.03] hover:border-orange-400/30 light:border-black/10"
                  }`}
                >
                  <button
                    type="button"
                    data-track-id={track.id}
                    data-url={track.url}
                    onClick={handlePreviewClick}
                    aria-label={previewing ? `Pause preview of ${track.title}` : `Preview ${track.title}`}
                    className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 light:bg-black/10 light:text-slate-900"
                  >
                    {previewing ? <Pause size={13} /> : <Play size={13} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => onChange({ ...value, soundtrack: selected ? null : track })}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="truncate text-xs font-bold text-white light:text-slate-900">
                      {track.title}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1.5 truncate text-[11px] text-slate-400 light:text-slate-600">
                      <span className="truncate">{track.artist}</span>
                      <span
                        className={`flex-shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide ${
                          track.source === "jamendo"
                            ? "bg-emerald-500/15 text-emerald-300"
                            : "bg-orange-500/15 text-orange-300"
                        }`}
                      >
                        {track.source === "jamendo" ? "CC music" : "InPlayer"}
                      </span>
                    </p>
                  </button>
                </div>
              );
            })
          )}
        </div>

        {showJamendoError && (
          <p className="mt-2 text-[11px] text-red-300">{showJamendoError}</p>
        )}
      </div>

      {/* Your own music — upload a file or paste a direct link. Kept in its
          own bordered block, below the two licensed catalogs, because the
          rules are different: InPlayer has no rights to this audio, so only
          the first CUSTOM_AUDIO_MAX_SECONDS of it is ever played back. */}
      <div className="mt-4 rounded-2xl border border-white/10 bg-black/10 p-3 light:border-black/10 light:bg-white/40">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-bold uppercase tracking-[.16em] text-slate-400 light:text-slate-600">
            Your own music
          </p>
          <div className="flex gap-1 rounded-full bg-white/5 p-0.5 light:bg-black/5">
            {(
              [
                { key: "upload", label: "Upload", icon: Upload },
                { key: "link", label: "Link", icon: Link2 },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  setCustomTab(tab.key);
                  setCustomError(null);
                }}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold transition ${
                  customTab === tab.key
                    ? "bg-orange-500 text-white"
                    : "text-slate-400 hover:text-slate-200 light:hover:text-slate-700"
                }`}
              >
                <tab.icon size={12} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {customTab === "upload" ? (
          <div className="mt-2.5">
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              onChange={handleFileChosen}
              className="hidden"
            />
            <button
              type="button"
              disabled={customBusy}
              onClick={openFilePicker}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 bg-white/[.03] px-3 py-3 text-xs font-semibold text-slate-300 transition hover:border-orange-400/50 hover:text-white disabled:cursor-not-allowed disabled:opacity-60 light:border-black/20 light:text-slate-700 light:hover:text-slate-900"
            >
              {customBusy ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Uploading…
                </>
              ) : (
                <>
                  <Upload size={14} className="text-orange-400" /> Choose an audio file
                </>
              )}
            </button>
            <p className="mt-1.5 text-[10px] text-slate-500">
              MP3, M4A, WAV, OGG or FLAC · up to 4MB
            </p>
          </div>
        ) : (
          <div className="mt-2.5">
            <div className="flex gap-2">
              <input
                type="url"
                inputMode="url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void handleLinkAdd();
                  }
                }}
                placeholder="https://example.com/my-track.mp3"
                className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#07111F] px-3 py-2 text-xs text-white outline-none focus:border-orange-400/50 light:border-black/10 light:bg-black/[0.03] light:text-slate-900"
              />
              <button
                type="button"
                onClick={handleLinkAdd}
                disabled={customBusy || !linkUrl.trim()}
                className="flex-shrink-0 rounded-xl bg-orange-500 px-3 py-2 text-xs font-bold text-white transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {customBusy ? <Loader2 size={13} className="animate-spin" /> : "Add"}
              </button>
            </div>
            <p className="mt-1.5 text-[10px] text-slate-500">
              A direct link to the audio file itself — not a YouTube/Spotify page.
            </p>
          </div>
        )}

        {customError && <p className="mt-2 text-[11px] text-red-300">{customError}</p>}

        {value.soundtrack?.source === "custom" && (
          <div className="mt-2.5 flex items-center gap-2 rounded-xl border border-orange-400/60 bg-orange-500/15 p-2.5">
            <button
              type="button"
              data-track-id={value.soundtrack.id}
              data-url={value.soundtrack.url}
              onClick={handlePreviewClick}
              aria-label={
                previewingId === value.soundtrack.id
                  ? `Pause preview of ${value.soundtrack.title}`
                  : `Preview ${value.soundtrack.title}`
              }
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 light:bg-black/10 light:text-slate-900"
            >
              {previewingId === value.soundtrack.id ? <Pause size={13} /> : <Play size={13} />}
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-white light:text-slate-900">
                {value.soundtrack.title}
              </p>
              <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-400 light:text-slate-600">
                <span className="rounded-full bg-sky-500/15 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-sky-300">
                  Your music
                </span>
                <span>Plays for {CUSTOM_AUDIO_MAX_SECONDS}s</span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => onChange({ ...value, soundtrack: null })}
              className="flex-shrink-0 text-[11px] font-semibold text-orange-300 hover:text-orange-200"
            >
              Remove
            </button>
          </div>
        )}

        <p className="mt-2.5 flex items-start gap-1.5 text-[10px] leading-4 text-slate-500">
          <ShieldCheck size={12} className="mt-px flex-shrink-0 text-emerald-400" />
          <span>
            Only the first {CUSTOM_AUDIO_MAX_SECONDS} seconds of your own music will ever play — it
            loops back to the start after that. Make sure you have the right to use the audio you add.
          </span>
        </p>
      </div>

      {contentType === "short" ? (
        <div className="mt-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-300 light:text-slate-700">Music clip</span>
            {([20, 30] as const).map((seconds) => (
              <button
                key={seconds}
                type="button"
                onClick={() => onChange({ ...value, musicClipSeconds: seconds })}
                className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                  value.musicClipSeconds === seconds
                    ? "bg-orange-500 text-white"
                    : "bg-white/5 text-slate-400 hover:bg-white/10 light:bg-black/5"
                }`}
              >
                {seconds}s
              </button>
            ))}
          </div>
          {/* The 30s option can't be honoured for the creator's own audio —
              be upfront about it here rather than silently playing 29s. */}
          {value.soundtrack?.source === "custom" && value.musicClipSeconds > CUSTOM_AUDIO_MAX_SECONDS && (
            <p className="mt-1.5 text-[10px] text-slate-500">
              Your own music is capped at {CUSTOM_AUDIO_MAX_SECONDS}s, so this clip will play for{" "}
              {CUSTOM_AUDIO_MAX_SECONDS}s.
            </p>
          )}
        </div>
      ) : (
        value.soundtrack && (
          <p className="mt-4 text-[11px] text-slate-400 light:text-slate-600">
            {value.soundtrack.source === "custom"
              ? `The first ${CUSTOM_AUDIO_MAX_SECONDS} seconds loop for the whole video, replacing the video's own audio.`
              : "The soundtrack loops for the whole video, replacing the video's own audio."}
          </p>
        )
      )}

      <div className="mt-4">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.16em] text-slate-400 light:text-slate-600">
          <SlidersHorizontal size={14} />
          Look
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {(["original", "warm", "vivid", "mono"] as const).map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => onChange({ ...value, filter })}
              className={`rounded-full px-3 py-1.5 text-xs font-bold capitalize transition ${
                value.filter === filter
                  ? "bg-white text-slate-900 light:bg-slate-900 light:text-white"
                  : "bg-white/5 text-slate-400 hover:bg-white/10 light:bg-black/5"
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 rounded-2xl border border-white/10 bg-black/10 p-3 text-xs text-slate-400 light:border-black/10 light:bg-white/40 light:text-slate-600">
        <Wand2 size={15} className="shrink-0 text-orange-400" />
        {contentType === "short"
          ? "Soundtrack and look selections are saved with the Short and play back automatically in the Shorts feed."
          : "Soundtrack and look selections are saved with the video and play back automatically wherever it's watched."}
      </div>
    </section>
  );
}
