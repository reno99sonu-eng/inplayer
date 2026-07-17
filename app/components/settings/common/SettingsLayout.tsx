"use client";

import { ReactNode } from "react";

interface SettingsLayoutProps {
  sidebar: ReactNode;
  children: ReactNode;
}

export default function SettingsLayout({
  sidebar,
  children,
}: SettingsLayoutProps) {
  return (
    <div
      className="
        mx-auto
        max-w-[1700px]
        px-5
        py-8
        lg:px-8
      "
    >
      {/* Mobile Layout */}
      <div className="space-y-6 lg:hidden">
        {children}
      </div>

      {/* Desktop Layout */}
      <div className="hidden lg:flex lg:items-start lg:gap-8">
        {sidebar}

        <main className="min-w-0 flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}