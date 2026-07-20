"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";

interface ProcessingStatusProps {
  videoId: string;
  // If true, calls router.refresh() once ready instead of showing its own
  // "Watch Now" screen — used on the watch page, so it seamlessly
  // transitions into the real player instead of showing a redundant link.
  autoRefreshOnReady?: boolean;
}

export default function ProcessingStatus({
  videoId,
  autoRefreshOnReady = false,
}: ProcessingStatusProps) {
  const router = useRouter();
  const [status, setStatus] = useState<"processing" | "ready" | "error">(
    "processing"
  );
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    const startTime = Date.now();

    const tick = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    const poll = setInterval(async () => {
      try {
        const res = await fetch(`/api/videos/${videoId}/status`);
        const data = await res.json();

        if (data.status === "ready") {
          clearInterval(poll);
          clearInterval(tick);

          if (autoRefreshOnReady) {
            router.refresh();
          } else {
            setStatus("ready");
          }
        } else if (data.status === "error") {
          setStatus("error");
          clearInterval(poll);
          clearInterval(tick);
        }
      } catch (err) {
        console.error("Failed to check processing status:", err);
      }
    }, 5000);

    return () => {
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [videoId, autoRefreshOnReady, router]);

  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;

  if (status === "ready") {
    return (
      <div className="flex flex-col items-center gap-5 py-12 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/15 border border-emerald-400/30">
          <CheckCircle2 size={36} className="text-emerald-400" />
        </div>
        <div>
          <p className="font-semibold text-white light:text-slate-900">
            Your video is ready!
          </p>
          <p className="mt-1 text-sm text-slate-400 light:text-slate-600">
            It's now live on InPlayer.
          </p>
        </div>
        <Link
          href={`/watch/${videoId}`}
          className="rounded-2xl bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] px-6 py-2.5 text-sm font-bold text-white"
        >
          Watch Now
        </Link>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex flex-col items-center gap-5 py-12 text-center">
        <p className="font-semibold text-white light:text-slate-900">
          Something went wrong processing this video
        </p>
        <p className="text-sm text-slate-400 light:text-slate-600">
          Please try uploading again.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-5 py-12 text-center">
      <Loader2 size={36} className="animate-spin text-orange-400" />
      <div>
        <p className="font-semibold text-white light:text-slate-900">
          Processing your video...
        </p>
        <p className="mt-1 text-sm text-slate-400 light:text-slate-600">
          Elapsed: {minutes}:{seconds.toString().padStart(2, "0")} — this
          updates automatically once it's ready, no need to check manually.
        </p>
      </div>
    </div>
  );
}
