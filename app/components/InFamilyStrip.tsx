"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BadgeCheck, Users } from "lucide-react";
import { fetchAuthSession } from "aws-amplify/auth";

import type { TrendingCreator } from "../data/trending";
import { formatViews } from "../lib/formatters";

const MIN_ITEMS_TO_LOOP = 6;
const FALLBACK_AVATAR = "/avatars/avatar.png";

// Shape returned by /api/subscriptions/list
interface SubscribedChannel {
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

// Convert subscribed channel to a unified item shape for the pill marquee
interface PillItem {
  id: string;
  username: string;
  name: string;
  avatarUrl: string | null;
  subtitle?: string;
  isVerified?: boolean;
}

function PillMarquee({
  items,
  heading,
  badge,
  badgeColor,
}: {
  items: PillItem[];
  heading: string;
  badge: string;
  badgeColor: "orange" | "red";
}) {
  const shouldLoop = items.length >= MIN_ITEMS_TO_LOOP;
  const minCopies = shouldLoop
    ? Math.max(1, Math.ceil(12 / (items.length || 1)))
    : 1;
  const baseSeq = Array.from({ length: minCopies }, () => items).flat();
  const firstHalf = shouldLoop ? [...baseSeq, ...baseSeq] : items;
  const secondHalf = shouldLoop ? [...baseSeq, ...baseSeq] : [];
  const loopGroups = shouldLoop ? [firstHalf, secondHalf] : [firstHalf];

  const badgeClasses =
    badgeColor === "orange"
      ? "border-orange-500/20 bg-orange-500/10 text-orange-300 light:text-orange-600"
      : "border-red-500/20 bg-red-500/10 text-red-300 light:text-red-600";

  return (
    <section className="mx-auto max-w-[1800px] px-3 py-1 lg:px-6 lg:py-1.5 overflow-hidden">
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes infamilyMarquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-infamily-marquee {
          animation: infamilyMarquee 40s linear infinite;
        }
        .animate-infamily-marquee:hover {
          animation-play-state: paused;
        }
      `}} />
      <div className="mb-1.5 flex items-end justify-between lg:mb-2">
        <div>
          <span
            className={`rounded-full border px-2 lg:px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.2em] backdrop-blur-sm ${badgeClasses}`}
          >
            {badge}
          </span>
          <h2 className="mt-0.5 text-base lg:text-lg font-black tracking-tight text-white light:text-slate-900">
            {heading}
          </h2>
        </div>
      </div>

      <div className="relative">
        <div
          className={`flex gap-2 lg:gap-3 py-1 ${
            shouldLoop
              ? "w-max animate-infamily-marquee hover:[animation-play-state:paused]"
              : "w-full flex-wrap"
          }`}
        >
          {loopGroups.map((group, groupIndex) => (
            <div
              key={groupIndex}
              aria-hidden={groupIndex === 1}
              className={
                shouldLoop ? "flex w-max gap-2 lg:gap-3" : "flex flex-wrap gap-2 lg:gap-3"
              }
            >
              {group.map((item, index) => (
                <Link
                  key={`${groupIndex}-${index}-${item.id}`}
                  href={`/u/${encodeURIComponent(item.username)}`}
                  tabIndex={groupIndex === 1 ? -1 : undefined}
                  aria-label={`Open ${item.name}'s channel`}
                  className="group flex w-20 flex-shrink-0 flex-col items-center gap-1 text-center sm:w-22 lg:w-24"
                  prefetch={false}
                >
                  <div className="relative h-14 w-14 flex-shrink-0 transition duration-200 group-hover:scale-105 group-active:scale-95 sm:h-16 sm:w-16 lg:h-16 lg:w-16">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={getAvatarSrc(item.avatarUrl)}
                      alt=""
                      onError={(event) => {
                        if (!event.currentTarget.src.endsWith(FALLBACK_AVATAR)) {
                          event.currentTarget.src = FALLBACK_AVATAR;
                        }
                      }}
                      className="h-full w-full rounded-full object-cover"
                    />
                    {item.isVerified && (
                      <BadgeCheck
                        size={16}
                        className="absolute -bottom-0.5 -right-0.5 rounded-full fill-orange-400 text-[#101827] ring-2 ring-[#0b1220] light:ring-[#FBF6EA]"
                        aria-label="Verified creator"
                      />
                    )}
                  </div>
                  <p className="w-full truncate text-[11px] font-bold text-white light:text-slate-900">
                    {item.name}
                  </p>
                  {item.subtitle && (
                    <p className="w-full truncate text-[9.5px] font-medium text-slate-400 light:text-slate-600">
                      {item.subtitle}
                    </p>
                  )}
                </Link>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function InFamilyStrip() {
  // null = loading, undefined = not signed in, [] = signed in but no subs
  const [subs, setSubs] = useState<SubscribedChannel[] | null | undefined>(null);
  const [trending, setTrending] = useState<TrendingCreator[] | null>(null);

  // Determine sign-in status and load subscriptions
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const session = await fetchAuthSession();
        const idToken = session.tokens?.idToken?.toString();

        if (!idToken) {
          // Not signed in — load trending as teaser
          setSubs(undefined);
          return;
        }

        const res = await fetch("/api/subscriptions/list", {
          headers: { Authorization: `Bearer ${idToken}` },
        });

        if (!res.ok) {
          if (!cancelled) setSubs([]);
          return;
        }

        const data = await res.json();
        if (!cancelled) setSubs(data.subscriptions ?? []);
      } catch {
        if (!cancelled) setSubs(undefined);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  // Load trending creators for signed-out teaser (or when subs load fails)
  useEffect(() => {
    if (subs !== undefined && subs !== null) return; // signed in, don't need trending
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/trending");
        const data = await res.json();
        if (!cancelled) setTrending(data.creators || []);
      } catch {
        if (!cancelled) setTrending([]);
      }
    })();

    return () => { cancelled = true; };
  }, [subs]);

  // --- Signed in with subscriptions ---
  if (subs && subs.length > 0) {
    const items: PillItem[] = subs.map((ch) => ({
      id: ch.creatorId,
      username: ch.username,
      name: ch.name,
      avatarUrl: ch.avatarUrl,
    }));
    return (
      <PillMarquee
        items={items}
        heading="In-Family"
        badge="Your subscriptions"
        badgeColor="orange"
      />
    );
  }

  // --- Signed in but no subscriptions yet: show a join prompt ---
  if (subs && subs.length === 0) {
    return (
      <section className="mx-auto max-w-[1800px] px-3 py-2 lg:px-6">
        <div className="flex items-center gap-3 rounded-2xl border border-orange-500/20 bg-orange-500/5 px-4 py-3">
          <Users size={20} className="flex-shrink-0 text-orange-400" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white light:text-slate-900">
              Build your In-Family
            </p>
            <p className="text-xs text-slate-400 light:text-slate-500">
              Subscribe to creators you love — they&apos;ll appear here.
            </p>
          </div>
          <Link
            href="/creators"
            className="flex-shrink-0 rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-orange-600"
          >
            Discover
          </Link>
        </div>
      </section>
    );
  }

  // --- Not signed in or loading: show trending as teaser ---
  if (trending === null) {
    // skeleton while loading
    return (
      <section className="mx-auto max-w-[1800px] px-3 py-1 lg:px-6 lg:py-1.5 overflow-hidden">
        <div className="mb-1.5">
          <div className="h-3.5 w-24 animate-pulse rounded-full bg-white/[0.06]" />
          <div className="mt-1 h-5 w-40 animate-pulse rounded-full bg-white/[0.06]" />
        </div>
        <div className="flex gap-2 lg:gap-3 py-1">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex w-20 flex-shrink-0 flex-col items-center gap-1">
              <div className="h-14 w-14 animate-pulse rounded-full bg-white/[0.06] light:bg-black/5 sm:h-16 sm:w-16" />
              <div className="h-2 w-10 animate-pulse rounded-full bg-white/[0.06]" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (trending.length === 0) return null;

  const trendingPills: PillItem[] = trending.map((c) => ({
    id: c.userId,
    username: c.username,
    name: c.name,
    avatarUrl: c.avatarUrl,
    subtitle: `${formatViews(c.windowViews)} views`,
    isVerified: c.isVerified,
  }));

  return (
    <PillMarquee
      items={trendingPills}
      heading="Trending Creators"
      badge="Trending now"
      badgeColor="red"
    />
  );
}
