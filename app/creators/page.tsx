"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Compass, Loader2, UserRound } from "lucide-react";

import BackButton from "@/app/components/BackButton";
import SubscribeButton from "@/app/components/SubscribeButton";
import MembershipButton from "@/app/components/MembershipButton";
import type { PublicCreatorRow } from "@/app/api/creators/route";

export default function CreatorsPage() {
  const router = useRouter();

  const [creators, setCreators] = useState<PublicCreatorRow[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadPage(nextCursor: string | null, replace: boolean) {
    try {
      const url = nextCursor
        ? `/api/creators?cursor=${encodeURIComponent(nextCursor)}`
        : "/api/creators";
      const res = await fetch(url);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Couldn't load creators right now.");
        return;
      }

      setCreators((prev) => (replace ? data.creators : [...prev, ...data.creators]));
      setCursor(data.nextCursor);
    } catch (err) {
      console.error("Failed to load creators:", err);
      setError("Couldn't load creators right now.");
    }
  }

  useEffect(() => {
    // `loading` already starts true (see useState above) — nothing to set
    // synchronously here, just kick off the fetch and clear it once done.
    loadPage(null, true).finally(() => setLoading(false));
  }, []);

  const handleLoadMore = async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    await loadPage(cursor, false);
    setLoadingMore(false);
  };

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-8 sm:py-10">
      <BackButton />

      <div className="mt-4 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500/20 to-amber-400/10 text-orange-300">
          <Compass size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-black text-white light:text-slate-900 sm:text-3xl">
            Discover Creators
          </h1>
          <p className="text-sm text-slate-400 light:text-slate-600">
            Browse public InPlayer profiles and join their In-Family to see their uploads here.
          </p>
        </div>
      </div>

      {loading && (
        <div className="mt-16 flex flex-col items-center justify-center text-slate-400 light:text-slate-500">
          <Loader2 size={26} className="animate-spin text-orange-400" />
          <p className="mt-3 text-sm">Loading creators…</p>
        </div>
      )}

      {!loading && error && (
        <div className="mt-10 rounded-2xl border border-red-500/20 bg-red-500/10 p-5 text-sm text-red-300 light:text-red-700">
          {error}
        </div>
      )}

      {!loading && !error && creators.length === 0 && (
        <div className="mt-16 flex flex-col items-center justify-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/10 light:border-black/10 bg-white/5 light:bg-black/5 text-slate-500">
            <UserRound size={26} />
          </div>
          <h2 className="mt-4 text-lg font-bold text-white light:text-slate-900">
            No public creators yet
          </h2>
          <p className="mt-1 max-w-sm text-sm text-slate-400 light:text-slate-600">
            Nobody with a public profile has joined InPlayer yet — check back soon, or be the
            first to set up your channel.
          </p>
        </div>
      )}

      {!loading && !error && creators.length > 0 && (
        <>
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {creators.map((creator) => (
              <div
                key={creator.userId}
                className="
                  flex flex-col items-center gap-3 rounded-2xl border border-white/10 light:border-black/10
                  bg-white/[0.02] light:bg-black/[0.015] p-5 text-center
                  transition-all duration-300 hover:border-orange-400/30 hover:bg-white/[0.04] light:hover:bg-black/[0.03]
                "
              >
                <button
                  onClick={() => router.push(`/u/${creator.username}`)}
                  className="flex flex-col items-center gap-3"
                >
                  <div className="relative h-16 w-16 overflow-hidden rounded-full border border-white/10 light:border-black/10 bg-white/5 light:bg-black/5">
                    {creator.avatarUrl ? (
                      // avatarUrl is a compressed base64 data URL (see
                      // app/profile/page.tsx), not a remote host
                      // next/image's remotePatterns config covers.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={creator.avatarUrl}
                        alt={creator.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-slate-500">
                        <UserRound size={26} />
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="line-clamp-1 text-sm font-bold text-white light:text-slate-900">
                      {creator.name}
                    </p>
                    <p className="text-xs text-slate-400 light:text-slate-500">
                      @{creator.username}
                    </p>
                  </div>
                </button>

                <div className="flex flex-wrap items-center justify-center gap-1.5">
                  <SubscribeButton creatorId={creator.userId} />
                  <MembershipButton creatorId={creator.userId} creatorName={creator.name} />
                </div>
              </div>
            ))}
          </div>

          {cursor && (
            <div className="mt-8 flex justify-center">
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="
                  rounded-2xl border border-white/10 light:border-black/10 px-6 py-2.5 text-sm font-semibold
                  text-slate-200 light:text-slate-700 transition-all duration-300
                  hover:border-orange-400/30 hover:bg-white/5 light:hover:bg-black/5
                  disabled:cursor-not-allowed disabled:opacity-60
                "
              >
                {loadingMore ? "Loading…" : "Load more"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
