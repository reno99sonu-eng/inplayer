"use client";

import { useEffect, useState } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import Image from "next/image";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { useAuthModal } from "@/app/components/auth/AuthProvider";
import { formatTimeAgo } from "@/app/lib/formatters";

interface HistoryItem {
  videoId: string;
  title: string;
  thumbnailUrl?: string;
  category: string;
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

  return (
    <div className="mx-auto max-w-[1000px] px-4 py-8 sm:py-12">
      <h1 className="text-2xl sm:text-3xl font-black text-white light:text-slate-900">
        Watch History
      </h1>

      {items.length === 0 ? (
        <p className="mt-8 text-sm text-slate-400 light:text-slate-500">
          You haven't watched anything yet.
        </p>
      ) : (
        <div className="mt-8 space-y-3">
          {items.map((item) => (
            <Link
              key={item.videoId}
              href={`/watch/${item.videoId}`}
              className="group flex gap-4 rounded-2xl p-2 -mx-2 transition hover:bg-white/5 light:hover:bg-black/5"
            >
              <div className="relative h-[70px] w-[125px] flex-shrink-0 overflow-hidden rounded-xl bg-white/5 light:bg-black/5">
                {item.thumbnailUrl && (
                  <Image
                    src={item.thumbnailUrl}
                    alt={item.title}
                    fill
                    sizes="125px"
                    className="object-cover"
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="line-clamp-2 font-semibold text-white light:text-slate-900 group-hover:text-orange-300 light:group-hover:text-orange-600 transition-colors">
                  {item.title}
                </h3>
                <p className="mt-1 text-xs text-slate-400 light:text-slate-500">
                  Watched {formatTimeAgo(item.watchedAt)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
