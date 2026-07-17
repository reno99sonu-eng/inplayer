"use client";

interface SettingsToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export default function SettingsToggle({
  checked,
  onChange,
}: SettingsToggleProps) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      onClick={() => onChange(!checked)}
      className={`
        relative
        flex
        h-7
        w-12
        items-center
        rounded-full
        transition-all
        duration-300
        ${
          checked
            ? "bg-gradient-to-r from-orange-500 to-amber-400 shadow-[0_0_20px_rgba(249,115,22,.35)]"
            : "bg-white/10"
        }
      `}
    >
      <span
        className={`
          absolute
          h-5
          w-5
          rounded-full
          bg-white
          shadow-md
          transition-all
          duration-300
          ${
            checked
              ? "translate-x-6"
              : "translate-x-1"
          }
        `}
      />
    </button>
  );
}