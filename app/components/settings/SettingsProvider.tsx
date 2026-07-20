"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";

// Every real, working setting the Settings page controls, in one place —
// same pattern as ThemeProvider (see app/components/ThemeProvider.tsx):
// persisted to localStorage, hydrated on mount, read by any component in
// the app via useSettings(). This is what makes toggles/selects in the
// Settings page actually mean something instead of resetting to their
// defaults on every navigation or refresh.

export interface GeneralSettings {
  language: string;
  restrictedMode: boolean;
  childMode: boolean;
}

export interface PlaybackSettings {
  mobileQuality: string;
  wifiQuality: string;
  audioQuality: string;
  autoplay: boolean;
  pip: boolean;
  captions: boolean;
  dataSaver: boolean;
  rememberPosition: boolean;
  skipIntro: boolean;
  mobileDownloads: boolean;
  backgroundPlayback: boolean;
}

export interface PrivacySettings {
  privateAccount: boolean;
  watchHistory: boolean;
  personalizedAds: boolean;
  biometricLogin: boolean;
}

interface SettingsState {
  general: GeneralSettings;
  playback: PlaybackSettings;
  privacy: PrivacySettings;
}

const DEFAULTS: SettingsState = {
  general: {
    language: "English",
    restrictedMode: false,
    childMode: false,
  },
  playback: {
    mobileQuality: "Auto",
    wifiQuality: "Ultra HD (4K)",
    audioQuality: "High",
    autoplay: true,
    pip: true,
    captions: false,
    dataSaver: false,
    rememberPosition: true,
    skipIntro: false,
    mobileDownloads: false,
    backgroundPlayback: true,
  },
  privacy: {
    privateAccount: false,
    watchHistory: true,
    personalizedAds: true,
    biometricLogin: true,
  },
};

const STORAGE_KEY = "inplayer-settings";

interface SettingsContextValue extends SettingsState {
  // True once localStorage has been read on mount — lets consumers avoid
  // acting on a default value for a single frame before hydration.
  ready: boolean;
  updateGeneral: (patch: Partial<GeneralSettings>) => void;
  updatePlayback: (patch: Partial<PlaybackSettings>) => void;
  updatePrivacy: (patch: Partial<PrivacySettings>) => void;
}

const SettingsContext = createContext<SettingsContextValue | undefined>(
  undefined
);

function loadSettings(): SettingsState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;

    const parsed = JSON.parse(raw);

    return {
      general: { ...DEFAULTS.general, ...parsed.general },
      playback: { ...DEFAULTS.playback, ...parsed.playback },
      privacy: { ...DEFAULTS.privacy, ...parsed.privacy },
    };
  } catch {
    return DEFAULTS;
  }
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SettingsState>(DEFAULTS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setState(loadSettings());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, ready]);

  const updateGeneral = (patch: Partial<GeneralSettings>) =>
    setState((prev) => ({
      ...prev,
      general: { ...prev.general, ...patch },
    }));

  const updatePlayback = (patch: Partial<PlaybackSettings>) =>
    setState((prev) => ({
      ...prev,
      playback: { ...prev.playback, ...patch },
    }));

  const updatePrivacy = (patch: Partial<PrivacySettings>) =>
    setState((prev) => ({
      ...prev,
      privacy: { ...prev.privacy, ...patch },
    }));

  return (
    <SettingsContext.Provider
      value={{
        ...state,
        ready,
        updateGeneral,
        updatePlayback,
        updatePrivacy,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);

  if (!context) {
    throw new Error("useSettings must be used inside SettingsProvider");
  }

  return context;
}
