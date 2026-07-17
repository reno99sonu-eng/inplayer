"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, Rss } from "lucide-react";

export default function SubscriptionsPage() {
  const router = useRouter();

  // Placeholder: subscribed-creators backend not wired up yet
  const creators: { id: string; name: string }[] = [];

  return (
    <div className="min-h-screen bg-[#06101D] text-white">
      <div className="flex items-center gap-4 border-b border-white/10 px-5 py-5">
        <button
          onClick={() => router.back()}
          className="
            flex
            h-10
            w-10
            items-center
            justify-center
            rounded-full
            border
            border-white/10
            bg-white/5
            transition-all
            duration-200
            hover:bg-white/15
          "
        >
          <ArrowLeft size={20} />
        </button>

        <h1 className="text-lg font-black">Subscriptions</h1>
      </div>

      <div className="mx-auto max-w-2xl px-5 py-8">
        {creators.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-white/10 bg-white/[0.03] px-6 py-16 text-center">
            <Rss size={40} className="mb-4 text-orange-400/60" />
            <h2 className="text-lg font-bold text-white">
              You haven&apos;t subscribed to anyone yet
            </h2>
            <p className="mt-2 max-w-xs text-sm text-slate-400">
              Subscribe to creators to see their latest uploads here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {creators.map((c) => (
              <div
                key={c.id}
                className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4"
              >
                {c.name}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
