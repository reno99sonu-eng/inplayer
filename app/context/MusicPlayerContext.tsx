"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  ReactNode,
} from "react";
import type { LyricLine } from "@/app/lib/musicTrack";

export interface MusicTrack {
  videoId: string;
  title: string;
  artist: string;
  uploaderId?: string;
  uploaderUsername?: string;
  uploaderAvatarUrl?: string;
  covers: string[];
  coverIntervalSeconds?: number;
  lyrics?: LyricLine[];
  genre?: string;
  muxPlaybackId?: string;
  duration?: number;
  audioUrl?: string;
  views?: number | string;
  likeCount?: number | string;
}

interface MusicPlayerContextType {
  currentTrack: MusicTrack | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  repeatMode: "off" | "all" | "one";
  isShuffled: boolean;
  playbackRate: number;
  queue: MusicTrack[];
  queueIndex: number;
  isExpanded: boolean;
  isLyricDrawerOpen: boolean;
  isQueueDrawerOpen: boolean;
  activeCoverIndex: number;
  activeLyricIndex: number;
  audioRef: React.RefObject<HTMLAudioElement | null>;
  playTrack: (track: MusicTrack, newQueue?: MusicTrack[]) => void;
  togglePlay: () => void;
  pause: () => void;
  resume: () => void;
  seek: (seconds: number) => void;
  nextTrack: () => void;
  prevTrack: () => void;
  setVolume: (vol: number) => void;
  toggleMute: () => void;
  toggleRepeat: () => void;
  toggleShuffle: () => void;
  setPlaybackRate: (rate: number) => void;
  setExpanded: (expanded: boolean) => void;
  toggleLyricDrawer: () => void;
  toggleQueueDrawer: () => void;
  addToQueue: (track: MusicTrack) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
  closePlayer: () => void;
}

const MusicPlayerContext = createContext<MusicPlayerContextType | undefined>(
  undefined
);

