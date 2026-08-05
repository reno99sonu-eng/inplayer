"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

// Real "go back" behavior instead of a hardcoded link to "/" — the Terms
// and Privacy pages are opened from lots of places (Settings -> Legal &
// Support, the signup accept/reject panel, footer links, etc.), not just
// the homepage, so this returns to wherever the visitor actually came
// from instead of always dropping them back on the homepage. Only falls
// back to the homepage if there's no in-app history to go back to at all
// (e.g. someone opened this page directly via a shared link).
export default function LegalBackButton() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => {
        if (typeof window !== "undefined" && window.history.length > 1) {
          router.back();
        } else {
          router.push("/");
        }
      }}
      className="inline-flex items-center gap-2 text-sm font-semibold text-slate-400 light:text-slate-600 hover:text-orange-400"
    >
      <ArrowLeft size={16} /> Back
    </button>
  );
}
