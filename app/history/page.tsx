"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import ContinueWatching from "../components/ContinueWatching";

export default function HistoryPage() {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-[#06101D] text-white">
      {/* Header */}
      <div className="sticky top-0 z-20 border-b border-white/10 bg-[#06101D]/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1800px] items-center gap-4 px-4 py-5 lg:px-8">
          <button
            onClick={() => router.push("/")}
            className="
              flex
              h-11
              w-11
              items-center
              justify-center
              rounded-full
              border
              border-white/10
              bg-white/5
              transition
              hover:bg-white/10
            "
            aria-label="Back to Home"
          >
            <ArrowLeft size={22} />
          </button>

          <div>
            <h1 className="text-3xl font-bold">History</h1>

            <p className="mt-1 text-sm text-slate-400">
              Continue watching your recently viewed content.
            </p>
          </div>
        </div>
      </div>

      {/* Continue Watching */}
      <div className="pb-16">
        <ContinueWatching />
      </div>
    </main>
  );
}