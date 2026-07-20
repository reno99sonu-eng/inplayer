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

  const handlePlayerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const player = playerRef.current;
    if (!player) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickY = e.clientY - rect.top;
    const controlBarZone = 64;

    if (clickY > rect.height - controlBarZone) return;

    if (player.paused) {
      player.play();
    } else {
      player.pause();
    }
  };

  return (
    <div
      className="premium-player overflow-hidden rounded-2xl bg-black"
      onClick={handlePlayerClick}
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
        autoPlay="muted"
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