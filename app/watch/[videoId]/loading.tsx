import { Loader2 } from "lucide-react";

// See app/shorts/loading.tsx for why this exists. app/watch/[videoId]/page.tsx
// is `export const dynamic = "force-dynamic"` and does a real DynamoDB read
// before it can render — without this, clicking any video thumbnail left
// the screen looking frozen for however long that read takes.
export default function WatchLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Loader2 size={28} className="animate-spin text-orange-400" />
    </div>
  );
}
