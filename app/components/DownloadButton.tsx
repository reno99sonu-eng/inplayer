"use client";

import { useEffect, useRef, useState } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import { Download, Loader2, AlertCircle } from "lucide-react";
import { useAuthModal } from "./auth/AuthProvider";

type DownloadStatus = "unavailable" | "preparing" | "ready" | "errored";
type Renditions = Record<string, string>;

interface DownloadButtonProps {
  videoId: string;
  initialStatus: DownloadStatus;
  initialRenditions?: Renditions;
}

const POLL_INTERVAL_MS = 4000;
// Comfortably longer than prepare-download's own STUCK_THRESHOLD_MS
// (3 minutes) so that by the time this gives up and the viewer clicks
// Download again, the server is already willing to kick off a fresh
// rendition request rather than just repeating "preparing".
const POLL_GIVE_UP_MS = 4 * 60 * 1000;

// Display order for the quality menu (best first).
const QUALITY_ORDER = [
  "highest",
  "2160p",
  "1440p",
  "1080p",
  "720p",
  "540p",
  "480p",
  "360p",
  "270p",
];

function orderedQualities(renditions: Renditions): string[] {
  const present = Object.keys(renditions);
  const known = QUALITY_ORDER.filter((q) => present.includes(q));
  // Include any unexpected keys at the end so nothing is ever hidden.
  const extras = present.filter((q) => !QUALITY_ORDER.includes(q));
  return [...known, ...extras];
}

// Videos only — never rendered for Shorts. A video with no renditions yet
// (anything uploaded before this feature) starts "unavailable"; the first
// click kicks off prepare-download and the button polls until the webhook
// flips it to "ready", at which point it becomes a quality picker.
export default function DownloadButton({
  videoId,
  initialStatus,
  initialRenditions = {},
}: DownloadButtonProps) {
  const { signedIn, openSignIn } = useAuthModal();
  const [status, setStatus] = useState<DownloadStatus>(initialStatus);
  const [renditions, setRenditions] = useState<Renditions>(initialRenditions);
  const [requesting, setRequesting] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const startPolling = () => {
    stopPolling();
    const startedAt = Date.now();

    pollRef.current = setInterval(async () => {
      // Taking this long almost always means the webhook that would flip
      // this to "ready" got lost — polling forever would just spin. Give up
      // and switch to a retryable "errored" state; clicking Download again
      // calls prepare-download, which by now is past its own stuck-detection
      // threshold and will request fresh renditions.
      if (Date.now() - startedAt > POLL_GIVE_UP_MS) {
        setStatus("errored");
        stopPolling();
        return;
      }

      try {
        const res = await fetch(`/api/videos/${videoId}/status`);
        const data = await res.json();

        if (data.downloadStatus === "ready") {
          setStatus("ready");
          setRenditions(data.downloadRenditions || {});
          stopPolling();
        } else if (data.downloadStatus === "errored") {
          setStatus("errored");
          stopPolling();
        }
      } catch (err) {
        console.error("Failed to poll download status:", err);
      }
    }, POLL_INTERVAL_MS);
  };

  // Resume polling on mount if a previous visit already kicked off
  // preparation.
  useEffect(() => {
    if (status === "preparing") startPolling();
    return stopPolling;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close the quality menu on outside click.
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const qualities = orderedQualities(renditions);

  const startDownload = (quality?: string) => {
    const q = quality ? `?quality=${encodeURIComponent(quality)}` : "";
    // Same-origin route with Content-Disposition: attachment — the browser
    // downloads it and stays on this page, no navigation.
    window.location.href = `/api/videos/${videoId}/download${q}`;
    setMenuOpen(false);
  };

  const handleClick = async () => {
    if (status === "ready") {
      // With named qualities, open the picker; otherwise (legacy single
      // file) download the default straight away.
      if (qualities.length > 0) {
        setMenuOpen((v) => !v);
      } else {
        startDownload();
      }
      return;
    }

    if (status === "preparing" || requesting) return;

    if (!signedIn) {
      openSignIn();
      return;
    }

    setRequesting(true);

    try {
      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken?.toString();

      const res = await fetch(`/api/videos/${videoId}/prepare-download`, {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}` },
      });

      const data = await res.json();

      if (res.ok) {
        setStatus(data.status);
        if (data.status === "ready") {
          setRenditions(data.renditions || {});
        } else if (data.status === "preparing") {
          startPolling();
        }
      } else {
        console.error("prepare-download failed:", data.error);
        setStatus("errored");
      }
    } catch (err) {
      console.error("Failed to start download preparation:", err);
      setStatus("errored");
    } finally {
      setRequesting(false);
    }
  };

  const title =
    status === "ready"
      ? "Download video"
      : status === "preparing"
        ? "Preparing download…"
        : status === "errored"
          ? "Download failed — click to retry"
          : "Download video";

  return (
    <div ref={wrapRef} className="relative">
      <button
        onClick={handleClick}
        disabled={status === "preparing" || requesting}
        title={title}
        aria-label={title}
        className={`
          flex h-9 w-9 items-center justify-center rounded-full border
          transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-60
          ${
            menuOpen
              ? "border-orange-400/50 bg-gradient-to-br from-orange-500/20 to-amber-400/10 text-orange-300 light:text-orange-700"
              : "border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.02] text-slate-300 light:text-slate-600 hover:border-white/20 light:hover:border-black/20 hover:bg-white/[0.06]"
          }
        `}
      >
        {status === "preparing" || requesting ? (
          <Loader2 size={18} className="animate-spin" />
        ) : status === "errored" ? (
          <AlertCircle size={18} className="text-red-400" />
        ) : (
          <Download size={18} />
        )}
      </button>

      {menuOpen && status === "ready" && qualities.length > 0 && (
        <div
          className="
            absolute right-0 z-50 mt-2 w-44 max-w-[calc(100vw-2rem)]
            rounded-2xl border border-white/10 light:border-black/10
            bg-[#0A1424] light:bg-[#FBF6EA]
            p-2 shadow-[0_25px_70px_-20px_rgba(0,0,0,.6)] backdrop-blur-xl
          "
        >
          <p className="px-2 pb-1 pt-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 light:text-slate-600">
            Download quality
          </p>
          {qualities.map((q) => (
            <button
              key={q}
              onClick={() => startDownload(q)}
              className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm font-semibold text-slate-200 light:text-slate-800 transition hover:bg-white/5 light:hover:bg-black/5"
            >
              <span>{q === "highest" ? "Highest" : q}</span>
              <Download size={14} className="text-slate-400 light:text-slate-600" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
