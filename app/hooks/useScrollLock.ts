"use client";

import { useEffect } from "react";

// Shared, reference-counted page-scroll lock. Multiple independent
// overlays — SplashScreen on every fresh load, AnnouncementBanner whenever
// an announcement is on — can each want the page non-scrollable at
// overlapping times (the splash curtain and a same-load announcement
// takeover can both be up at once, racing against each other on network/
// timer timing).
//
// Each one previously saved/restored document.body.style.overflow (and
// html's) independently. That's a real bug when two lockers overlap:
// whichever mounts SECOND reads the FIRST one's already-"hidden" value as
// its own "previous" value, so when the SECOND one releases first it
// "restores" scroll back to hidden instead of the true original value —
// leaving the page stuck unscrollable even after both overlays are gone
// and the site otherwise looks completely normal. This is exactly the
// "homepage stopped scrolling" bug Reno hit once the announcement takeover
// could show on every load instead of only a visitor's very first ever
// visit.
//
// A shared count fixes it structurally: scroll only actually locks on the
// 0->1 transition and only actually unlocks on the ->0 transition, so it's
// immune to how many lockers are stacked or in what order they mount and
// unmount.
let lockCount = 0;

function lockScroll() {
  if (lockCount === 0) {
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
  }
  lockCount += 1;
}

function unlockScroll() {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) {
    document.body.style.overflow = "";
    document.documentElement.style.overflow = "";
  }
}

// Call with `true` for as long as the calling component wants the page
// non-scrollable. Safe to use from any number of components at once.
export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    lockScroll();
    return () => unlockScroll();
  }, [active]);
}
