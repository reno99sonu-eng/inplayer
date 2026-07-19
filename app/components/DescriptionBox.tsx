"use client";

import { useState } from "react";

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
    <div className="mt-4 rounded-2xl border border-white/10 light:border-black/10 bg-white/[0.02] light:bg-black/[0.02] p-4">
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
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
