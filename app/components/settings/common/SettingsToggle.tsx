"use client";

interface SettingsToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export default function SettingsToggle({
  checked,
  onChange,
  disabled = false,
}: SettingsToggleProps) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      disabled={disabled}
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
        disabled:cursor-not-allowed
        disabled:opacity-50
        ${
          checked
            ? "bg-gradient-to-r from-orange-500 to-amber-400 shadow-[0_0_20px_rgba(249,115,22,.35)]"
            : "bg-white/10 light:bg-black/10"
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