"use client";

import { ReactNode } from "react";

type SectionHeadingProps = {
  badge?: string;
  title: ReactNode;
  subtitle?: string;
  align?: "left" | "center";
};

export default function SectionHeading({
  badge,
  title,
  subtitle,
  align = "center",
}: SectionHeadingProps) {
  return (
    <div className={align === "center" ? "text-center" : "text-left"}>

      {badge && (
        <div className="mb-4 inline-flex rounded-full border border-orange-200 bg-orange-50 px-4 py-2 text-xs font-bold uppercase tracking-[0.25em] text-orange-600">
          {badge}
        </div>
      )}

      <h2 className="text-4xl font-black tracking-[-0.04em] text-slate-900 md:text-5xl">
        {title}
      </h2>

      {subtitle && (
        <p className="mx-auto mt-5 max-w-3xl text-lg leading-8 text-slate-600">
          {subtitle}
        </p>
      )}

    </div>
  );
}