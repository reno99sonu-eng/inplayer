"use client";

import { Search, Mic } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface VideoSuggestion {
  videoId: string;
  title: string;
  thumbnailUrl: string | null;
  contentType: string;
}

const desktopPlaceholders = [
  "Search movies...",
  "Search creators...",
  "Search live streams...",
  "Search podcasts...",
  "Search music...",
];

const mobilePlaceholders = [
  "Movies...",
  "Creators...",
  "Live...",
  "Podcasts...",
  "Music...",
];

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

export default function NavbarSearch() {
  const router = useRouter();
  const [isMobile, setIsMobile] = useState(false);
  const [query, setQuery] = useState("");
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const [suggestions, setSuggestions] = useState<VideoSuggestion[]>([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  // Live suggestions as soon as 1-2 characters are typed, drawn from real
  // uploaded video/raftaar titles (see app/api/videos/suggest) — debounced
  // so it doesn't fire a request on every single keystroke.
  useEffect(() => {
    const trimmed = query.trim();
    let cancelled = false;

    // The "clear" path also goes through setTimeout (0ms) rather than
    // calling setSuggestions synchronously in the effect body — same
    // reasoning as the real debounced fetch below, and keeps every state
    // update here happening from an async callback instead of directly
    // during the effect's render-adjacent phase.
    const timer = setTimeout(async () => {
      if (cancelled) return;
      if (trimmed.length < 1) {
        setSuggestions([]);
        return;
      }
      try {
        const res = await fetch(`/api/videos/suggest?q=${encodeURIComponent(trimmed)}`);
        const data = await res.json();
        if (!cancelled) {
          setSuggestions(Array.isArray(data.suggestions) ? data.suggestions : []);
          setSuggestionsOpen(true);
        }
      } catch (err) {
        console.error("Search suggestions failed:", err);
        if (!cancelled) setSuggestions([]);
      }
    }, trimmed.length < 1 ? 0 : 200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  // Close the dropdown on an outside click, not just on blur — blur alone
  // fires before a suggestion's own click/mousedown lands, which would
  // close the list right before the click could register.
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (formRef.current && !formRef.current.contains(e.target as Node)) {
        setSuggestionsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const goToSuggestion = (s: VideoSuggestion) => {
    setSuggestionsOpen(false);
    setQuery("");
    router.push(s.contentType === "short" ? `/shorts?v=${s.videoId}` : `/watch/${s.videoId}`);
  };

  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth < 1024);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const activePlaceholders = isMobile ? mobilePlaceholders : desktopPlaceholders;
  const [placeholder, setPlaceholder] = useState(activePlaceholders[0]);

  useEffect(() => {
    let index = 0;
    const interval = setInterval(() => {
      index = (index + 1) % activePlaceholders.length;
      setPlaceholder(activePlaceholders[index]);
    }, 2600);
    return () => clearInterval(interval);
  }, [activePlaceholders]);

  const runSearch = (q: string) => {
    const term = q.trim();
    if (!term) return;
    setSuggestionsOpen(false);
    router.push(`/videos?search=${encodeURIComponent(term)}`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runSearch(query);
  };

  // Voice search via the Web Speech API. Supported in Chrome/Edge/Safari;
  // where it isn't, the mic simply focuses the field instead of erroring.
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

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="group relative flex-1 min-w-0 max-w-[640px]"
    >
      <div
        className="
          pointer-events-none absolute -inset-2 rounded-full
          bg-gradient-to-r from-orange-500/20 via-amber-400/15 to-orange-500/20
          blur-2xl opacity-50 transition-all duration-500
          group-hover:opacity-90 group-focus-within:opacity-100
        "
      />

      <Search
        size={18}
        className="
          pointer-events-none absolute left-4 top-1/2 -translate-y-1/2
          text-slate-400 light:text-slate-600 group-focus-within:text-orange-400
        "
      />

      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => { if (suggestions.length > 0) setSuggestionsOpen(true); }}
        placeholder={placeholder}
        autoComplete="off"
        className="
          relative h-11 lg:h-12 w-full min-w-0 rounded-full
          border border-white/10 light:border-black/10
          bg-white/[0.08] light:bg-black/[0.045]
          backdrop-blur-[30px]
          pl-10 pr-12
          text-sm font-medium text-white light:text-slate-900 caret-orange-400
          placeholder:text-slate-400 light:placeholder:text-slate-500
          outline-none transition-all duration-500
          shadow-[0_10px_35px_rgba(0,0,0,.22)] light:shadow-[0_10px_35px_rgba(0,0,0,.08)]
          hover:bg-white/[0.11] light:hover:bg-black/[0.07] hover:border-orange-400/40
          focus:bg-white/[0.14] light:focus:bg-black/[0.09] focus:border-orange-400
        "
      />

      {suggestionsOpen && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 max-h-[70vh] overflow-y-auto rounded-2xl border border-white/10 bg-[#0b1220] p-1.5 shadow-[0_25px_60px_rgba(0,0,0,.45)] light:border-black/10 light:bg-white">
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

      {/* Voice search */}
      <button
        type="button"
        onClick={startVoice}
        aria-label="Search by voice"
        title="Search by voice"
        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1"
      >
        <Mic
          size={16}
          className={`lg:h-[18px] lg:w-[18px] transition-colors ${
            listening
              ? "text-orange-400 animate-pulse"
              : "text-slate-300 light:text-slate-600"
          }`}
        />
      </button>
    </form>
  );
}
