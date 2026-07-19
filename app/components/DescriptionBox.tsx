"use client";

import { useState } from "react";
import { AlignLeft } from "lucide-react";

interface DescriptionBoxProps {
  description: string;
}

const COLLAPSED_LENGTH = 200;

export default function DescriptionBox({ description }: DescriptionBoxProps) {
  const [expanded, setExpanded] = useState(false);
  const isLong = description.length > COLLAPSED_LENGTH;

  const displayText =
    expanded || !isLong
      ? description
      : description.slice(0, COLLAPSED_LENGTH) + "...";

  return (
    <div className="relative mt-4 overflow-hidden rounded-2xl border border-white/[0.08] light:border-black/[0.08] bg-gradient-to-br from-white/[0.03] to-transparent light:from-black/[0.02] p-4 pl-5 backdrop-blur-xl">
      <span className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-orange-400 to-amber-300" />

      <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">
        <AlignLeft size={13} />
        Description
      </p>
      <p className="whitespace-pre-wrap text-sm leading-6 text-slate-300 light:text-slate-600">
        {displayText}
      </p>

      {isLong && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-2 text-xs font-bold text-orange-300 light:text-orange-600 transition hover:text-orange-200"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}
