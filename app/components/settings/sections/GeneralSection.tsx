"use client";

import { useEffect, useState } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import {
  Globe,
  Shield,
  Baby,
  Star,
  ChevronDown,
  Upload,
  Eye,
  Users,
} from "lucide-react";

import SettingsCard from "../common/SettingsCard";
import SettingsRow from "../common/SettingsRow";
import SettingsToggle from "../common/SettingsToggle";
import SettingsSelect from "../common/SettingsSelect";
import { useSettings } from "../SettingsProvider";
import { useAuthModal } from "@/app/components/auth/AuthProvider";

const LANGUAGES = [
  "English",
  "Español",
  "Français",
  "Deutsch",
  "हिन्दी",
  "Português",
];

interface StarsStats {
  uploads: number;
  totalViews: number;
  subscribers: number;
}

export default function GeneralSection() {
  const { general, updateGeneral } = useSettings();
  const { user, signedIn } = useAuthModal();

  const [starsOpen, setStarsOpen] = useState(false);
  const [stats, setStats] = useState<StarsStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // Loaded lazily, only once the user actually opens the Earn Stars
  // panel — and computed from their real InPlayer activity (uploads,
  // views, subscribers), not a fabricated balance.
  useEffect(() => {
    if (!starsOpen || stats || !signedIn || !user) return;

    async function loadStats() {
      setStatsLoading(true);

      try {
        const session = await fetchAuthSession();
        const idToken = session.tokens?.idToken?.toString();

        const [videosRes, subsRes] = await Promise.all([
          fetch("/api/my-videos", {
            headers: { Authorization: `Bearer ${idToken}` },
          }),
          fetch(`/api/subscriptions?creatorId=${user!.userId}`),
        ]);

        const videosData = await videosRes.json();
        const subsData = await subsRes.json();

        const uploads = (videosData.videos || []).length;
        const totalViews = (videosData.videos || []).reduce(
          (sum: number, v: { views?: number }) => sum + (v.views || 0),
          0
        );

        setStats({
          uploads,
          totalViews,
          subscribers: subsData.subscriberCount || 0,
        });
      } catch (err) {
        console.error("Failed to load Stars stats:", err);
      } finally {
        setStatsLoading(false);
      }
    }

    loadStats();
  }, [starsOpen, stats, signedIn, user]);

  const totalStars = stats
    ? stats.uploads * 25 + stats.totalViews * 1 + stats.subscribers * 10
    : 0;

  return (
    <SettingsCard
      icon={<Globe size={24} />}
      title="General"
      description="Personalize your overall InPlayer experience."
    >
      <div className="space-y-2">

        <SettingsRow
          icon={<Globe size={20} />}
          title="Language"
          description="Choose the language used by InPlayer."
        >
          <SettingsSelect
            value={general.language}
            onChange={(value) => updateGeneral({ language: value })}
            options={LANGUAGES}
          />
        </SettingsRow>

        <SettingsRow
          icon={<Shield size={20} />}
          title="Restricted Mode"
          description="Hide potentially mature content."
        >
          <SettingsToggle
            checked={general.restrictedMode}
            onChange={(checked) => updateGeneral({ restrictedMode: checked })}
          />
        </SettingsRow>

        <SettingsRow
          icon={<Baby size={20} />}
          title="Child Mode"
          description="Create a safer experience for children."
        >
          <SettingsToggle
            checked={general.childMode}
            onChange={(checked) => updateGeneral({ childMode: checked })}
          />
        </SettingsRow>

        <div>
          <SettingsRow
            icon={<Star size={20} />}
            title="Earn Stars"
            description="Your engagement score, built from real activity."
            onClick={() => setStarsOpen((v) => !v)}
          >
            <ChevronDown
              size={18}
              className={`
                text-slate-500
                transition-transform
                duration-300
                ease-out
                ${starsOpen ? "rotate-180" : ""}
              `}
            />
          </SettingsRow>

          {starsOpen && (
            <div className="mt-2 animate-settings-fade rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              {!signedIn && (
                <p className="text-sm text-slate-400">
                  Sign in to start earning Stars from your uploads, views and
                  subscribers.
                </p>
              )}

              {signedIn && statsLoading && (
                <p className="text-sm text-slate-400">
                  Calculating your Stars…
                </p>
              )}

              {signedIn && !statsLoading && stats && (
                <>
                  <div className="mb-5 flex items-baseline gap-2">
                    <span className="text-4xl font-black tracking-tight text-white">
                      {totalStars.toLocaleString()}
                    </span>
                    <span className="text-sm font-semibold text-slate-400">
                      Stars
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-center">
                      <Upload size={16} className="mx-auto mb-2 text-slate-300" />
                      <p className="text-lg font-bold text-white">
                        {stats.uploads}
                      </p>
                      <p className="text-[11px] text-slate-500">Uploads</p>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-center">
                      <Eye size={16} className="mx-auto mb-2 text-slate-300" />
                      <p className="text-lg font-bold text-white">
                        {stats.totalViews.toLocaleString()}
                      </p>
                      <p className="text-[11px] text-slate-500">Views</p>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-center">
                      <Users size={16} className="mx-auto mb-2 text-slate-300" />
                      <p className="text-lg font-bold text-white">
                        {stats.subscribers}
                      </p>
                      <p className="text-[11px] text-slate-500">Subscribers</p>
                    </div>
                  </div>

                  <p className="mt-4 text-xs leading-5 text-slate-500">
                    Stars are calculated from your real InPlayer activity — 25
                    per upload, 1 per view, and 10 per subscriber. Keep
                    creating to earn more.
                  </p>
                </>
              )}
            </div>
          )}
        </div>

      </div>
    </SettingsCard>
  );
}
