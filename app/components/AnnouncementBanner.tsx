"use client";

import { useEffect, useState } from "react";
import { X, Megaphone } from "lucide-react";
import { usePlatformSettings } from "@/app/hooks/usePlatformSettings";

const DISMISS_KEY_PREFIX = "inplayer-announcement-dismissed:";

// Real site-wide banner, toggled from Admin Panel -> Platform Settings —
// e.g. "Paid memberships are live" or a scheduled-downtime notice. Keyed
// by the announcement's own text so a dismissal only ever hides THAT
// specific message: change the text in Settings and every visitor sees
// the new one again, even if they dismissed an older one.
export default function AnnouncementBanner() {
  const { settings } = usePlatformSettings();
  const [dismissed, setDismissed] = useState(false);

  const text = settings?.announcementText || "";
  const active = Boolean(settings?.announcementEnabled) && text.trim().length > 0;

  useEffect(() => {
    if (!active) return;
    const readDismissed = () => {
      try {
        setDismissed(localStorage.getItem(DISMISS_KEY_PREFIX + text) === "1");
      } catch {
        setDismissed(false);
      }
    };
    readDismissed();
  }, [active, text]);

  if (!active || dismissed) return null;

  return (
    <div className="flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500/90 to-amber-400/90 px-4 py-2 text-center text-xs font-semibold text-white">
      <Megaphone size={13} className="flex-shrink-0" />
      <span>{text}</span>
      <button
        type="button"
        onClick={() => {
          try {
            localStorage.setItem(DISMISS_KEY_PREFIX + text, "1");
          } catch {
            /* ignore — dismissal just won't persist across reloads */
          }
          setDismissed(true);
        }}
        className="ml-1 flex-shrink-0 rounded-full p-0.5 transition hover:bg-white/20"
        aria-label="Dismiss announcement"
      >
        <X size={13} />
      </button>
    </div>
  );
}
