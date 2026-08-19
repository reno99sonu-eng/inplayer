"use client";

import SettingsSectionTitle from "../common/SettingsSectionTitle";
import {
  MonitorPlay,
  Smartphone,
  Wifi,
  PlayCircle,
  PictureInPicture2,
  BadgeHelp,
  Volume2,
  Database,
  History,
  FastForward,
} from "lucide-react";

import SettingsCard from "../common/SettingsCard";
import SettingsRow from "../common/SettingsRow";
import SettingsToggle from "../common/SettingsToggle";
import SettingsSelect from "../common/SettingsSelect";
import { useSettings } from "../SettingsProvider";
import { clearAllPlaybackPositions } from "@/app/lib/playbackPositions";
import { usePremium } from "@/app/hooks/usePremium";
import { QUALITY_OPTIONS, requiresPremium, normalizeQuality } from "@/app/lib/premium";
import { Lock } from "lucide-react";

// Wired to the real SettingsProvider instead of local-only useState — see
// PrivacySection.tsx for the same fix. Data Saver in particular was the
// most deceptive stub in the app: RecommendationFeed.tsx already reads
// settings.playback.dataSaver for real (to gate autoplaying previews), but
// this toggle never called updatePlayback(), so flipping it on screen had
// zero effect on that downstream behavior. Closed Captions is likewise
// real now (see VideoPlayer.tsx / ShortsPageContent.tsx / live/page.tsx).
//
// STREAMING QUALITY IS NOW REAL. The two quality selects were previously
// disabled "Coming soon" stubs writing to provider fields nothing read.
// They now feed the max-resolution cap passed straight to the Mux player
// (see the maxResolution prop in VideoPlayer.tsx / ShortsPageContent.tsx),
// so choosing 720p genuinely stops higher renditions being fetched — it is
// a real bandwidth control, not a label.
//
// Resolutions above 1080p are Premium-only (app/lib/premium.ts). The
// options stay VISIBLE to free viewers rather than being hidden, marked
// with a lock, because a paywall you can't see isn't an upsell — but
// picking one does nothing for a free account: effectiveMaxResolution()
// clamps it server-tier-side, so it cannot be defeated from the browser.
//
// Audio Quality, Autoplay, PiP, resume position, skip intro and background
// playback remain genuinely unbuilt — each needs real player engineering
// that doesn't exist yet. They stay disabled and labelled rather than
// silently doing nothing when touched.
export default function PlaybackSection() {
  const { playback, updatePlayback } = useSettings();
  const premium = usePremium();

  // Labels carry a lock for anything above the free ceiling, so the reason a
  // choice won't stick is visible on the control itself rather than only
  // discovered afterwards.
  const qualityOptionLabels = QUALITY_OPTIONS.map((option) =>
    option.value !== "auto" && requiresPremium(option.value) && !premium.premium
      ? `${option.label} — Premium`
      : option.label
  );

  // Maps a displayed label back to the stored value. Kept explicit rather
  // than parsing the label, so the " — Premium" suffix can change freely.
  const labelToValue = (label: string) => {
    const index = qualityOptionLabels.indexOf(label);
    return index >= 0 ? QUALITY_OPTIONS[index].value : "auto";
  };
  const valueToLabel = (value: string) => {
    const index = QUALITY_OPTIONS.findIndex((o) => o.value === normalizeQuality(value));
    return index >= 0 ? qualityOptionLabels[index] : qualityOptionLabels[0];
  };

  return (
    <SettingsCard
      icon={<MonitorPlay size={24} />}
      title="Playback"
      description="Customize your streaming experience."
    >
      <div className="space-y-8">
      <SettingsSectionTitle
  title="Streaming"
  subtitle="Control streaming quality across your devices."
/>

        <SettingsRow
          icon={<Smartphone size={20} />}
          title="Shorts & mobile quality"
          description={
            premium.premium
              ? "Caps the quality used in the Shorts feed. Auto uses the best your connection allows."
              : `Caps the quality used in the Shorts feed. Free accounts stream up to 1080p.`
          }
        >
          <SettingsSelect
            value={valueToLabel(playback.mobileQuality)}
            onChange={(label) => updatePlayback({ mobileQuality: labelToValue(label) })}
            options={qualityOptionLabels}
          />
        </SettingsRow>

        <SettingsRow
          icon={<Wifi size={20} />}
          title="Video quality"
          description={
            premium.premium
              ? "Caps the quality on watch pages. Auto streams up to 4K Ultra HD."
              : "Caps the quality on watch pages. Free accounts stream up to 1080p — 2K and 4K need Premium."
          }
        >
          <SettingsSelect
            value={valueToLabel(playback.wifiQuality)}
            onChange={(label) => updatePlayback({ wifiQuality: labelToValue(label) })}
            options={qualityOptionLabels}
          />
        </SettingsRow>

        {!premium.premium && premium.ready && (
          <p className="flex items-start gap-2 px-5 text-xs leading-5 text-slate-500">
            <Lock size={13} className="mt-0.5 flex-shrink-0 text-orange-400" />
            <span>
              Your account streams up to 1080p (Full HD). 1440p and 4K Ultra HD
              are part of InPlayer Premium — see Plans &amp; Purchases.
            </span>
          </p>
        )}

        <SettingsRow
          icon={<Volume2 size={20} />}
          title="Audio Quality"
          description="Not available yet — uploads are transcoded to a single audio ladder, so there is nothing to choose between."
        >
          <SettingsSelect
            value={playback.audioQuality}
            onChange={(value) => updatePlayback({ audioQuality: value })}
            options={[
              "Auto",
              "Standard",
              "High",
              "Lossless",
            ]}
            disabled
          />
        </SettingsRow>
        <SettingsSectionTitle
  title="Playback"
  subtitle="Control how videos behave while watching."
/>
        <SettingsRow
          icon={<PlayCircle size={20} />}
          title="Autoplay Next Video"
          description="Not available yet — needs an up-next queue, which the watch page doesn\u2019t have."
        >
          <SettingsToggle
            checked={playback.autoplay}
            onChange={(checked) => updatePlayback({ autoplay: checked })}
            disabled
          />
        </SettingsRow>

        <SettingsRow
          icon={<PictureInPicture2 size={20} />}
          title="Picture in Picture"
          description="Not available yet — your browser\u2019s own picture-in-picture button already does this from the player."
        >
          <SettingsToggle
            checked={playback.pip}
            onChange={(checked) => updatePlayback({ pip: checked })}
            disabled
          />
        </SettingsRow>
        <SettingsSectionTitle
  title="Accessibility"
  subtitle="Captions and accessibility preferences."
/>
        <SettingsRow
          icon={<BadgeHelp size={20} />}
          title="Closed Captions"
          description="Show captions whenever available."
        >
          <SettingsToggle
            checked={playback.captions}
            onChange={(checked) => updatePlayback({ captions: checked })}
          />
        </SettingsRow>
        <SettingsSectionTitle
  title="Data"
  subtitle="Manage data usage."
/>

<SettingsRow
  icon={<Database size={20} />}
  title="Data Saver"
  description="Reduce streaming quality to save mobile data."
>
  <SettingsToggle
    checked={playback.dataSaver}
    onChange={(checked) => updatePlayback({ dataSaver: checked })}
  />
</SettingsRow>

{/* Real, and on by default. VideoPlayer.tsx saves a position per video
    while you watch and offers to resume next time — see
    app/lib/playbackPositions.ts. Turning this off both stops new saves
    and clears everything already stored. */}
<SettingsRow
  icon={<History size={20} />}
  title="Remember playback position"
  description="Pick up long videos where you left off."
>
  <SettingsToggle
    checked={playback.rememberPosition}
    onChange={(checked) => {
      updatePlayback({ rememberPosition: checked });
      // Turning it off has to actually forget what was already saved —
      // otherwise "off" just means "stop adding to the pile", and old
      // positions keep resuming, which is the opposite of what was asked.
      if (!checked) clearAllPlaybackPositions();
    }}
  />
</SettingsRow>

<SettingsRow
  icon={<FastForward size={20} />}
  title="Skip Intro Automatically"
  description="Not available yet — needs automatic intro detection, which nothing generates at upload."
>
  <SettingsToggle
    checked={playback.skipIntro}
    onChange={(checked) => updatePlayback({ skipIntro: checked })}
    disabled
  />
</SettingsRow>

<SettingsRow
  icon={<PlayCircle size={20} />}
  title="Background Playback"
  description="Not available on the web — browsers stop playback when a tab is backgrounded. Planned for the app."
>
  <SettingsToggle
    checked={playback.backgroundPlayback}
    onChange={(checked) => updatePlayback({ backgroundPlayback: checked })}
    disabled
  />
</SettingsRow>

      </div>
    </SettingsCard>
  );
}