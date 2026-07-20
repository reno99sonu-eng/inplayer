"use client";

import { ChevronDown } from "lucide-react";

interface SettingsSelectProps {
  value: string;
  options: string[];
  onChange: (value: string) => void;
}

export default function SettingsSelect({
  value,
  options,
  onChange,
}: SettingsSelectProps) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="
          appearance-none
          rounded-xl
          border
          border-white/10
          bg-white/[0.04]
          py-2
          pl-4
          pr-10
          text-sm
          font-medium
          text-white
          outline-none
          transition-all
          duration-300
          ease-out
          hover:border-white/25
          focus:border-white/40
          focus:bg-white/[0.06]
          cursor-pointer
        "
      >
        {options.map((option) => (
          <option
            key={option}
            value={option}
            className="bg-[#0B1322] text-white"
          >
            {option}
          </option>
        ))}
      </select>

      <ChevronDown
        size={16}
        className="
          pointer-events-none
          absolute
          right-3
          top-1/2
          -translate-y-1/2
          text-slate-400
        "
      />
    </div>
  );
}
