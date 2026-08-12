import { Loader2 } from "lucide-react";

// Automatic Next.js App Router loading UI. app/u/[username]/page.tsx is a
// "use client" page that itself only starts fetching the profile after it
// mounts — without this file, the tap from an avatar/creator-name link
// (the single most common navigation target in the app) showed nothing at
// all during the initial route change, reading as a hang. This shows
// instantly while that RSC shell/client bundle loads, matching the same
// pattern app/shorts/loading.tsx already uses.
export default function ChannelLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Loader2 size={28} className="animate-spin text-orange-400" />
    </div>
  );
}
