"use client";

import { useState } from "react";

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
}

// Self-built, curated picker — deliberately not a third-party npm package.
// This project pins React 19; most popular emoji-picker libraries lag on
// React 19 peer-dep support, and pulling in an unvetted dependency for
// this is a real risk against "no errors" for very little upside over a
// hand-picked set of the emojis people actually send in chat. Every
// character below is a real, standard Unicode emoji — rendered natively
// by the browser/OS, not an image or a stand-in.
const CATEGORIES: { label: string; emojis: string[] }[] = [
  {
    label: "Smileys",
    emojis: [
      "😀", "😁", "😂", "🤣", "😊", "😍", "🥰", "😘",
      "😜", "🤪", "🤔", "🙂", "😉", "😎", "🥳", "🤩",
      "😇", "🙃", "😴", "🤗", "🥺", "😢", "😭", "😡",
      "😱", "😳", "🙄", "😅", "😏", "🤤", "🤭", "🫡",
    ],
  },
  {
    label: "Gestures",
    emojis: [
      "👍", "👎", "👏", "🙏", "💪", "🤝", "✌️", "🤞",
      "👌", "🤟", "🙌", "👋", "🤙", "👊", "✋", "🫶",
    ],
  },
  {
    label: "Hearts",
    emojis: [
      "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍",
      "💔", "💕", "💖", "💗", "💘", "💝", "😻", "🥹",
    ],
  },
  {
    label: "Fun",
    emojis: [
      "🎉", "🔥", "💯", "✨", "🎂", "🎁", "⭐", "🌟",
      "🎶", "🏆", "⚡", "🌈", "☀️", "🌙", "🍕", "☕",
    ],
  },
];

export default function EmojiPicker({ onSelect }: EmojiPickerProps) {
  const [activeCategory, setActiveCategory] = useState(0);

  return (
    <div className="w-72 overflow-hidden rounded-2xl border border-white/10 light:border-black/10 bg-[#0B1524] light:bg-white shadow-[0_20px_50px_rgba(0,0,0,.4)]">
      <div className="flex border-b border-white/10 light:border-black/10">
        {CATEGORIES.map((cat, idx) => (
          <button
            key={cat.label}
            type="button"
            onClick={() => setActiveCategory(idx)}
            className={`flex-1 py-2 text-[11px] font-bold transition ${
              activeCategory === idx
                ? "border-b-2 border-orange-400 text-orange-400"
                : "text-slate-400 light:text-slate-600 hover:text-slate-200 light:hover:text-slate-800"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      <div className="grid max-h-56 grid-cols-8 gap-0.5 overflow-y-auto p-2">
        {CATEGORIES[activeCategory].emojis.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => onSelect(emoji)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-lg transition hover:bg-white/10 light:hover:bg-black/5"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
