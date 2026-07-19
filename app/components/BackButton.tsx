"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export default function BackButton() {
  const router = useRouter();

  return (
    <button
      onClick={() => router.back()}
      className="
        mb-4 flex items-center gap-2
        text-sm font-semibold
        text-slate-300 light:text-slate-700
        transition hover:text-orange-300 light:hover:text-orange-600
      "
    >
      <ArrowLeft size={18} />
      Back
    </button>
  );
}
