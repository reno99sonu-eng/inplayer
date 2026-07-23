"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft } from "lucide-react";

interface AIStudioModalProps {
  open: boolean;
  onClose: () => void;
}

const examplePrompts = [
  "Create a cinematic travel documentary...",
  "Generate a YouTube gaming thumbnail...",
  "Write a podcast introduction...",
  "Translate this video into 12 languages...",
  "Create a luxury movie trailer...",
];

const quickToolPrompts: Record<string, string> = {
  Scripts:
    "Write a 60-second video script introducing a new streaming original series.",
  Thumbnails:
    "Describe a bold, high-contrast YouTube thumbnail concept for a travel vlog episode.",
  Voice:
    "Write a warm, energetic voiceover script for a 30-second app trailer.",
  Translate:
    "Translate the following into Hindi, Spanish, and French: 'Unlimited streaming. Watch anytime, anywhere.'",
};

export default function AIStudioModal({
  open,
  onClose,
}: AIStudioModalProps) {
  const [placeholderText, setPlaceholderText] = useState("");
  const [promptIndex, setPromptIndex] = useState(0);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Which view is showing inside the popover. Switches to "result" once a
  // generation succeeds; the back button (result view only) returns to
  // "prompt" without touching the typed prompt. Only the ✕ close button
  // does a full reset (see the effect below).
  const [view, setView] = useState<"prompt" | "result">("prompt");

  // Animated example-prompt placeholder — only visible while the box is empty
  useEffect(() => {
    if (!open) return;

    let i = 0;
    const text = examplePrompts[promptIndex];

    const typing = setInterval(() => {
      i++;
      setPlaceholderText(text.slice(0, i));

      if (i >= text.length) {
        clearInterval(typing);

        setTimeout(() => {
          setPlaceholderText("");
          setPromptIndex((prev) => (prev + 1) % examplePrompts.length);
        }, 1800);
      }
    }, 35);

    return () => clearInterval(typing);
  }, [promptIndex, open]);

  // Reset everything when the popup closes, so it's fresh next time it opens
  useEffect(() => {
    if (!open) {
      setPrompt("");
      setResult(null);
      setError(null);
      setLoading(false);
      setView("prompt");
    }
  }, [open]);

  const handleGenerate = async () => {
    if (!prompt.trim() || loading) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/ai-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Something went wrong. Please try again.");
      } else {
        setResult(data.text);
        setView("result");
      }
    } catch {
      setError(
        "Couldn't reach the AI service. Check your connection and try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleQuickTool = (tool: string) => {
    setPrompt(quickToolPrompts[tool] || "");
    setResult(null);
    setError(null);
  };

  // Back returns to the prompt view only — it deliberately leaves
  // `prompt` (and `result`/`error`) untouched so the user can tweak their
  // prompt and regenerate. Only the ✕ close button performs a full reset.
  const handleBack = () => {
    setView("prompt");
  };

  if (!open) return null;
  if (typeof document === "undefined") return null;

  // Rendered through a PORTAL onto <body>, never inline where the opener
  // sits. This matters: the navbar wraps its buttons in `scale-[0.9]`
  // wrappers and the header/bottom-nav use backdrop-blur — both of which
  // turn an ancestor into the containing block for `position: fixed`
  // descendants. Rendered inline there, this "fullscreen" overlay was
  // being sized/positioned against a tiny scaled navbar box instead of
  // the viewport: the panel ended up invisible, the overlay blurred just
  // the Create button, and the page underneath looked frozen because an
  // invisible click-catcher was floating in the wrong place. On body,
  // fixed means the real viewport, always.
  return createPortal(
    <div
      onClick={onClose}
      className="fixed inset-0 z-[9999] bg-black/10 backdrop-blur-[2px]"
    >
      <div
  onClick={(e) => e.stopPropagation()}
  className="
  absolute
  right-3
  bottom-20

  w-[300px]
  md:w-[330px]
  lg:right-6
  lg:bottom-24
  lg:w-[380px]

  max-h-[80vh]
  overflow-y-auto
  [scrollbar-width:none]
  [&::-webkit-scrollbar]:hidden

  rounded-[22px]
  lg:rounded-[30px]

  border
  border-orange-400/15
  bg-gradient-to-br
  from-[#07111F]/95
  via-[#0B1728]/95
  to-[#040A14]/95
  light:from-white/95
  light:via-slate-50/95
  light:to-white/95

  p-3
  lg:p-4

  backdrop-blur-3xl
  shadow-[0_25px_90px_rgba(0,0,0,.55)]
  light:shadow-[0_25px_90px_rgba(0,0,0,.18)]
  animate-aiPopup
"
>
<div className="pointer-events-none absolute inset-0">

  <div
    className="
      absolute
      -left-24
      -top-20
      h-56
      w-56
      rounded-full
      bg-orange-500/10
      blur-[90px]
    "
  />

  <div
    className="
      absolute
      -right-20
      bottom-0
      h-48
      w-48
      rounded-full
      bg-cyan-500/10
      blur-[90px]
    "
  />

  <div
    className="
      absolute
      inset-0
      bg-[linear-gradient(to_bottom,rgba(255,255,255,.05),transparent)]
      light:bg-[linear-gradient(to_bottom,rgba(0,0,0,.02),transparent)]
    "
  />

</div>
        <button
  type="button"
  onClick={(e) => {
    e.stopPropagation();
    onClose();
  }}
  className="
    absolute
    right-4
    top-4
    z-50
    flex
    h-10
    w-10
    items-center
    justify-center
    rounded-full
    border
    border-white/10
    light:border-black/10
    bg-[#131C2D]
    light:bg-slate-200
    text-slate-300
    light:text-slate-700
    transition-all
    duration-300
    hover:rotate-90
    hover:border-orange-400/40
    hover:bg-orange-500/10
    hover:text-white
    light:hover:text-slate-900
  "
>
  ✕
</button>

        <div className="relative z-10">
          {view === "prompt" ? (
            <>

  <div className="flex items-center">

  <span className="rounded-full border border-orange-400/60 light:border-orange-400 bg-gradient-to-r from-orange-500/15 to-amber-400/10 light:from-orange-100 light:to-amber-100 px-3 py-1 text-[9px] font-bold uppercase tracking-[0.4em] text-orange-200 light:text-orange-600 shadow-[0_0_20px_rgba(251,146,60,.15)]">
    INPLAYER AI
  </span>

</div>
<h2 className="mt-3 text-[22px] md:text-[24px] lg:text-[28px] font-black leading-none tracking-tight text-white light:text-slate-900">

    Create
    <br />
    Smarter.

  </h2>

  <p className="mt-2 text-[11px] lg:text-[12px] leading-5 lg:leading-6 text-slate-400 light:text-slate-700">

    Generate premium scripts, thumbnails,
    voiceovers and translations instantly.

  </p>
  <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-emerald-500/40 light:border-emerald-500/50 bg-emerald-500/10 light:bg-emerald-100 px-3 py-1">

  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />

  <span className="text-[10px] font-medium uppercase tracking-[0.25em] text-emerald-300 light:text-emerald-700">
    AI ONLINE
  </span>

</div>

<div className="mt-3 rounded-[22px] border border-white/10 light:border-slate-300 bg-white/[0.045] light:bg-black/[0.03] p-3 backdrop-blur-xl">

  <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.35em] text-slate-500 light:text-slate-700">

    AI PROMPT

  </p>

  <div className="rounded-2xl border border-white/10 light:border-slate-300 bg-[#07111F] light:bg-white p-3 shadow-inner">

    <textarea
      rows={3}
      value={prompt}
      onChange={(e) => setPrompt(e.target.value)}
      placeholder={placeholderText}
      className="
        w-full
        resize-none
        bg-transparent
        text-[12px] lg:text-[14px]
        leading-6
        text-white
        light:text-slate-900
        caret-orange-400
        outline-none
        placeholder:text-slate-500 light:placeholder:text-slate-600
      "
    />

  </div>

  <button
    onClick={handleGenerate}
    disabled={loading || !prompt.trim()}
    className="
      mt-4
      w-full
      rounded-2xl
      bg-gradient-to-r
      from-[#FF7A18]
      via-[#FF9A00]
      to-[#FFD54A]
      py-2
lg:py-2.5
text-xs
lg:text-sm
      font-bold
      tracking-wide
      text-white
      shadow-[0_15px_35px_rgba(255,153,0,.35)]
      transition-all
      duration-300
      hover:-translate-y-0.5
      hover:shadow-[0_20px_50px_rgba(255,153,0,.45)]
      disabled:cursor-not-allowed
      disabled:opacity-50
      disabled:hover:translate-y-0
    "
>
      {loading ? "Generating..." : "Generate Content"}
    </button>

    {error && (
      <p className="mt-3 rounded-xl border border-red-500/20 bg-red-500/10 p-2.5 text-[11px] text-red-300">
        {error}
      </p>
    )}

</div>
        <div className="mt-3">

          <p className="mb-3 text-[10px] uppercase tracking-[0.3em] text-slate-500 light:text-slate-700">
            Quick Tools
          </p>

          <div className="grid grid-cols-2 gap-1.5 lg:gap-2">

            {Object.keys(quickToolPrompts).map((tool) => (
              <button
                key={tool}
                onClick={() => handleQuickTool(tool)}
                className="
  rounded-lg
  lg:rounded-xl
  border
  border-white/5
  light:border-slate-300
  bg-white/[0.04]
  light:bg-white
  py-1.5
  lg:py-2
  text-[11px]
  lg:text-xs
  font-medium
  text-slate-300
  light:text-slate-800
  transition
  hover:border-orange-400/40
  hover:bg-orange-500/10
  hover:text-white
  light:hover:text-slate-900
"
              >
                {tool}
              </button>
            ))}

          </div>

        </div>

            </>
          ) : (
            <>

  <div className="flex items-center gap-3">

    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        handleBack();
      }}
      aria-label="Back to prompt"
      className="
        flex
        h-10
        w-10
        shrink-0
        items-center
        justify-center
        rounded-full
        border
        border-white/10
        light:border-black/10
        bg-white/5
        light:bg-black/5
        text-slate-300
        light:text-slate-700
        transition-all
        duration-300
        hover:border-orange-400/40
        hover:bg-orange-500/10
        hover:text-white
        light:hover:text-slate-900
      "
    >
      <ArrowLeft size={18} />
    </button>

    <span className="rounded-full border border-orange-400/60 light:border-orange-400 bg-gradient-to-r from-orange-500/15 to-amber-400/10 light:from-orange-100 light:to-amber-100 px-3 py-1 text-[9px] font-bold uppercase tracking-[0.4em] text-orange-200 light:text-orange-600 shadow-[0_0_20px_rgba(251,146,60,.15)]">
      INPLAYER AI
    </span>

  </div>

  <h2 className="mt-3 text-[20px] lg:text-[22px] font-black leading-none tracking-tight text-white light:text-slate-900">
    Your Result
  </h2>

  <p className="mt-2 text-[11px] lg:text-[12px] leading-5 lg:leading-6 text-slate-400 light:text-slate-700">
    Here&apos;s what InPlayer AI generated from your prompt.
  </p>

  {result && (
    <div className="mt-3 rounded-[22px] border border-white/10 light:border-slate-300 bg-white/[0.045] light:bg-black/[0.03] p-3 backdrop-blur-xl">

      <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.35em] text-slate-500 light:text-slate-700">
        AI RESULT
      </p>

      <div
        className="
          max-h-[320px]
          overflow-y-auto
          rounded-2xl
          border
          border-white/10
          light:border-black/10
          bg-[#07111F]
          light:bg-white
          p-3
          text-[12px]
          leading-6
          text-slate-200
          light:text-slate-800
          [scrollbar-width:none]
          [&::-webkit-scrollbar]:hidden
        "
      >
        <p className="whitespace-pre-wrap">{result}</p>
      </div>

    </div>
  )}

            </>
          )}
      </div>
    </div>
    </div>,
    document.body
  );
}
