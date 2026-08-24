import Link from "next/link";
import { Compass, Home } from "lucide-react";

export const metadata = {
  title: "Page Not Found",
  robots: {
    index: false,
    follow: false,
  },
};

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-orange-500/20 to-amber-500/10 border border-orange-500/30 text-orange-400 mb-6 shadow-xl shadow-orange-500/10">
        <Compass size={40} className="animate-pulse" />
      </div>

      <h1 className="text-4xl sm:text-5xl font-black text-white light:text-slate-900 tracking-tight">
        404
      </h1>

      <h2 className="mt-2 text-xl font-bold text-slate-200 light:text-slate-800">
        Page Not Found
      </h2>

      <p className="mt-2 max-w-md text-sm text-slate-400 light:text-slate-600">
        The page you are looking for doesn&apos;t exist, has been removed, or is temporarily unavailable.
      </p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] px-6 py-3 font-bold text-white shadow-lg shadow-orange-500/25 transition hover:-translate-y-0.5"
        >
          <Home size={18} /> Back to Home
        </Link>
        <Link
          href="/videos"
          className="inline-flex items-center gap-2 rounded-2xl border border-white/10 light:border-black/10 px-6 py-3 font-semibold text-slate-200 light:text-slate-700 transition hover:bg-white/5 light:hover:bg-black/5"
        >
          Explore Videos
        </Link>
      </div>
    </div>
  );
}
