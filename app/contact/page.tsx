import type { Metadata } from "next";
import Link from "next/link";
import { Mail, Phone, MapPin, ShieldAlert, Sparkles, MessageSquare, Clock } from "lucide-react";

export const metadata: Metadata = {
  title: "Contact Us — InPlayer Official Support & Inquiries",
  description:
    "Get in touch with the InPlayer team, customer support, business sponsorships, and grievance officer at Homox Prime Pvt Ltd.",
  alternates: {
    canonical: "https://inplayer.in/contact",
  },
  openGraph: {
    title: "Contact Us — InPlayer Official Support & Inquiries",
    description:
      "Official contact directory for InPlayer streaming platform, Hammart, MillonBook, brand sponsorships, and consumer support.",
    url: "https://inplayer.in/contact",
    siteName: "InPlayer",
    locale: "en_IN",
    type: "website",
  },
};

export default function ContactPage() {
  const departments = [
    {
      title: "General & Technical Support",
      description: "Account access, streaming errors, bug reports, and billing support.",
      email: "support@inplayer.in",
      altEmail: "inplayerdigital@gmail.com",
      badge: "User Helpdesk",
    },
    {
      title: "Brand Sponsorships & Advertising",
      description: "Homepage, watch page banners, mid-roll ad campaigns, and brand partnerships.",
      email: "Sponsor@inplayer.in",
      badge: "Advertising",
    },
    {
      title: "MillonBook & Creator Community",
      description: "Creator onboarding, publishing partnerships, and creator studio inquiries.",
      email: "Millonbook@inplayer.in",
      badge: "Creators",
    },
    {
      title: "HamMart Marketplace & Vendors",
      description: "Vendor terms, product listing inquiries, order fulfillment, and merchant support.",
      email: "Hammart@inplayer.in",
      badge: "Commerce",
    },
  ];

  return (
    <main className="min-h-screen bg-[#06101D] light:bg-[#FAF5E9] text-white light:text-slate-900 pt-6 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        {/* Breadcrumb navigation */}
        <nav className="flex items-center gap-2 text-xs text-slate-400 light:text-slate-600 mb-6">
          <Link href="/" className="hover:text-orange-400 transition">
            Home
          </Link>
          <span>/</span>
          <span className="text-orange-400 font-semibold">Contact Us</span>
        </nav>

        {/* Hero Section */}
        <div className="relative overflow-hidden rounded-3xl border border-white/10 light:border-black/10 bg-gradient-to-br from-white/[0.04] to-white/[0.01] light:from-black/[0.02] light:to-black/[0.005] p-8 sm:p-12 mb-10 shadow-2xl">
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-orange-500/15 blur-3xl" />
          <div className="absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-indigo-500/15 blur-3xl" />

          <div className="relative z-10 max-w-2xl">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1 text-xs font-black uppercase tracking-wider text-orange-300">
              <MessageSquare size={13} /> Support & Communication
            </span>
            <h1 className="mt-4 text-3xl sm:text-5xl font-black tracking-tight text-white light:text-slate-900 leading-tight">
              Get in Touch with InPlayer.
            </h1>
            <p className="mt-4 text-sm sm:text-base leading-relaxed text-slate-300 light:text-slate-700">
              Whether you are a creator seeking partnership, an advertiser looking for custom placements, or a viewer needing technical help, our dedicated team is here to assist you.
            </p>
          </div>
        </div>

        {/* Department Directory */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-12">
          {departments.map((dept) => (
            <div
              key={dept.email}
              className="rounded-2xl border border-white/10 light:border-black/10 bg-white/[0.02] light:bg-black/[0.01] p-6 flex flex-col justify-between hover:border-orange-500/30 transition"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="rounded-md bg-orange-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-orange-400">
                    {dept.badge}
                  </span>
                  <Mail size={16} className="text-slate-400" />
                </div>
                <h3 className="text-base font-bold text-white light:text-slate-900 mb-2">
                  {dept.title}
                </h3>
                <p className="text-xs text-slate-400 light:text-slate-600 leading-relaxed mb-4">
                  {dept.description}
                </p>
              </div>

              <div className="pt-4 border-t border-white/10 light:border-black/10 space-y-1">
                <a
                  href={`mailto:${dept.email}`}
                  className="block text-xs sm:text-sm font-semibold text-orange-400 hover:underline break-all"
                >
                  {dept.email}
                </a>
                {dept.altEmail && (
                  <a
                    href={`mailto:${dept.altEmail}`}
                    className="block text-xs text-slate-400 hover:text-slate-200 hover:underline break-all"
                  >
                    Secondary: {dept.altEmail}
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Response Times & Availability */}
        <div className="rounded-2xl border border-white/10 light:border-black/10 bg-white/[0.02] light:bg-black/[0.01] p-6 mb-12 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-orange-500/10 text-orange-400 flex items-center justify-center">
              <Clock size={20} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white light:text-slate-900">Standard Response SLA</h4>
              <p className="text-xs text-slate-400 light:text-slate-600">
                Our customer desk responds to all inquiries within 24 to 48 business hours.
              </p>
            </div>
          </div>
          <div className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-3.5 py-1">
            Desk Operational · Mon–Sat
          </div>
        </div>

        {/* Grievance Redressal & Legal Notice (IT Rules, 2021) */}
        <section className="rounded-3xl border border-white/10 light:border-black/10 bg-white/[0.02] light:bg-black/[0.01] p-8 sm:p-10 space-y-6">
          <div className="flex items-center gap-2 text-rose-400">
            <ShieldAlert size={22} />
            <h2 className="text-xl sm:text-2xl font-black text-white light:text-slate-900">
              Grievance Officer & Legal Notice
            </h2>
          </div>

          <p className="text-xs sm:text-sm text-slate-300 light:text-slate-700 leading-relaxed">
            In compliance with the <em>Information Technology Act, 2000</em> and the <em>Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021</em>, users and rights-holders may address formal grievances, copyright claims, or compliance issues directly to our designated Grievance Officer:
          </p>

          <div className="rounded-2xl border border-white/10 light:border-black/10 bg-white/5 light:bg-black/5 p-5 space-y-3 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <span className="text-slate-500 block uppercase font-bold text-[10px] tracking-wider">Corporate Entity</span>
                <span className="font-semibold text-white light:text-slate-900">Homox Prime Pvt Ltd</span>
              </div>
              <div>
                <span className="text-slate-500 block uppercase font-bold text-[10px] tracking-wider">Grievance Email</span>
                <a href="mailto:support@inplayer.in" className="font-semibold text-orange-400 hover:underline">
                  support@inplayer.in
                </a>
              </div>
              <div>
                <span className="text-slate-500 block uppercase font-bold text-[10px] tracking-wider">Designation</span>
                <span className="font-semibold text-white light:text-slate-900">Grievance Redressal Officer</span>
              </div>
              <div>
                <span className="text-slate-500 block uppercase font-bold text-[10px] tracking-wider">Jurisdiction</span>
                <span className="font-semibold text-white light:text-slate-900">India</span>
              </div>
            </div>
            <p className="text-[11px] text-slate-400 light:text-slate-600 pt-2 border-t border-white/10 light:border-black/10">
              All formal complaints will be acknowledged within 24 hours and redressed within 15 days in accordance with applicable statutory timelines.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
