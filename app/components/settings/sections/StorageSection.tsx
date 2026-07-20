"use client";

import { useEffect, useState } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import {
  HardDrive,
  Film,
  Clapperboard,
  Loader2,
  CloudCog,
} from "lucide-react";
import SettingsCard from "../common/SettingsCard";
import { useAuthModal } from "@/app/components/auth/AuthProvider";

interface VideoItem {
  videoId: string;
  status: string;
  contentType?: string;
}

export default function StorageSection() {
  const { signedIn, authLoading } = useAuthModal();
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;

    if (!signedIn) {
      setLoading(false);
      return;
    }

    async function load() {
      try {
        const session = await fetchAuthSession();
        const idToken = session.tokens?.idToken?.toString();

        const res = await fetch("/api/my-videos", {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        const data = await res.json();
        setVideos(data.videos || []);
      } catch (err) {
        console.error("Failed to load storage overview:", err);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [signedIn, authLoading]);

  const longform = videos.filter((v) => v.contentType !== "short");
  const shorts = videos.filter((v) => v.contentType === "short");
  const processing = videos.filter((v) => v.status === "processing");

  return (
    <SettingsCard
      icon={<HardDrive size={24} />}
      title="Storage"
      description="How your uploads are stored on InPlayer."
    >
      {!signedIn && !authLoading && (
        <p className="text-sm text-slate-400">
          Sign in to see your storage overview.
        </p>
      )}

      {loading && signedIn && (
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Loader2 size={16} className="animate-spin" />
          Loading your content…
        </div>
      )}

      {!loading && signedIn && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center">
              <Film size={18} className="mx-auto mb-2 text-slate-300" />
              <p className="text-xl font-black text-white">
                {longform.length}
              </p>
              <p className="text-[11px] text-slate-500">Videos</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center">
              <Clapperboard size={18} className="mx-auto mb-2 text-slate-300" />
              <p className="text-xl font-black text-white">{shorts.length}</p>
              <p className="text-[11px] text-slate-500">Shorts</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center">
              <Loader2 size={18} className="mx-auto mb-2 text-slate-300" />
              <p className="text-xl font-black text-white">
                {processing.length}
              </p>
              <p className="text-[11px] text-slate-500">Processing</p>
            </div>
          </div>

          <div className="mt-5 flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
            <CloudCog size={18} className="mt-0.5 shrink-0 text-slate-400" />
            <p className="text-sm leading-6 text-slate-400">
              Your videos are streamed straight from InPlayer&apos;s cloud
              infrastructure — there&apos;s no fixed storage limit on your
              account, and nothing here counts against your device&apos;s
              storage.
            </p>
          </div>
        </>
      )}
    </SettingsCard>
  );
}