export function MusicPlayerProvider({ children }: { children: ReactNode }) {
  const [currentTrack, setCurrentTrack] = useState<MusicTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolumeState] = useState<number>(0.85);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [repeatMode, setRepeatMode] = useState<"off" | "all" | "one">("off");
  const [isShuffled, setIsShuffled] = useState<boolean>(false);
  const [playbackRate, setPlaybackRateState] = useState<number>(1.0);
  const [queue, setQueue] = useState<MusicTrack[]>([]);
  const [queueIndex, setQueueIndex] = useState<number>(0);
  const [isExpanded, setExpanded] = useState<boolean>(false);
  const [isLyricDrawerOpen, setIsLyricDrawerOpen] = useState<boolean>(false);
  const [isQueueDrawerOpen, setIsQueueDrawerOpen] = useState<boolean>(false);
  const [activeCoverIndex, setActiveCoverIndex] = useState<number>(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize audio element
  useEffect(() => {
    if (typeof window === "undefined") return;
    const audio = new Audio();
    audio.preload = "auto";
    audioRef.current = audio;

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const onLoadedMetadata = () => {
      setDuration(audio.duration || currentTrack?.duration || 0);
    };

    const onEnded = () => {
      if (repeatMode === "one") {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      } else {
        nextTrackRef.current();
      }
    };

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.pause();
      audio.src = "";
    };
  }, []);

  // Multi-cover cycling timer
  useEffect(() => {
    if (!currentTrack || !currentTrack.covers || currentTrack.covers.length <= 1) {
      setActiveCoverIndex(0);
      return;
    }
    const intervalSec = currentTrack.coverIntervalSeconds || 7;
    const idx = Math.floor(currentTime / intervalSec) % currentTrack.covers.length;
    setActiveCoverIndex(idx);
  }, [currentTime, currentTrack]);

  // Compute active lyric index
  const activeLyricIndex = React.useMemo(() => {
    if (!currentTrack?.lyrics || currentTrack.lyrics.length === 0) return -1;
    const lyrics = currentTrack.lyrics;
    for (let i = lyrics.length - 1; i >= 0; i--) {
      const lineTime = lyrics[i].time ?? (lyrics[i] as any).seconds ?? 0;
      if (currentTime >= lineTime) {
        return i;
      }
    }
    return 0;
  }, [currentTime, currentTrack?.lyrics]);

  // Handle Play Track
  const playTrack = useCallback(
    (track: MusicTrack, newQueue?: MusicTrack[]) => {
      setCurrentTrack(track);
      setCurrentTime(0);

      if (newQueue && newQueue.length > 0) {
        setQueue(newQueue);
        const idx = newQueue.findIndex((t) => t.videoId === track.videoId);
        setQueueIndex(idx >= 0 ? idx : 0);
      } else {
        setQueue((prev) => {
          const exists = prev.some((t) => t.videoId === track.videoId);
          if (exists) return prev;
          return [...prev, track];
        });
      }

      if (audioRef.current) {
        // Resolve stream audio source
        let streamUrl = track.audioUrl;
        if (!streamUrl && track.muxPlaybackId) {
          // Mux audio stream URL or fallback HLS
          streamUrl = `https://stream.mux.com/${track.muxPlaybackId}/audio.m4a`;
        }
        if (!streamUrl) {
          streamUrl = `/api/videos/${track.videoId}/download`;
        }

        audioRef.current.src = streamUrl;
        audioRef.current.playbackRate = playbackRate;
        audioRef.current.volume = isMuted ? 0 : volume;
        audioRef.current
          .play()
          .then(() => setIsPlaying(true))
          .catch((err) => {
            console.warn("Audio autoplay blocked or failed, trying fallback stream:", err);
            if (track.muxPlaybackId && audioRef.current) {
              audioRef.current.src = `https://stream.mux.com/${track.muxPlaybackId}.m3u8`;
              audioRef.current.play().catch(() => {});
            }
          });
      }
    },
    [playbackRate, volume, isMuted]
  );

  const togglePlay = useCallback(() => {
    if (!audioRef.current || !currentTrack) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  }, [isPlaying, currentTrack]);

  const pause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  }, []);

  const resume = useCallback(() => {
    if (audioRef.current && currentTrack) {
      audioRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  }, [currentTrack]);

  const seek = useCallback((seconds: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = seconds;
      setCurrentTime(seconds);
    }
  }, []);

  const nextTrack = useCallback(() => {
    if (queue.length === 0) return;
    let nextIdx = queueIndex + 1;
    if (isShuffled && queue.length > 1) {
      nextIdx = Math.floor(Math.random() * queue.length);
    } else if (nextIdx >= queue.length) {
      if (repeatMode === "all") {
        nextIdx = 0;
      } else {
        setIsPlaying(false);
        return;
      }
    }
    setQueueIndex(nextIdx);
    playTrack(queue[nextIdx]);
  }, [queue, queueIndex, isShuffled, repeatMode, playTrack]);

  const nextTrackRef = useRef(nextTrack);
  nextTrackRef.current = nextTrack;

  const prevTrack = useCallback(() => {
    if (!audioRef.current || queue.length === 0) return;
    // If playing for more than 3 seconds, replay track
    if (audioRef.current.currentTime > 3) {
      seek(0);
      return;
    }
    let prevIdx = queueIndex - 1;
    if (prevIdx < 0) {
      prevIdx = repeatMode === "all" ? queue.length - 1 : 0;
    }
    setQueueIndex(prevIdx);
    playTrack(queue[prevIdx]);
  }, [queue, queueIndex, repeatMode, seek, playTrack]);

  const setVolume = useCallback((vol: number) => {
    const clamped = Math.max(0, Math.min(1, vol));
    setVolumeState(clamped);
    if (audioRef.current) {
      audioRef.current.volume = clamped;
    }
    if (clamped > 0) setIsMuted(false);
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      if (audioRef.current) {
        audioRef.current.volume = next ? 0 : volume;
      }
      return next;
    });
  }, [volume]);

  const toggleRepeat = useCallback(() => {
    setRepeatMode((prev) => {
      if (prev === "off") return "all";
      if (prev === "all") return "one";
      return "off";
    });
  }, []);

  const toggleShuffle = useCallback(() => {
    setIsShuffled((prev) => !prev);
  }, []);

  const setPlaybackRate = useCallback((rate: number) => {
    setPlaybackRateState(rate);
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
  }, []);

  const toggleLyricDrawer = useCallback(() => {
    setIsLyricDrawerOpen((prev) => !prev);
  }, []);

  const toggleQueueDrawer = useCallback(() => {
    setIsQueueDrawerOpen((prev) => !prev);
  }, []);

  const addToQueue = useCallback((track: MusicTrack) => {
    setQueue((prev) => [...prev, track]);
  }, []);

  const removeFromQueue = useCallback((index: number) => {
    setQueue((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const clearQueue = useCallback(() => {
    setQueue((prev) => (currentTrack ? [currentTrack] : []));
    setQueueIndex(0);
  }, [currentTrack]);

  const closePlayer = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
    setCurrentTrack(null);
    setIsPlaying(false);
    setExpanded(false);
    setIsLyricDrawerOpen(false);
    setIsQueueDrawerOpen(false);
  }, []);

  return (
    <MusicPlayerContext.Provider
      value={{
        currentTrack,
        isPlaying,
        currentTime,
        duration,
        volume,
        isMuted,
        repeatMode,
        isShuffled,
        playbackRate,
        queue,
        queueIndex,
        isExpanded,
        isLyricDrawerOpen,
        isQueueDrawerOpen,
        activeCoverIndex,
        activeLyricIndex,
        audioRef,
        playTrack,
        togglePlay,
        pause,
        resume,
        seek,
        nextTrack,
        prevTrack,
        setVolume,
        toggleMute,
        toggleRepeat,
        toggleShuffle,
        setPlaybackRate,
        setExpanded,
        toggleLyricDrawer,
        toggleQueueDrawer,
        addToQueue,
        removeFromQueue,
        clearQueue,
        closePlayer,
      }}
    >
      {children}
    </MusicPlayerContext.Provider>
  );
}

export function useMusicPlayer() {
  const context = useContext(MusicPlayerContext);
  if (!context) {
    throw new Error("useMusicPlayer must be used within a MusicPlayerProvider");
  }
  return context;
}
