import { Loader2 } from "lucide-react";

// Automatic Next.js App Router loading UI. app/u/[username]/page.tsx is a
// server-rendered ("force-dynamic") page that resolves the channel's
// profile from DynamoDB before it can render anything — this is the
// Suspense fallback Next shows during that brief server-side data fetch,
// same pattern app/watch/[videoId]/loading.tsx and app/shorts/loading.tsx
// already use for their own server-rendered pages.
export default function ChannelLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Loader2 size={28} className="animate-spin text-orange-400" />
    </div>
  );
}
