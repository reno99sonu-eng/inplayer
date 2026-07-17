"use client";

import { useState } from "react";
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

export default function PlaybackSection() {
  
  const [mobileQuality, setMobileQuality] = useState("Auto");
  const [wifiQuality, setWifiQuality] = useState("Ultra HD (4K)");
  const [audioQuality, setAudioQuality] = useState("High");
  const [autoplay, setAutoplay] = useState(true);
  const [pip, setPip] = useState(true);
  const [captions, setCaptions] = useState(false);
  const [dataSaver, setDataSaver] = useState(false);
const [backgroundPlayback, setBackgroundPlayback] = useState(true);
const [rememberPosition, setRememberPosition] = useState(true);
const [skipIntro, setSkipIntro] = useState(false);
const [mobileDownloads, setMobileDownloads] = useState(false);

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
            value={mobileQuality}
            onChange={setMobileQuality}
            options={[
              "Auto",
              "480p",
              "720p",
              "1080p",
            ]}
          />
        </SettingsRow>

        <SettingsRow
          icon={<Wifi size={20} />}
          title="Wi-Fi Streaming"
          description="Quality while connected to Wi-Fi."
        >
          <SettingsSelect
            value={wifiQuality}
            onChange={setWifiQuality}
            options={[
              "720p",
              "1080p",
              "1440p",
              "Ultra HD (4K)",
            ]}
          />
        </SettingsRow>

        <SettingsRow
          icon={<Volume2 size={20} />}
          title="Audio Quality"
          description="Preferred streaming audio quality."
        >
          <SettingsSelect
            value={audioQuality}
            onChange={setAudioQuality}
            options={[
              "Auto",
              "Standard",
              "High",
              "Lossless",
            ]}
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
            checked={autoplay}
            onChange={setAutoplay}
          />
        </SettingsRow>

        <SettingsRow
          icon={<PictureInPicture2 size={20} />}
          title="Picture in Picture"
          description="Continue watching while using other apps."
        >
          <SettingsToggle
            checked={pip}
            onChange={setPip}
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
            checked={captions}
            onChange={setCaptions}
          />
        </SettingsRow>
        <SettingsSectionTitle
  title="Data"
  subtitle="Manage downloads and data usage."
/>

<SettingsRow
  icon={<Database size={20} />}
  title="Data Saver"
  description="Reduce streaming quality to save mobile data."
>
  <SettingsToggle
    checked={dataSaver}
    onChange={setDataSaver}
  />
</SettingsRow>

<SettingsRow
  icon={<History size={20} />}
  title="Remember Playback Position"
  description="Resume videos where you left off."
>
  <SettingsToggle
    checked={rememberPosition}
    onChange={setRememberPosition}
  />
</SettingsRow>

<SettingsRow
  icon={<FastForward size={20} />}
  title="Skip Intro Automatically"
  description="Skip intros when available."
>
  <SettingsToggle
    checked={skipIntro}
    onChange={setSkipIntro}
  />
</SettingsRow>

<SettingsRow
  icon={<Download size={20} />}
  title="Downloads over Mobile Data"
  description="Allow downloads without Wi-Fi."
>
  <SettingsToggle
    checked={mobileDownloads}
    onChange={setMobileDownloads}
  />
</SettingsRow>

<SettingsRow
  icon={<PlayCircle size={20} />}
  title="Background Playback"
  description="Continue playing while using other apps."
>
  <SettingsToggle
    checked={backgroundPlayback}
    onChange={setBackgroundPlayback}
  />
</SettingsRow>

      </div>
    </SettingsCard>
  );
}