import type { Metadata } from "next";
import Link from "next/link";
import { Sparkles, ShieldCheck, Film, Users, Award, HeartHandshake, ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "About InPlayer — Entertainment Beyond Limits",
  description:
    "Learn about InPlayer, India's next-generation streaming and creator-first entertainment platform owned and operated by Homox Prime Pvt Ltd.",
  alternates: {
    canonical: "https://inplayer.in/about",
  },
  openGraph: {
    title: "About InPlayer — Entertainment Beyond Limits",
    description:
      "InPlayer is a creator-first entertainment platform for streaming videos, music, and shorts, built for lightning-fast performance and creator empowerment.",
    url: "https://inplayer.in/about",
    siteName: "InPlayer",
    locale: "en_IN",
    type: "website",
  },
};

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-[#06101D] light:bg-[#FAF5E9] text-white light:text-slate-900 pt-6 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        {/* Breadcrumb navigation */}
        <nav className="flex items-center gap-2 text-xs text-slate-400 light:text-slate-600 mb-6">
          <Link href="/" className="hover:text-orange-400 transition">
            Home
          </Link>
          <span>/</span>
          <span className="text-orange-400 font-semibold">About Us</span>
        </nav>

        {/* Hero Banner */}
        <div className="relative overflow-hidden rounded-3xl border border-white/10 light:border-black/10 bg-gradient-to-br from-white/[0.04] to-white/[0.01] light:from-black/[0.02] light:to-black/[0.005] p-8 sm:p-12 mb-10 shadow-2xl">
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-orange-500/15 blur-3xl" />
          <div className="absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-indigo-500/15 blur-3xl" />

          <div className="relative z-10 max-w-2xl">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1 text-xs font-black uppercase tracking-wider text-orange-300">
              <Sparkles size={13} /> The Future of Entertainment
            </span>
            <h1 className="mt-4 text-3xl sm:text-5xl font-black tracking-tight text-white light:text-slate-900 leading-tight">
              Entertainment Beyond Limits.
            </h1>
            <p className="mt-4 text-sm sm:text-base leading-relaxed text-slate-300 light:text-slate-700">
              InPlayer is a next-generation, creator-first digital entertainment platform. We unite high-definition streaming, interactive short-form videos, independent music, and gaming into one cohesive, lightning-fast digital destination.
            </p>
          </div>
        </div>

        {/* Core Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-12">
          <div className="rounded-2xl border border-white/10 light:border-black/10 bg-white/[0.02] light:bg-black/[0.01] p-6">
            <div className="h-10 w-10 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center mb-4">
              <Film size={20} />
            </div>
            <h3 className="text-base font-bold text-white light:text-slate-900 mb-2">
              High-Fidelity Streaming
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 light:text-slate-600 leading-relaxed">
              Designed with cutting-edge edge distribution, adaptive bitrate transcoding, and ultra-low latency playback across web, tablet, and mobile devices.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 light:border-black/10 bg-white/[0.02] light:bg-black/[0.01] p-6">
            <div className="h-10 w-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center mb-4">
              <Users size={20} />
            </div>
            <h3 className="text-base font-bold text-white light:text-slate-900 mb-2">
              Creator-First Economy
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 light:text-slate-600 leading-relaxed">
              Transparent, competitive revenue sharing for independent filmmakers, musicians, and creators with integrated analytics, sponsorship matchmaking, and direct monetization.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 light:border-black/10 bg-white/[0.02] light:bg-black/[0.01] p-6">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-4">
              <ShieldCheck size={20} />
            </div>
            <h3 className="text-base font-bold text-white light:text-slate-900 mb-2">
              Trust & Safety
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 light:text-slate-600 leading-relaxed">
              Engineered with advanced automated moderation, strict child-safety protections, and rigorous compliance with Indian digital media ethics guidelines.
            </p>
          </div>
        </div>

        {/* Corporate & Publisher Disclosures */}
        <section className="rounded-3xl border border-white/10 light:border-black/10 bg-white/[0.02] light:bg-black/[0.01] p-8 sm:p-10 space-y-6 mb-12">
          <h2 className="text-xl sm:text-2xl font-black text-white light:text-slate-900 flex items-center gap-2">
            <Award size={22} className="text-orange-400" />
            Corporate & Editorial Disclosure
          </h2>
          <div className="space-y-4 text-xs sm:text-sm leading-relaxed text-slate-300 light:text-slate-700">
            <p>
              InPlayer (<Link href="https://inplayer.in" className="text-orange-400 hover:underline">inplayer.in</Link>) is owned, developed, and operated by <strong>Homox Prime Pvt Ltd</strong>, a private limited company incorporated under the laws of the Republic of India.
            </p>
            <p>
              Our mission is to democratize digital broadcasting for Indian creators while offering viewers a clutter-free, high-performance entertainment alternative. We operate in strict compliance with the <em>Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021</em>, ensuring safe hosting, rapid notice-and-takedown procedures, and robust consumer grievance redressal.
            </p>
          </div>

          <div className="border-t border-white/10 light:border-black/10 pt-6 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-slate-500 block uppercase font-bold text-[10px] tracking-wider">Company</span>
              <span className="font-semibold text-white light:text-slate-900">Homox Prime Pvt Ltd</span>
            </div>
            <div>
              <span className="text-slate-500 block uppercase font-bold text-[10px] tracking-wider">Primary Operations</span>
              <span className="font-semibold text-white light:text-slate-900">Digital Streaming & Content Distribution</span>
            </div>
            <div>
              <span className="text-slate-500 block uppercase font-bold text-[10px] tracking-wider">Official Email</span>
              <span className="font-semibold text-white light:text-slate-900">inplayerdigital@gmail.com</span>
            </div>
            <div>
              <span className="text-slate-500 block uppercase font-bold text-[10px] tracking-wider">Grievance Redressal</span>
              <span className="font-semibold text-white light:text-slate-900">support@inplayer.in</span>
            </div>
          </div>
        </section>

        {/* Trust & Policy Quick Links */}
        <section className="rounded-3xl border border-white/10 light:border-black/10 bg-white/[0.02] light:bg-black/[0.01] p-8 sm:p-10 space-y-6">
          <h2 className="text-xl sm:text-2xl font-black text-white light:text-slate-900 flex items-center gap-2">
            <HeartHandshake size={22} className="text-indigo-400" />
            Policies & Standards
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 light:text-slate-600">
            InPlayer maintains a transparent relationship with our users, partners, and creators through comprehensive legal documentation:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <Link
              href="/terms"
              className="flex items-center justify-between p-4 rounded-xl border border-white/10 light:border-black/10 bg-white/5 light:bg-black/5 hover:border-orange-400/30 hover:bg-white/10 transition group text-xs font-bold"
            >
              <span>Terms of Service</span>
              <ArrowRight size={14} className="text-slate-400 group-hover:text-orange-400 group-hover:translate-x-0.5 transition" />
            </Link>

            <Link
              href="/privacy"
              className="flex items-center justify-between p-4 rounded-xl border border-white/10 light:border-black/10 bg-white/5 light:bg-black/5 hover:border-orange-400/30 hover:bg-white/10 transition group text-xs font-bold"
            >
              <span>Privacy Policy</span>
              <ArrowRight size={14} className="text-slate-400 group-hover:text-orange-400 group-hover:translate-x-0.5 transition" />
            </Link>

            <Link
              href="/community-guidelines"
              className="flex items-center justify-between p-4 rounded-xl border border-white/10 light:border-black/10 bg-white/5 light:bg-black/5 hover:border-orange-400/30 hover:bg-white/10 transition group text-xs font-bold"
            >
              <span>Community Guidelines</span>
              <ArrowRight size={14} className="text-slate-400 group-hover:text-orange-400 group-hover:translate-x-0.5 transition" />
            </Link>

            <Link
              href="/copyright"
              className="flex items-center justify-between p-4 rounded-xl border border-white/10 light:border-black/10 bg-white/5 light:bg-black/5 hover:border-orange-400/30 hover:bg-white/10 transition group text-xs font-bold"
            >
              <span>Copyright & DMCA Policy</span>
              <ArrowRight size={14} className="text-slate-400 group-hover:text-orange-400 group-hover:translate-x-0.5 transition" />
            </Link>

            <Link
              href="/child-safety"
              className="flex items-center justify-between p-4 rounded-xl border border-white/10 light:border-black/10 bg-white/5 light:bg-black/5 hover:border-orange-400/30 hover:bg-white/10 transition group text-xs font-bold"
            >
              <span>Child Safety Policy</span>
              <ArrowRight size={14} className="text-slate-400 group-hover:text-orange-400 group-hover:translate-x-0.5 transition" />
            </Link>

            <Link
              href="/contact"
              className="flex items-center justify-between p-4 rounded-xl border border-white/10 light:border-black/10 bg-white/5 light:bg-black/5 hover:border-orange-400/30 hover:bg-white/10 transition group text-xs font-bold"
            >
              <span>Contact Us & Support</span>
              <ArrowRight size={14} className="text-slate-400 group-hover:text-orange-400 group-hover:translate-x-0.5 transition" />
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
