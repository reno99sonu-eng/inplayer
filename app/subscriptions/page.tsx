"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { fetchAuthSession } from "aws-amplify/auth";
import { useRouter } from "next/navigation";
import { ArrowLeft, Rss, ChevronRight } from "lucide-react";

type Subscription = {
  creatorId: string;
  username: string;
  name: string;
  avatarUrl: string | null;
  notifyEnabled: boolean;
};

export default function SubscriptionsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [creators, setCreators] = useState<Subscription[]>([]);

  useEffect(() => {
    async function loadSubscriptions() {
      try {
        const session = await fetchAuthSession();
        const idToken = session.tokens?.idToken?.toString();

        if (!idToken) {
          setCreators([]);
          return;
        }

        const res = await fetch("/api/subscriptions/list", {
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        });

        if (!res.ok) {
          console.error(await res.text());
          setCreators([]);
          return;
        }

        const data = await res.json();
        setCreators(data.subscriptions ?? []);
      } catch (err) {
        console.error("Failed to load subscriptions:", err);
        setCreators([]);
      } finally {
        setLoading(false);
      }
    }

    loadSubscriptions();
  }, []);

  return (
    <div className="min-h-screen bg-[#06101D] light:bg-[#F5EEDC] text-white light:text-slate-900">
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

        <h1 className="text-lg font-black">Subscriptions</h1>
      </div>

      <div className="mx-auto max-w-3xl px-5 py-8">
        {loading ? (
          <div className="text-center py-20 text-slate-400">
            Loading subscriptions...
          </div>
        ) : creators.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.03] px-6 py-16 text-center">
            <Rss size={40} className="mb-4 text-orange-400/60" />

            <h2 className="text-lg font-bold">
              You haven&apos;t subscribed to anyone yet
            </h2>

            <p className="mt-2 max-w-xs text-sm text-slate-400 light:text-slate-500">
              Subscribe to creators to see their latest uploads here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {creators.map((creator) => (
              <button
                key={creator.creatorId}
                onClick={() => router.push(`/u/${creator.username}`)}
                className="
                  flex
                  w-full
                  items-center
                  gap-4
                  rounded-2xl
                  border
                  border-white/10
                  light:border-black/10
                  bg-white/[0.03]
                  light:bg-black/[0.03]
                  px-5
                  py-4
                  text-left
                  transition
                  hover:bg-white/5
                  light:hover:bg-black/5
                "
              >
                <div className="relative h-12 w-12 overflow-hidden rounded-full">
                  <Image
                    src={
                      creator.avatarUrl ||
                      "/recommendations/avatars/default.jpg"
                    }
                    alt={creator.name}
                    fill
                    sizes="48px"
                    className="object-cover"
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">
                    {creator.name}
                  </div>

                  <div className="truncate text-sm text-slate-400 light:text-slate-500">
                    @{creator.username}
                  </div>
                </div>

                {creator.notifyEnabled && (
                  <span className="h-2 w-2 rounded-full bg-orange-400" />
                )}

                <ChevronRight
                  size={18}
                  className="text-slate-500"
                />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}