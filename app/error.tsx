"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (
      error.message?.toLowerCase().includes("connection closed") ||
      error.message?.toLowerCase().includes("aborted")
    ) {
      try {
        reset();
      } catch {
        /* ignore */
      }
    }
  }, [error, reset]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <h2 className="text-xl font-bold text-white mb-2">Something went wrong</h2>
      <p className="text-sm text-slate-400 max-w-md mb-6">
        {error.message || "An unexpected error occurred while loading this page."}
      </p>
      <button
        onClick={() => {
          try {
            reset();
          } catch {
            window.location.reload();
          }
        }}
        className="rounded-full bg-gradient-to-r from-[#FF7A18] to-[#FFD54A] px-6 py-2.5 text-sm font-bold text-black hover:opacity-90 transition-opacity"
      >
        Reload
      </button>
    </div>
  );
}
