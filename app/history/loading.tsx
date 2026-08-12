import { Loader2 } from "lucide-react";

// See app/shorts/loading.tsx for why this exists.
export default function HistoryLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Loader2 size={28} className="animate-spin text-orange-400" />
    </div>
  );
}
