"use client";

import { useEffect, useState } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import { Crown, Loader2 } from "lucide-react";
import VideoPlayer from "@/app/components/VideoPlayer";
import MembershipButton from "@/app/components/MembershipButton";
import { useAuthModal } from "@/app/components/auth/AuthProvider";

interface MembersOnlyVideoPlayerProps {
  videoId: string;
  title: string;
  uploaderId: string;
  uploaderName: string;
}

// Real gating, not a UI-only lock: this never receives a playable Mux
// playback ID from the server for a members-only video (see
// app/watch/[videoId]/page.tsx) — it fetches one itself, with the
// viewer's own auth token, from app/api/videos/[videoId]/playback-token,
// which only ever hands back a real, working (signed, short-lived) token
// after actually checking the viewer is the owner or an active paid
// member. Anyone else gets a 403 and this renders the paywall instead of
// a player — there's no playback ID sitting in the page for them to grab.
export default function MembersOnlyVideoPlayer({
  videoId,
  title,
  uploaderId,
  uploaderName,
}: MembersOnlyVideoPlayerProps) {
  const { signedIn, openSignIn } = useAuthModal();
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "denied" }
    | { status: "error"; message: string }
    | { status: "ready"; playbackId: string; token: string }
  >({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!signedIn) {
        setState({ status: "denied" });
        return;
      }
      try {
        const session = await fetchAuthSession();
        const idToken = session.tokens?.idToken?.toString();
        const res = await fetch(`/api/videos/${videoId}/playback-token`, {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        const data = await res.json();
        if (cancelled) return;

        if (res.ok) {
          setState({ status: "ready", playbackId: data.playbackId, token: data.token });
        } else if (res.status === 403) {
          setState({ status: "denied" });
        } else {
          setState({ status: "error", message: data.error || "Couldn't load this video." });
        }
      } catch (err) {
        console.error("Failed to load members-only playback token:", err);
        if (!cancelled) setState({ status: "error", message: "Couldn't load this video." });
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [videoId, signedIn]);

  if (state.status === "ready") {
    return (
      <VideoPlayer
        playbackId={state.playbackId}
        token={state.token}
        title={title}
        videoId={videoId}
      />
    );
  }

  if (state.status === "loading") {
    return (
      <div className="flex aspect-video w-full items-center justify-center bg-black">
        <Loader2 size={26} className="animate-spin text-orange-400" />
      </div>
    );
  }

  return (
    <div className="flex aspect-video w-full flex-col items-center justify-center gap-4 bg-black px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/15 text-amber-400">
        <Crown size={26} />
      </div>
      <div>
        <p className="text-base font-bold text-white">Members-only video</p>
        <p className="mt-1 max-w-sm text-sm text-slate-400">
          {state.status === "error"
            ? state.message
            : `Become a paid member of ${uploaderName} to watch this video.`}
        </p>
      </div>
      {!signedIn ? (
        <button
          onClick={openSignIn}
          className="rounded-full bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] px-6 py-2.5 text-sm font-bold text-white shadow-[0_10px_25px_rgba(255,153,0,.3)] transition hover:-translate-y-0.5"
        >
          Sign in
        </button>
      ) : state.status === "denied" ? (
        <MembershipButton creatorId={uploaderId} creatorName={uploaderName} />
      ) : null}
    </div>
  );
}
