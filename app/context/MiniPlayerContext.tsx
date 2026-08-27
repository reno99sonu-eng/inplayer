"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { useRouter } from "next/navigation";

export interface MiniVideo {
  videoId: string;
  title: string;
  creator: string;
  thumbnailUrl: string;
  muxPlaybackId?: string;
  isShort?: boolean;
  currentTime?: number;
}

interface MiniPlayerContextType {
  miniVideo: MiniVideo | null;
  isOpen: boolean;
  isPlaying: boolean;
  minimizeVideo: (video: MiniVideo) => void;
  expandVideo: () => void;
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
    setIsPlaying(true);
  }, []);

  const expandVideo = useCallback(() => {
    if (!miniVideo) return;
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
