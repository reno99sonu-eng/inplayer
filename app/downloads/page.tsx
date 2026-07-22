"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { fetchAuthSession } from "aws-amplify/auth";
import { ArrowLeft, Download, Loader2, Play, Trash2 } from "lucide-react";
import { useAuthModal } from "@/app/components/auth/AuthProvider";
import { formatTimeAgo } from "@/app/lib/formatters";

interface DownloadItem {
  videoId: string;
  title: string;
  thumbnailUrl?: string;
  uploaderName?: string;
  quality?: string;
  downloadedAt: string;
}

export default function DownloadsPage() {
  const router = useRouter();
  const { signedIn, authLoading, openSignIn } = useAuthModal();
  const [items, setItems] = useState<DownloadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    if (!signedIn) {
      setLoading(false);
      return;
    }

    async function load() {
      try {
        const session = await fetchAuthSession();
        const idToken = session.tokens?.idToken?.toString();

        const res = await fetch("/api/downloads", {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        const data = await res.json();
        setItems(data.downloads || []);
      } catch (err) {
        console.error("Failed to load downloads:", err);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [signedIn]);

  const handleRemove = async (videoId: string) => {
    setRemovingId(videoId);

    try {
      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken?.toString();

      const res = await fetch("/api/downloads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ videoId, action: "remove" }),
      });

      if (res.ok) {
        setItems((prev) => prev.filter((item) => item.videoId !== videoId));
      }
    } catch (err) {
      console.error("Failed to remove download:", err);
    } finally {
      setRemovingId(null);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#06101D] light:bg-[#FAF5E9]">
        <Loader2 size={28} className="animate-spin text-orange-400" />
      </div>
    );
  }

  if (!signedIn) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#06101D] light:bg-[#FAF5E9] px-6 text-center text-white light:text-slate-900">
        <h2 className="text-2xl font-black">Sign in to see your downloads</h2>
        <button
          onClick={openSignIn}
          className="mt-6 rounded-2xl bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] px-8 py-3 font-bold text-white shadow-[0_15px_35px_rgba(255,153,0,.3)] transition-all hover:-translate-y-0.5"
        >
          Sign In
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#06101D] light:bg-[#FAF5E9] text-white light:text-slate-900">
      <div className="flex items-center gap-4 border-b border-white/10 light:border-black/10 px-5 py-5">
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
            light:border-black/10
            bg-white/5
            light:bg-black/5
            transition-all
            duration-200
            hover:bg-white/15
            light:hover:bg-black/10
          "
        >
          <ArrowLeft size={20} />
        </button>

        <div>
          <h1 className="text-lg font-black">Downloads</h1>
          <p className="text-sm text-slate-400 light:text-slate-600">
            {items.length === 0
              ? "Nothing downloaded yet"
              : `${items.length} ${items.length === 1 ? "video" : "videos"} saved offline`}
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-5 py-8">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.02] px-6 py-16 text-center">
            <Download size={40} className="mb-4 text-orange-400/60" />

            <h2 className="text-lg font-bold">No downloads yet</h2>

            <p className="mt-2 max-w-xs text-sm text-slate-400 light:text-slate-600">
              Tap the download icon on any video to watch it offline — it'll
              show up here.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((item) => (
              <div
                key={item.videoId}
                className="
                  flex
                  items-center
                  gap-4
                  rounded-3xl
                  border
                  border-white/10
                  light:border-black/10
                  bg-white/[0.03]
                  light:bg-black/[0.02]
                  p-4
                "
              >
                <div className="relative h-24 w-40 flex-shrink-0 overflow-hidden rounded-2xl bg-white/5 light:bg-black/5">
                  {item.thumbnailUrl && (
                    <Image
                      src={item.thumbnailUrl}
                      alt={item.title}
                      fill
                      sizes="160px"
                      className="object-cover"
                    />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <h2 className="truncate font-bold">{item.title}</h2>

                  {item.uploaderName && (
                    <p className="mt-1 truncate text-sm text-slate-400 light:text-slate-600">
                      {item.uploaderName}
                    </p>
                  )}

                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    {item.quality && item.quality !== "default" && (
                      <span className="rounded-full bg-orange-500/20 px-2 py-1 font-semibold text-orange-300 light:text-orange-700">
                        {item.quality}
                      </span>
                    )}

                    <span className="rounded-full bg-white/5 light:bg-black/5 px-2 py-1 text-slate-400 light:text-slate-600">
                      Downloaded {formatTimeAgo(item.downloadedAt)}
                    </span>
                  </div>
                </div>

                <div className="flex flex-shrink-0 gap-2">
                  <Link
                    href={`/watch/${item.videoId}`}
                    title="Watch"
                    className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-500 text-white transition hover:-translate-y-0.5"
                  >
                    <Play size={18} />
                  </Link>

                  <button
                    onClick={() => handleRemove(item.videoId)}
                    disabled={removingId === item.videoId}
                    title="Remove from Downloads"
                    className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 light:border-black/10 text-slate-300 light:text-slate-600 transition hover:border-red-400/40 hover:bg-red-500/10 hover:text-red-400 disabled:opacity-60"
                  >
                    {removingId === item.videoId ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Trash2 size={18} />
                    )}
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
