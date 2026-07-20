"use client";

import { useEffect, useRef, useState } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import { Download, Loader2, AlertCircle } from "lucide-react";
import { useAuthModal } from "./auth/AuthProvider";

type DownloadStatus = "unavailable" | "preparing" | "ready" | "errored";

interface DownloadButtonProps {
  videoId: string;
  initialStatus: DownloadStatus;
}

const POLL_INTERVAL_MS = 4000;

// Videos only — never rendered for Shorts (see WatchPageContent.tsx). A
// video with no static rendition requested yet (anything uploaded before
// this feature shipped) starts "unavailable"; the first click kicks off
// prepare-download and the button polls until Mux's webhook flips it to
// "ready", at which point it becomes a real, working download.
export default function DownloadButton({
  videoId,
  initialStatus,
}: DownloadButtonProps) {
  const { signedIn, openSignIn } = useAuthModal();
  const [status, setStatus] = useState<DownloadStatus>(initialStatus);
  const [requesting, setRequesting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const startPolling = () => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/videos/${videoId}/status`);
        const data = await res.json();

        if (data.downloadStatus === "ready" || data.downloadStatus === "errored") {
          setStatus(data.downloadStatus);
          stopPolling();
        }
      } catch (err) {
        console.error("Failed to poll download status:", err);
      }
    }, POLL_INTERVAL_MS);
  };

  // Resume polling on mount if a previous visit already kicked off
  // preparation (e.g. the viewer navigated away and came back).
  useEffect(() => {
    if (status === "preparing") startPolling();
    return stopPolling;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClick = async () => {
    if (status === "ready") {
      // Same-origin route with Content-Disposition: attachment — the
      // browser downloads it and stays on this page, no navigation.
      window.location.href = `/api/videos/${videoId}/download`;
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
        if (data.status === "preparing") startPolling();
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
    <button
      onClick={handleClick}
      disabled={status === "preparing" || requesting}
      title={title}
      className="
        flex h-9 w-9 items-center justify-center rounded-full
        border border-white/10 light:border-black/10
        bg-white/[0.03] light:bg-black/[0.02]
        text-slate-300 light:text-slate-600
        transition-all duration-300
        hover:border-white/20 light:hover:border-black/20 hover:bg-white/[0.06]
        disabled:cursor-not-allowed disabled:opacity-60
      "
    >
      {status === "preparing" || requesting ? (
        <Loader2 size={18} className="animate-spin" />
      ) : status === "errored" ? (
        <AlertCircle size={18} className="text-red-400" />
      ) : (
        <Download size={18} />
      )}
    </button>
  );
}
