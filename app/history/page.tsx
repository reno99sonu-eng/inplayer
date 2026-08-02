"use client";

import { useEffect, useState } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import Image from "next/image";
import Link from "next/link";
import { Film, Loader2, PlaySquare } from "lucide-react";
import BackButton from "@/app/components/BackButton";
import { useAuthModal } from "@/app/components/auth/AuthProvider";
import { formatTimeAgo } from "@/app/lib/formatters";

interface HistoryItem {
  videoId: string;
  title: string;
  thumbnailUrl?: string;
  category: string;
  contentType?: string;
  watchedAt: string;
}

export default function HistoryPage() {
  const { signedIn, authLoading, openSignIn } = useAuthModal();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!signedIn) {
      setLoading(false);
      return;
    }

    async function load() {
      try {
        const session = await fetchAuthSession();
        const idToken = session.tokens?.idToken?.toString();

        const res = await fetch("/api/history", {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        const data = await res.json();
        setItems(data.history || []);
      } catch (err) {
        console.error("Failed to load history:", err);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [signedIn]);

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 size={28} className="animate-spin text-orange-400" />
      </div>
    );
  }

  if (!signedIn) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
        <h2 className="text-2xl font-black text-white light:text-slate-900">
          Sign in to see your history
        </h2>
        <button
          onClick={openSignIn}
          className="mt-6 rounded-2xl bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] px-8 py-3 font-bold text-white shadow-[0_15px_35px_rgba(255,153,0,.3)] transition-all hover:-translate-y-0.5"
        >
          Sign In
        </button>
      </div>
    );
  }

  const videoHistory = items.filter(
    (i) => i.contentType !== "short" && !i.category?.toLowerCase().includes("raftaar")
  );
  const raftaarHistory = items.filter(
    (i) => i.contentType === "short" || i.category?.toLowerCase().includes("raftaar")
  );

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6 sm:py-10">
      <div className="mb-4">
        <BackButton />
      </div>

      <h1 className="text-2xl sm:text-3xl font-black text-white light:text-slate-900">
        Watch History
      </h1>

      {items.length === 0 ? (
        <p className="mt-8 text-sm text-slate-400 light:text-slate-500">
          You haven&apos;t watched anything yet.
        </p>
      ) : (
        <div className="mt-8 space-y-10">
          {/* SECTION 1: VIDEOS WATCH HISTORY */}
          <section>
            <div className="mb-4 flex items-center gap-2 border-b border-white/10 pb-2 light:border-black/10">
              <Film size={20} className="text-orange-400" />
              <h2 className="text-lg font-bold text-white light:text-slate-900">
                Videos Watch History ({videoHistory.length})
              </h2>
            </div>

            {videoHistory.length === 0 ? (
              <p className="text-xs text-slate-500">No watched videos recorded.</p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {videoHistory.map((item) => (
                  <Link
                    key={item.videoId}
                    href={`/watch/${item.videoId}`}
                    className="group flex gap-3 rounded-2xl border border-white/10 bg-[#07111F] p-2.5 transition hover:border-orange-400/30 light:border-black/10 light:bg-white"
                  >
                    <div className="relative h-[64px] w-[114px] flex-shrink-0 overflow-hidden rounded-xl bg-white/5 light:bg-black/5">
                      {item.thumbnailUrl && (
                        <Image
                          src={item.thumbnailUrl}
                          alt={item.title}
                          fill
                          sizes="114px"
                          className="object-cover"
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="line-clamp-2 text-xs font-semibold text-white light:text-slate-900 group-hover:text-orange-300 light:group-hover:text-orange-600 transition-colors">
                        {item.title}
                      </h3>
                      <p className="mt-1 text-[11px] text-slate-400 light:text-slate-500">
                        {formatTimeAgo(item.watchedAt)}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* SECTION 2: RAFTAAR WATCH HISTORY */}
          <section>
            <div className="mb-4 flex items-center gap-2 border-b border-white/10 pb-2 light:border-black/10">
              <PlaySquare size={20} className="text-orange-400" />
              <h2 className="text-lg font-bold text-white light:text-slate-900">
                Raftaar Watch History ({raftaarHistory.length})
              </h2>
            </div>

            {raftaarHistory.length === 0 ? (
              <p className="text-xs text-slate-500">No watched Raftaar shorts recorded.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                {raftaarHistory.map((item) => (
                  <Link
                    key={item.videoId}
                    href={`/shorts?v=${item.videoId}`}
                    className="group relative aspect-[9/16] overflow-hidden rounded-2xl border border-white/10 bg-[#07111F] transition hover:border-orange-400/40 light:border-black/10 light:bg-white"
                  >
                    {item.thumbnailUrl ? (
                      <Image
                        src={item.thumbnailUrl}
                        alt={item.title}
                        fill
                        sizes="(max-width:640px)50vw,20vw"
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="h-full bg-slate-800" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent p-2.5 flex flex-col justify-end">
                      <p className="line-clamp-2 text-xs font-bold text-white leading-tight">
                        {item.title}
                      </p>
                      <p className="mt-1 text-[10px] text-slate-300">
                        {formatTimeAgo(item.watchedAt)}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
