"use client";

import { Search, X, Mic } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface MobileSearchOverlayProps {
  open: boolean;
  onClose: () => void;
}

interface VideoSuggestion {
  videoId: string;
  title: string;
  thumbnailUrl: string | null;
  contentType: string;
}

// Minimal shape of the Web Speech API's SpeechRecognition — not part of
// TypeScript's DOM lib (it's still vendor-prefixed/experimental), so we
// declare just the bits this component actually uses instead of reaching
// for `any`.
interface SpeechRecognitionResultLike {
  transcript: string;
}

interface SpeechRecognitionEventLike {
  results?: SpeechRecognitionResultLike[][];
}

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  start: () => void;
  stop: () => void;
}

interface WindowWithSpeechRecognition extends Window {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
}

const placeholders = [
  "Search Movies...",
  "Search TV Shows...",
  "Search Music...",
  "Search Podcasts...",
  "Search Live...",
  "Search Shorts...",
  "Search Creators...",
];

export default function MobileSearchOverlay({
  open,
  onClose,
}: MobileSearchOverlayProps) {
  const router = useRouter();
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [query, setQuery] = useState("");
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const [suggestions, setSuggestions] = useState<VideoSuggestion[]>([]);

  useEffect(() => {
    if (!open) return;
    const interval = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % placeholders.length);
    }, 2200);
    return () => clearInterval(interval);
  }, [open]);

  // Live suggestions as soon as 1-2 characters are typed, drawn from real
  // uploaded video/raftaar titles (see app/api/videos/suggest).
  useEffect(() => {
    if (!open) return;
    const trimmed = query.trim();
    let cancelled = false;

    // The "clear" path also goes through setTimeout (0ms) rather than
    // calling setSuggestions synchronously in the effect body — keeps
    // every state update here happening from an async callback.
    const timer = setTimeout(async () => {
      if (cancelled) return;
      if (trimmed.length < 1) {
        setSuggestions([]);
        return;
      }
      try {
        const res = await fetch(`/api/videos/suggest?q=${encodeURIComponent(trimmed)}`);
        const data = await res.json();
        if (!cancelled) setSuggestions(Array.isArray(data.suggestions) ? data.suggestions : []);
      } catch (err) {
        console.error("Search suggestions failed:", err);
        if (!cancelled) setSuggestions([]);
      }
    }, trimmed.length < 1 ? 0 : 200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, open]);

  const runSearch = (q: string) => {
    const term = q.trim();
    if (!term) return;
    onClose();
    router.push(`/videos?search=${encodeURIComponent(term)}`);
  };

  const goToSuggestion = (s: VideoSuggestion) => {
    onClose();
    router.push(s.contentType === "short" ? `/shorts?v=${s.videoId}` : `/watch/${s.videoId}`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runSearch(query);
  };

  const startVoice = () => {
    const win = window as WindowWithSpeechRecognition;
    const SpeechRecognition =
      win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRecognition) return;

    if (listening && recognitionRef.current) {
      recognitionRef.current.stop();
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;

    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      const transcript = event.results?.[0]?.[0]?.transcript || "";
      if (transcript) {
        setQuery(transcript);
        runSearch(transcript);
      }
    };

    recognition.start();
  };

  if (!open) return null;

  return (
    <>
      {/* Blur Background */}
      <div
        className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-xl"
        onClick={onClose}
      />

      {/* Search Panel */}
      <div className="fixed inset-x-0 top-0 z-[130] border-b border-white/10 light:border-black/10 bg-[#07101F]/95 light:bg-[#F5EEDC]/95 p-4 backdrop-blur-3xl">
        <form onSubmit={handleSubmit} className="flex items-center gap-3">
          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close search"
            className="
              flex h-12 w-12 items-center justify-center rounded-2xl
              border border-white/10 light:border-black/10
              bg-white/5 light:bg-black/5
              text-white light:text-slate-900
              transition-all duration-300
              hover:bg-white/10 light:hover:bg-black/10
            "
          >
            <X size={24} />
          </button>

          {/* Premium Search */}
          <div className="relative flex-1">
            <Search
              size={22}
              className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 light:text-slate-600"
            />

            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholders[placeholderIndex]}
              className="
                h-14 w-full rounded-full
                border border-white/10 light:border-black/10
                bg-white/5 light:bg-black/[0.04]
                backdrop-blur-xl
                pl-14 pr-14
                text-[17px] font-medium text-white light:text-slate-900 caret-orange-400
                outline-none
                placeholder:text-slate-400 light:placeholder:text-slate-500
                shadow-[0_10px_35px_rgba(0,0,0,.35)] light:shadow-[0_10px_35px_rgba(0,0,0,.08)]
                transition-all duration-300
                focus:border-orange-400/40 focus:bg-white/[0.07] light:focus:bg-black/[0.06]
              "
            />

            {/* Voice */}
            <button
              type="button"
              onClick={startVoice}
              aria-label="Search by voice"
              className={`absolute right-5 top-1/2 -translate-y-1/2 transition-all duration-300 hover:scale-110 ${
                listening
                  ? "text-orange-400 animate-pulse"
                  : "text-white light:text-slate-700"
              }`}
            >
              <Mic size={19} />
            </button>
          </div>
        </form>

        {suggestions.length > 0 && (
          <div className="mt-3 max-h-[50vh] overflow-y-auto rounded-2xl border border-white/10 bg-white/[0.03] p-1.5 light:border-black/10 light:bg-black/[0.02]">
            {suggestions.map((s) => (
              <button
                key={s.videoId}
                type="button"
                onClick={() => goToSuggestion(s)}
                className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition hover:bg-white/[0.06] light:hover:bg-black/[0.04]"
              >
                <div className="relative h-10 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-white/5 light:bg-black/5">
                  {s.thumbnailUrl && (
                    <Image src={s.thumbnailUrl} alt="" fill unoptimized sizes="64px" className="object-cover" />
                  )}
                </div>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-white light:text-slate-900">
                  {s.title}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
