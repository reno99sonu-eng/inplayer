"use client";

interface SettingsSectionTitleProps {
  title: string;
  subtitle?: string;
}

export default function SettingsSectionTitle({
  title,
  subtitle,
}: SettingsSectionTitleProps) {
  return (
    <div className="pt-4 first:pt-0">
      <div className="flex items-center gap-3">
        <div className="h-px w-8 bg-gradient-to-r from-white/25 to-transparent" />

        <h3
          className="
            text-[11px]
            font-black
            uppercase
            tracking-[0.28em]
            text-slate-300
          "
        >
          {title}
        </h3>
      </div>

      {subtitle && (
        <p className="mt-2 ml-[52px] text-sm leading-6 text-slate-500">
          {subtitle}
        </p>
      )}
    </div>
  );
}
