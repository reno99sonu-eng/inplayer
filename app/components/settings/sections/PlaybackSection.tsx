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
  Download,
  History,
  FastForward,
} from "lucide-react";

import SettingsCard from "../common/SettingsCard";
import SettingsRow from "../common/SettingsRow";
import SettingsToggle from "../common/SettingsToggle";
import SettingsSelect from "../common/SettingsSelect";
import { useSettings } from "../SettingsProvider";

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
          description="Quality while using mobile data."
        >
          <SettingsSelect
            value={playback.mobileQuality}
            onChange={(value) => updatePlayback({ mobileQuality: value })}
            options={["Auto", "480p", "720p", "1080p"]}
          />
        </SettingsRow>

        <SettingsRow
          icon={<Wifi size={20} />}
          title="Wi-Fi Streaming"
          description="Quality while connected to Wi-Fi."
        >
          <SettingsSelect
            value={playback.wifiQuality}
            onChange={(value) => updatePlayback({ wifiQuality: value })}
            options={["720p", "1080p", "1440p", "Ultra HD (4K)"]}
          />
        </SettingsRow>

        <SettingsRow
          icon={<Volume2 size={20} />}
          title="Audio Quality"
          description="Preferred streaming audio quality."
        >
          <SettingsSelect
            value={playback.audioQuality}
            onChange={(value) => updatePlayback({ audioQuality: value })}
            options={["Auto", "Standard", "High", "Lossless"]}
          />
        </SettingsRow>

        <SettingsSectionTitle
          title="Playback"
          subtitle="Control how videos behave while watching."
        />

        <SettingsRow
          icon={<PlayCircle size={20} />}
          title="Autoplay Next Video"
          description="Automatically continue watching."
        >
          <SettingsToggle
            checked={playback.autoplay}
            onChange={(checked) => updatePlayback({ autoplay: checked })}
          />
        </SettingsRow>

        <SettingsRow
          icon={<PictureInPicture2 size={20} />}
          title="Picture in Picture"
          description="Continue watching while using other apps."
        >
          <SettingsToggle
            checked={playback.pip}
            onChange={(checked) => updatePlayback({ pip: checked })}
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
          subtitle="Manage downloads and data usage."
        />

        <SettingsRow
          icon={<Database size={20} />}
          title="Data Saver"
          description="Reduce streaming quality and skip autoplay previews to save mobile data."
        >
          <SettingsToggle
            checked={playback.dataSaver}
            onChange={(checked) => updatePlayback({ dataSaver: checked })}
          />
        </SettingsRow>

        <SettingsRow
          icon={<History size={20} />}
          title="Remember Playback Position"
          description="Resume videos where you left off."
        >
          <SettingsToggle
            checked={playback.rememberPosition}
            onChange={(checked) => updatePlayback({ rememberPosition: checked })}
          />
        </SettingsRow>

        <SettingsRow
          icon={<FastForward size={20} />}
          title="Skip Intro Automatically"
          description="Skip intros when available."
        >
          <SettingsToggle
            checked={playback.skipIntro}
            onChange={(checked) => updatePlayback({ skipIntro: checked })}
          />
        </SettingsRow>

        <SettingsRow
          icon={<Download size={20} />}
          title="Downloads over Mobile Data"
          description="Allow downloads without Wi-Fi."
        >
          <SettingsToggle
            checked={playback.mobileDownloads}
            onChange={(checked) => updatePlayback({ mobileDownloads: checked })}
          />
        </SettingsRow>

        <SettingsRow
          icon={<PlayCircle size={20} />}
          title="Background Playback"
          description="Continue playing while using other apps."
        >
          <SettingsToggle
            checked={playback.backgroundPlayback}
            onChange={(checked) =>
              updatePlayback({ backgroundPlayback: checked })
            }
          />
        </SettingsRow>

      </div>
    </SettingsCard>
  );
}
