import { Loader2 } from "lucide-react";

// Automatic Next.js App Router loading UI for the /shorts (Raftaar)
// segment. app/shorts/page.tsx is `export const dynamic = "force-dynamic"`
// and awaits a real DynamoDB read (getReadyVideos + resolveUsernames)
// before it can render anything at all — without this file, tapping
// "Raftaar" from the bottom nav left the screen looking frozen/unresponsive
// for however long that read takes, since Next has no fallback to show in
// the meantime. This mirrors the same pattern app/page.tsx already uses
// (its own <Suspense> around HomeContent) so the tap feels instant even
// though the real feed still takes the same time to actually load.
export default function ShortsLoading() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-black light:bg-[#F4ECDA]">
      <Loader2 size={28} className="animate-spin text-orange-400" />
    </div>
  );
}
