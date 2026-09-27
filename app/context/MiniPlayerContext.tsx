"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { saveMiniPlayerResumePosition } from "@/app/lib/playbackPositions";

export interface MiniVideo {
  videoId: string;
  title: string;
  creator: string;
  thumbnailUrl: string;
  muxPlaybackId?: string;
  playbackToken?: string;
  isShort?: boolean;
  currentTime?: number;
  contentAspectRatio?: number;
  isPlaying?: boolean;
  cropToContent?: boolean;
}

interface MiniPlayerContextType {
  miniVideo: MiniVideo | null;
  isOpen: boolean;
  isPlaying: boolean;
  minimizeVideo: (video: MiniVideo) => void;
  expandVideo: (currentTime?: number) => void;
  closeMiniPlayer: () => void;
  togglePlay: () => void;
}

const MiniPlayerContext = createContext<MiniPlayerContextType | undefined>(undefined);

export function MiniPlayerProvider({ children }: { children: ReactNode }) {
  const [miniVideo, setMiniVideo] = useState<MiniVideo | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const router = useRouter();

  const minimizeVideo = useCallback((video: MiniVideo) => {
    setMiniVideo(video);
    setIsOpen(true);
    setIsPlaying(video.isPlaying ?? true);
  }, []);

  const expandVideo = useCallback((currentTime?: number) => {
    if (!miniVideo) return;
    const resumeAt = currentTime ?? miniVideo.currentTime;
    if (typeof resumeAt === "number" && Number.isFinite(resumeAt)) {
      saveMiniPlayerResumePosition(miniVideo.videoId, resumeAt);
    }
    setIsOpen(false);
    if (miniVideo.isShort) {
      router.push(`/shorts?v=${miniVideo.videoId}`);
    } else {
      router.push(`/watch/${miniVideo.videoId}`);
    }
  }, [miniVideo, router]);

  const closeMiniPlayer = useCallback(() => {
    setIsOpen(false);
    setMiniVideo(null);
  }, []);

  const togglePlay = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  return (
    <MiniPlayerContext.Provider
      value={{
        miniVideo,
        isOpen,
        isPlaying,
        minimizeVideo,
        expandVideo,
        closeMiniPlayer,
        togglePlay,
      }}
    >
      {children}
    </MiniPlayerContext.Provider>
  );
}

export function useMiniPlayer() {
  const context = useContext(MiniPlayerContext);
  if (!context) {
    throw new Error("useMiniPlayer must be used within a MiniPlayerProvider");
  }
  return context;
}
