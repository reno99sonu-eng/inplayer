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

// Wired to the real SettingsProvider instead of local-only useState — see
// PrivacySection.tsx for the same fix. Data Saver in particular was the
// most deceptive stub in the app: RecommendationFeed.tsx already reads
// settings.playback.dataSaver for real (to gate autoplaying previews), but
// this toggle never called updatePlayback(), so flipping it on screen had
// zero effect on that downstream behavior. Closed Captions is likewise
// real now (see VideoPlayer.tsx / ShortsPageContent.tsx / live/page.tsx).
//
// The rest of the controls below (quality selects, autoplay, PiP, resume
// position, skip intro, mobile downloads, background playback) would each
// need real player-level engineering — adaptive bitrate selection,
// picture-in-picture wiring, a saved-position store, intro-detection,
// offline downloads, a background-audio session — none of which exist
// yet. Rather than let them keep silently doing nothing when touched,
// they're marked disabled/"Coming soon" here, matching the same honest
// pattern already used for Premium billing (PlansSection.tsx) and the
// removed "Earn Stars" row (GeneralSection.tsx) — no dummy controls that
// look functional but aren't.
export default function PlaybackSection() {
  const { playback, updatePlayback } = useSettings();

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
          title="Mobile Streaming"
          description="Coming soon — quality while using mobile data."
        >
          <SettingsSelect
            value={playback.mobileQuality}
            onChange={(value) => updatePlayback({ mobileQuality: value })}
            options={[
              "Auto",
              "480p",
              "720p",
              "1080p",
            ]}
            disabled
          />
        </SettingsRow>

        <SettingsRow
          icon={<Wifi size={20} />}
          title="Wi-Fi Streaming"
          description="Coming soon — quality while connected to Wi-Fi."
        >
          <SettingsSelect
            value={playback.wifiQuality}
            onChange={(value) => updatePlayback({ wifiQuality: value })}
            options={[
              "720p",
              "1080p",
              "1440p",
              "Ultra HD (4K)",
            ]}
            disabled
          />
        </SettingsRow>

        <SettingsRow
          icon={<Volume2 size={20} />}
          title="Audio Quality"
          description="Coming soon — preferred streaming audio quality."
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
          description="Coming soon — automatically continue watching."
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
          description="Coming soon — continue watching while using other apps."
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

<SettingsRow
  icon={<History size={20} />}
  title="Remember Playback Position"
  description="Coming soon — resume videos where you left off."
>
  <SettingsToggle
    checked={playback.rememberPosition}
    onChange={(checked) => updatePlayback({ rememberPosition: checked })}
    disabled
  />
</SettingsRow>

<SettingsRow
  icon={<FastForward size={20} />}
  title="Skip Intro Automatically"
  description="Coming soon — skip intros when available."
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
  description="Coming soon — continue playing while using other apps."
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