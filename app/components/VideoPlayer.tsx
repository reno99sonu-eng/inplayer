"use client";

import MuxPlayer from "@mux/mux-player-react";

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
    <div className="overflow-hidden rounded-2xl bg-black">
      <MuxPlayer
        playbackId={playbackId}
        metadata={{
          video_id: videoId,
          video_title: title,
        }}
        accentColor="#FF9A00"
        style={{ width: "100%", aspectRatio: "16 / 9" }}
      />
    </div>
  );
}
