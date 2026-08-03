"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Pause, Mic } from "lucide-react";

interface VoiceMessageBubbleProps {
  audioUrl: string;
  mine?: boolean;
}

export default function VoiceMessageBubble({ audioUrl, mine }: VoiceMessageBubbleProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio(audioUrl);
    audioRef.current = audio;

    audio.onloadedmetadata = () => {
      setDuration(audio.duration || 0);
    };

    audio.ontimeupdate = () => {
      if (audio.duration) {
        setProgress((audio.currentTime / audio.duration) * 100);
      }
    };

    audio.onended = () => {
      setIsPlaying(false);
      setProgress(0);
    };

    return () => {
      audio.pause();
      audioRef.current = null;
    };
  }, [audioUrl]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch((err) => console.error("Audio play failed:", err));
      setIsPlaying(true);
    }
  };

  const formatSecs = (seconds: number) => {
    if (isNaN(seconds) || seconds <= 0) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  return (
    <div className="flex items-center gap-3 py-1 min-w-[200px] max-w-[260px]">
      {/* Play/Pause Button */}
      <button
        onClick={togglePlay}
        className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full shadow-md transition ${
          mine
            ? "bg-white/20 hover:bg-white/30 text-white"
            : "bg-orange-500 hover:bg-orange-600 text-white"
        }`}
      >
        {isPlaying ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
      </button>

      {/* Waveform Bar & Progress */}
      <div className="flex-1 space-y-1">
        <div className="flex items-center gap-1">
          <Mic size={12} className={mine ? "text-white/80" : "text-orange-400"} />
          <div className="relative h-2.5 flex-1 rounded-full bg-black/20 overflow-hidden">
            <div
              className={`absolute top-0 bottom-0 left-0 transition-all duration-100 ${
                mine ? "bg-white" : "bg-gradient-to-r from-orange-400 to-amber-300"
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Timer stamp */}
        <div className="flex justify-between text-[10px] opacity-80 font-mono">
          <span>{isPlaying ? formatSecs(audioRef.current?.currentTime || 0) : formatSecs(duration)}</span>
          <span>Voice Note</span>
        </div>
      </div>
    </div>
  );
}
