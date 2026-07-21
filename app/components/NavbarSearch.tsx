"use client";

import { Search, Mic } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

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

export default function NavbarSearch() {
  const router = useRouter();
  const [isMobile, setIsMobile] = useState(false);
  const [query, setQuery] = useState("");
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);

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
    router.push(`/videos?search=${encodeURIComponent(term)}`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runSearch(query);
  };

  // Voice search via the Web Speech API. Supported in Chrome/Edge/Safari;
  // where it isn't, the mic simply focuses the field instead of erroring.
  const startVoice = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

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
    recognition.onresult = (event: any) => {
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
      onSubmit={handleSubmit}
      className="group relative flex-1 min-w-0 max-w-[500px]"
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
        placeholder={placeholder}
        className="
          relative h-12 lg:h-14 w-full min-w-0 rounded-full
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
