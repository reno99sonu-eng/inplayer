"use client";

import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Download,
  Play,
  Trash2,
} from "lucide-react";

export default function DownloadsPage() {
  const router = useRouter();

  // Temporary local data until backend is connected
  const items = [
    {
      id: "1",
      title: "Planet Earth: Oceans",
      creator: "Nature Vision",
      size: "1.8 GB",
      quality: "1080p",
      thumbnail: "/downloads/1.jpg",
    },
    {
      id: "2",
      title: "AI Explained",
      creator: "Tech Explained",
      size: "860 MB",
      quality: "720p",
      thumbnail: "/downloads/2.jpg",
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

        <h1 className="text-lg font-black">Downloads</h1>
      </div>

      <div className="mx-auto max-w-3xl px-5 py-8">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-white/10 bg-white/[0.03] px-6 py-16 text-center">
            <Download size={40} className="mb-4 text-orange-400/60" />

            <h2 className="text-lg font-bold">
              No downloads yet
            </h2>

            <p className="mt-2 max-w-xs text-sm text-slate-400">
              Download videos to watch offline.
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
                <img
                  src={item.thumbnail}
                  alt={item.title}
                  className="h-24 w-40 rounded-2xl object-cover"
                />

                <div className="flex-1">
                  <h2 className="font-bold">
                    {item.title}
                  </h2>

                  <p className="mt-1 text-sm text-slate-400">
                    {item.creator}
                  </p>

                  <div className="mt-2 flex gap-2 text-xs">
                    <span className="rounded-full bg-orange-500/20 px-2 py-1 text-orange-300">
                      {item.quality}
                    </span>

                    <span className="rounded-full bg-white/5 px-2 py-1 text-slate-400">
                      {item.size}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button className="rounded-xl bg-orange-500 p-3 text-white">
                    <Play size={18} />
                  </button>

                  <button className="rounded-xl border border-white/10 p-3 text-slate-300">
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