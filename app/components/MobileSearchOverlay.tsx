"use client";

import { Search, X, Mic } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface MobileSearchOverlayProps {
  open: boolean;
  onClose: () => void;
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
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (!open) return;
    const interval = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % placeholders.length);
    }, 2200);
    return () => clearInterval(interval);
  }, [open]);

  const runSearch = (q: string) => {
    const term = q.trim();
    if (!term) return;
    onClose();
    router.push(`/videos?search=${encodeURIComponent(term)}`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runSearch(query);
  };

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
      </div>
    </>
  );
}
