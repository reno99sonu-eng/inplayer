"use client";

import MuxPlayer from "@mux/mux-player-react";
import type { CSSProperties } from "react";

interface VideoPlayerProps {
  playbackId: string;
  title: string;
  videoId: string;
}

export default function VideoPlayer({
  playbackId,
  title,
  videoId,
}: VideoPlayerProps) {
  return (
    // "premium-player" is targeted in globals.css to reskin Mux's default
    // control bar (glass gradient + blur) and center play button (brand
    // gradient orb) — Mux Player's built-in props only take color theming
    // so far, the rest is done via ::part() selectors on the custom element.
    <div className="premium-player overflow-hidden rounded-2xl bg-black">
      <MuxPlayer
        playbackId={playbackId}
        metadata={{
          video_id: videoId,
          video_title: title,
        }}
        videoTitle={title}
        accentColor="#FF9A00"
        primaryColor="#FFFFFF"
        defaultHiddenCaptions={false}
        playbackRates={[0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]}
        style={
          {
            width: "100%",
            aspectRatio: "16 / 9",
            // Let our own ::part(bottom) gradient in globals.css be the
            // only background behind the control bar, instead of layering
            // Mux's default backdrop underneath it.
            "--controls-backdrop-color": "transparent",
          } as CSSProperties
        }
      />
    </div>
  );
}
