"use client";

import { useRef } from "react";
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
  const playerRef = useRef<any>(null);

  // Mux Player has its own BUILT-IN click-to-toggle-play/pause gesture on
  // the video surface (confirmed in Mux/media-chrome's own docs — this is
  // why clicking did nothing on desktop: our handler ran on the normal
  // bubble phase, AFTER Mux's own internal listener had already toggled
  // the state, so our toggle just flipped it right back). Fix: run in the
  // CAPTURE phase instead (fires on the way down, before Mux's own
  // listener), and stopPropagation() there so Mux's built-in gesture never
  // fires at all — but only for clicks on the video itself, never inside
  // the bottom control-bar zone, so the real play/pause button, volume,
  // scrubber, settings and fullscreen controls keep working normally.
  const handlePlayerClickCapture = (e: React.MouseEvent<HTMLDivElement>) => {
    const player = playerRef.current;
    if (!player) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickY = e.clientY - rect.top;
    const controlBarZone = 64;

    if (clickY > rect.height - controlBarZone) return;

    e.stopPropagation();

    if (player.paused) {
      player.play();
    } else {
      player.pause();
    }
  };

  return (
    <div
      className="premium-player overflow-hidden rounded-2xl bg-black"
      onClickCapture={handlePlayerClickCapture}
    >
      <MuxPlayer
        ref={playerRef}
        playbackId={playbackId}
        metadata={{
          video_id: videoId,
          video_title: title,
        }}
        videoTitle={title}
        accentColor="#EA580C"
        primaryColor="#FFFFFF"
        defaultHiddenCaptions={false}
        playbackRates={[0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]}
        // "any": try to autoplay WITH sound first; if the browser blocks
        // that (very common on mobile, especially iOS Safari, far more
        // aggressive about this than desktop), Mux automatically retries
        // muted instead of just giving up. Plain `autoPlay={true}` doesn't
        // fall back at all — on mobile that meant the video just sat there
        // un-played until a manual tap, which combined with no poster
        // frame (fixed below) is exactly what read as "a lot of empty
        // black space" on the watch page.
        autoPlay="any"
        // Gives Mux a real poster frame (auto-generated from the video
        // itself) to show before playback starts and whenever it's
        // paused/ended, instead of a flat black rectangle.
        thumbnailTime={0}
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