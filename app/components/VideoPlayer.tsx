"use client";

import MuxPlayer from "@mux/mux-player-react";
import type { MuxCSSProperties } from "@mux/mux-player-react";

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
    // "premium-player" is targeted in globals.css to reskin the center
    // play button into a neutral dark-glass circle (YouTube-style, no
    // brand-color gradient). The bottom control bar's dark glass look
    // comes from --controls-backdrop-color below, not a shadow-DOM
    // ::part() override, to avoid interfering with the settings menu.
    <div className="premium-player overflow-hidden rounded-2xl bg-black">
      <MuxPlayer
        playbackId={playbackId}
        metadata={{
          video_id: videoId,
          video_title: title,
        }}
        videoTitle={title}
        // A single, deeper "sunset orange" accent (not the bright
        // orange-to-yellow gradient) for the progress bar — enough brand
        // identity without reading as loud/cartoonish on the player itself.
        accentColor="#EA580C"
        primaryColor="#FFFFFF"
        defaultHiddenCaptions={false}
        playbackRates={[0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]}
        style={
          {
            width: "100%",
            aspectRatio: "16 / 9",
            "--controls-backdrop-color": "rgba(0, 0, 0, 0.7)",
          } as MuxCSSProperties
        }
      />
    </div>
  );
}
