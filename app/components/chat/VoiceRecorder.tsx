"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Trash2, Send, Loader2, Square } from "lucide-react";

interface VoiceRecorderProps {
  onSend: (audioDataUrl: string, durationSec: number) => void;
  onCancel: () => void;
}

// Hard cap on recording length — also keeps a note's base64 size well
// under DynamoDB's 400KB item cap, combined with the bitrate cap on the
// MediaRecorder itself below (see startRecording).
const MAX_DURATION_SEC = 90;

export default function VoiceRecorder({ onSend, onCancel }: VoiceRecorderProps) {
  const [recording, setRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  // Always-current mirror of `duration` state, safe to read from inside
  // callbacks (the timer interval, handleStopAndSend) whose closure was
  // captured once at mount and would otherwise see a stale value.
  const durationRef = useRef(0);

  // Declared before the effect below (not after, as this used to be) — the
  // React Compiler's linter flags a function referenced inside an effect
  // before its own `const` declaration runs, even though the effect itself
  // only actually fires after the whole component body (and both of these
  // consts) has run once. No behavior change, just a reorder.
  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  // Also declared before startRecording (which schedules a timer that can
  // call this directly on auto-stop) for the same source-order reason as
  // stopTimer above.
  const handleStopAndSend = () => {
    const mediaRecorder = mediaRecorderRef.current;
    if (!mediaRecorder) return;

    setProcessing(true);
    stopTimer();

    mediaRecorder.onstop = () => {
      const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64Data = reader.result as string;
        // Reads the ref, not the `duration` state — this can fire from
        // inside the timer interval below (auto-stop at MAX_DURATION_SEC),
        // whose closure was created once at mount and would otherwise
        // always see duration as it was back then (0).
        onSend(base64Data, durationRef.current);
        // Stop stream tracks
        mediaRecorder.stream.getTracks().forEach((track) => track.stop());
      };
      reader.readAsDataURL(audioBlob);
    };

    if (mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
    }
  };

  const startRecording = async () => {
    setMicError(null);
    setDuration(0);
    durationRef.current = 0;
    audioChunksRef.current = [];

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setMicError("Microphone recording is not supported in this browser.");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Low, speech-tuned bitrate — keeps even a full MAX_DURATION_SEC note
      // comfortably under DynamoDB's 400KB item cap once base64-encoded
      // (base64 adds ~33% overhead on top of the raw encoded size).
      const mediaRecorder = new MediaRecorder(stream, { audioBitsPerSecond: 16000 });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(100);
      setRecording(true);

      timerRef.current = setInterval(() => {
        durationRef.current += 1;
        setDuration(durationRef.current);
        if (durationRef.current >= MAX_DURATION_SEC) {
          handleStopAndSend();
        }
      }, 1000);
    } catch (err) {
      console.error("Failed to access microphone:", err);
      setMicError("Microphone access denied. Please enable mic permissions.");
    }
  };

  useEffect(() => {
    // startRecording() sets state (setMicError/setDuration/setRecording)
    // synchronously on its first few lines before its first await — the
    // same "no setState directly in an effect body" rule this codebase's
    // other effects already satisfy via this same IIFE-wrapper pattern
    // (see MaintenanceGate.tsx). No behavior change, still fires once on
    // mount, same fire-and-forget call.
    (async () => {
      await startRecording();
    })();
    return () => {
      stopTimer();
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCancel = () => {
    stopTimer();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
    }
    onCancel();
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  if (micError) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-full border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs text-red-300">
        <span>{micError}</span>
        <button
          onClick={onCancel}
          className="rounded-full bg-white/10 p-1 hover:bg-white/20"
        >
          <Trash2 size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 items-center gap-3 rounded-full border border-red-500/40 bg-red-500/10 px-4 py-2 shadow-inner transition-all animate-pulseOnce">
      {/* Pulse Recording Dot */}
      <div className="flex items-center gap-2">
        <span className="relative flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
        </span>
        <span className="font-mono text-xs font-bold text-red-400">
          {formatTimer(duration)}
        </span>
      </div>

      {/* Live Animated Waveform Bar Graphic */}
      <div className="flex flex-1 items-center justify-center gap-1 overflow-hidden px-2">
        {[40, 70, 30, 90, 50, 80, 40, 100, 60, 30, 85, 45, 75, 35].map((height, i) => (
          <span
            key={i}
            className="w-1 rounded-full bg-red-400/70 animate-bounce"
            style={{
              height: `${Math.max(10, (height * (duration % 2 ? 1 : 0.6)))}%`,
              animationDelay: `${(i % 5) * 0.1}s`,
            }}
          />
        ))}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleCancel}
          title="Cancel Recording"
          className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-300 hover:bg-red-500/20 hover:text-red-400 transition"
        >
          <Trash2 size={16} />
        </button>

        <button
          onClick={handleStopAndSend}
          disabled={processing || duration < 1}
          title="Send Voice Note"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-lg transition hover:scale-105 disabled:opacity-50"
        >
          {processing ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Send size={16} />
          )}
        </button>
      </div>
    </div>
  );
}
