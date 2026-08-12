import { Loader2 } from "lucide-react";

// See app/shorts/loading.tsx for why this exists — without a route-level
// loading UI, Next.js shows nothing at all during the server round trip,
// which reads as the click having done nothing.
export default function VideosLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Loader2 size={28} className="animate-spin text-orange-400" />
    </div>
  );
}
