"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Heart,
  Play,
  Download,
  Trash2,
} from "lucide-react";

export default function WatchlistPage() {
  const router = useRouter();

  // Temporary local data
  const items = [
    {
      id: "1",
      title: "Beyond Limits",
      creator: "InPlayer Originals",
      duration: "2h 18m",
      thumbnail: "/posters/poster1.jpg",
    },
    {
      id: "2",
      title: "Planet Earth",
      creator: "Nature Vision",
      duration: "1h 42m",
      thumbnail: "/posters/poster2.jpg",
    },
    {
      id: "3",
      title: "Next-Level Gaming",
      creator: "GameVerse",
      duration: "58 min",
      thumbnail: "/posters/poster3.jpg",
    },
  ];

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
            transition
            hover:bg-white/15
          "
        >
          <ArrowLeft size={20} />
        </button>

        <div>
          <h1 className="text-lg font-black">Watchlist</h1>
          <p className="text-sm text-slate-400">
            {items.length} saved items
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-5 py-8">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-white/10 bg-white/[0.03] px-6 py-16 text-center">
            <Heart size={40} className="mb-4 text-orange-400/60" />

            <h2 className="text-lg font-bold">
              Your watchlist is empty
            </h2>

            <p className="mt-2 max-w-xs text-sm text-slate-400">
              Save movies, videos and series to watch later.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((item) => (
              <div
                key={item.id}
                className="
                  flex
                  items-center
                  gap-4
                  rounded-3xl
                  border
                  border-white/10
                  bg-white/[0.03]
                  p-4
                "
              >
                <Image
                  src={item.thumbnail}
                  alt={item.title}
                  width={170}
                  height={96}
                  className="rounded-2xl object-cover"
                />

                <div className="flex-1">
                  <h2 className="font-bold">
                    {item.title}
                  </h2>

                  <p className="mt-1 text-sm text-slate-400">
                    {item.creator}
                  </p>

                  <p className="mt-2 text-xs text-slate-500">
                    {item.duration}
                  </p>
                </div>

                <div className="flex gap-2">
                  <button className="rounded-xl bg-orange-500 p-3 text-white">
                    <Play size={18} />
                  </button>

                  <button className="rounded-xl border border-white/10 p-3 text-slate-300">
                    <Download size={18} />
                  </button>

                  <button className="rounded-xl border border-red-500/20 p-3 text-red-400">
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}