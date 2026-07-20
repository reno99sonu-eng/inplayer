"use client";

interface SettingsToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

// Deliberately monochrome (white/charcoal, no orange gradient) — a clean,
// premium switch rather than a loud brand-colored one. Keeps the small
// amount of brand color in this page reserved for genuine "selected"
// indicators elsewhere (see SettingsRow / SettingsSidebar).
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
        ease-out
        ${
          checked
            ? "bg-white shadow-[0_0_16px_rgba(255,255,255,.22)]"
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
          shadow-md
          transition-all
          duration-300
          ease-out
          ${
            checked
              ? "translate-x-6 bg-[#06101D]"
              : "translate-x-1 bg-white"
          }
        `}
      />
    </button>
  );
}
