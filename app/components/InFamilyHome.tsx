"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import { Users } from "lucide-react";

import { useAuthModal } from "./auth/AuthProvider";
import TrendingNow from "./TrendingNow";

const FALLBACK_AVATAR = "/avatars/avatar.png";

interface InFamilyCreator {
  creatorId: string;
  username: string;
  name: string;
  avatarUrl: string | null;
  notifyEnabled: boolean;
}

function getAvatarSrc(avatarUrl: string | null | undefined) {
  const source = avatarUrl?.trim();
  if (!source) return FALLBACK_AVATAR;
  if (
    source.startsWith("/") ||
    source.startsWith("data:") ||
    source.startsWith("blob:") ||
    /^https?:\/\//i.test(source)
  ) {
    return source;
  }
  return `/${source}`;
}

// Homepage replacement for the old "Trending Creators" strip. Signed-in
// users see their real In-Family (subscribed creators, from
// /api/subscriptions/list — the same relationship SubscribeButton writes
// to and Navbar's In-Family panel reads). Signed-out users, and signed-in
// users with no subscriptions yet, fall back to the existing public
// TrendingNow discovery strip rather than showing fabricated data.
export default function InFamilyHome() {
  const { signedIn, authLoading } = useAuthModal();
  const [creators, setCreators] = useState<InFamilyCreator[] | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!signedIn) {
      // Deferred rather than called synchronously in the effect body — see
      // the same pattern/reasoning in app/components/NavbarSearch.tsx.
      const timer = setTimeout(() => setCreators(null), 0);
      return () => clearTimeout(timer);
    }

    let cancelled = false;
    (async () => {
      try {
        const session = await fetchAuthSession();
        const idToken = session.tokens?.idToken?.toString();
        if (!idToken) return;

        const res = await fetch("/api/subscriptions/list", {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        if (!res.ok) return;

        const data = await res.json();
        if (!cancelled) setCreators(data.subscriptions ?? []);
      } catch (err) {
        console.error("Failed to load In-Family:", err);
        if (!cancelled) setCreators([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [signedIn, authLoading]);

  if (authLoading) {
    return (
      <section className="mx-auto max-w-[1800px] px-3 py-1 lg:px-6 lg:py-1.5 overflow-hidden">
        <div className="flex gap-2 px-1 py-1 lg:gap-3 overflow-hidden">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex w-20 flex-shrink-0 flex-col items-center gap-1 sm:w-22 lg:w-24">
              <div className="h-14 w-14 animate-pulse rounded-full bg-white/[0.06] light:bg-black/5 sm:h-16 sm:w-16 lg:h-16 lg:w-16" />
              <div className="h-2 w-10 animate-pulse rounded-full bg-white/[0.06] light:bg-black/5" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (!signedIn) {
    return <TrendingNow />;
  }

  if (creators === null) {
    // Still loading the subscriptions list — reuse TrendingNow's own
    // internal skeleton by rendering nothing here for one tick rather than
    // a second competing skeleton.
    return null;
  }

  if (creators.length === 0) {
    return (
      <section className="mx-auto max-w-[1800px] px-3 py-1 lg:px-6 lg:py-1.5">
        <div className="mb-1.5 flex items-end justify-between lg:mb-2">
          <div>
            <span className="rounded-full border border-orange-500/20 bg-orange-500/10 px-2 lg:px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.2em] text-orange-300 light:text-orange-600 backdrop-blur-sm">
              Your circle
            </span>
            <h2 className="mt-0.5 text-base lg:text-lg font-black tracking-tight text-white light:text-slate-900">
              In-Family
            </h2>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.02] px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-orange-500/10 text-orange-300 light:text-orange-600">
              <Users size={16} />
            </div>
            <div>
              <p className="text-sm font-semibold text-white light:text-slate-900">
                Your In-Family is empty
              </p>
              <p className="text-xs text-slate-400 light:text-slate-600">
                Follow creators to see them here.
              </p>
            </div>
          </div>
          <Link
            href="/creators"
            className="flex-shrink-0 rounded-lg bg-orange-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-orange-600"
            prefetch={false}
          >
            Discover Creators
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-[1800px] px-3 py-1 lg:px-6 lg:py-1.5 overflow-hidden">
      <div className="mb-1.5 flex items-end justify-between lg:mb-2">
        <div>
          <span className="rounded-full border border-orange-500/20 bg-orange-500/10 px-2 lg:px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.2em] text-orange-300 light:text-orange-600 backdrop-blur-sm">
            Your circle
          </span>
          <h2 className="mt-0.5 text-base lg:text-lg font-black tracking-tight text-white light:text-slate-900">
            In-Family
          </h2>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 py-1 lg:gap-3">
        {creators.map((creator) => (
          <Link
            key={creator.creatorId}
            href={`/u/${encodeURIComponent(creator.username)}`}
            aria-label={`Open ${creator.name}'s channel`}
            className="group flex w-20 flex-shrink-0 flex-col items-center gap-1 text-center sm:w-22 lg:w-24"
            prefetch={false}
          >
            <div className="relative h-14 w-14 flex-shrink-0 transition duration-200 group-hover:scale-105 group-active:scale-95 sm:h-16 sm:w-16 lg:h-16 lg:w-16">
              {/* eslint-disable-next-line @next/next/no-img-element -- creator avatars can be data URLs. */}
              <img
                src={getAvatarSrc(creator.avatarUrl)}
                alt=""
                onError={(event) => {
                  if (!event.currentTarget.src.endsWith(FALLBACK_AVATAR)) {
                    event.currentTarget.src = FALLBACK_AVATAR;
                  }
                }}
                className="h-full w-full rounded-full object-cover"
              />
              {creator.notifyEnabled && (
                <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-orange-400 ring-2 ring-[#0b1220] light:ring-[#FBF6EA]" />
              )}
            </div>
            <p className="w-full truncate text-[11px] font-bold text-white light:text-slate-900">{creator.name}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
