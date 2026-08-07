import { Metadata } from "next";
import { Globe } from "lucide-react";

export const metadata: Metadata = {
  title: "Region Not Available — INPLAYER",
  description: "InPlayer is currently available only in India.",
};

export default function GeoBlockedPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-[#06101D] px-6 text-center light:bg-[#F5EEDC]">
      <div className="flex h-16 w-16 items-center justify-center rounded-full border border-orange-400/30 bg-orange-500/10">
        <Globe size={28} className="text-orange-300" />
      </div>
      <h1 className="mt-5 text-2xl font-black text-white light:text-slate-900">
        Sorry, we're not available in your region yet
      </h1>
      <p className="mt-2 max-w-sm text-sm text-slate-400 light:text-slate-600">
        InPlayer is currently available only in India. We're working hard to expand to more regions soon.
      </p>
      <p className="mt-8 text-xs text-slate-500 light:text-slate-500">
        If you believe this is an error, please contact support.
      </p>
    </div>
  );
}
