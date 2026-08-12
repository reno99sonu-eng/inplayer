"use client";

import { ReactNode, useState } from "react";
import {
  Sparkles,
  ChevronDown,
  IndianRupee,
  TrendingUp,
  ShieldCheck,
  Landmark,
  Clock,
  HelpCircle,
} from "lucide-react";
import {
  ELIGIBILITY_THRESHOLD,
  PAYOUT_FREQUENCIES,
  MIN_PAYOUT_AMOUNT_BOUNDS,
} from "@/app/lib/creatorPayouts";

// The real, currently-live monetization flow — pulled from the same
// constants app/components/analytics/RevenueSection.tsx and KycForm.tsx
// use, so this answer can never quietly drift out of sync with what the
// Revenue & KYC panel actually does.
function MonetizationAnswer() {
  const steps: { icon: ReactNode; title: string; body: string }[] = [
    {
      icon: <TrendingUp size={15} />,
      title: "Grow your channel",
      body: `Upload videos and Raftaar reels to build an audience. Monetization requires ${ELIGIBILITY_THRESHOLD.subscribers} In-Family members, ${ELIGIBILITY_THRESHOLD.videoViews.toLocaleString()} views for longform videos, or 1,000,000 (1 Million) views for Raftaar reels.`,
    },
    {
      icon: <ShieldCheck size={15} />,
      title: "Complete a short KYC",
      body: "A quick identity and eligibility check — legal name, PAN, and address. We never collect your bank details directly through this form.",
    },
    {
      icon: <Clock size={15} />,
      title: "Set your payout schedule",
      body: `Once you're verified, choose how often you're paid (${PAYOUT_FREQUENCIES.join(", ")}) and the minimum balance to hold before paying it out — anywhere from ₹${MIN_PAYOUT_AMOUNT_BOUNDS.min} to ₹${MIN_PAYOUT_AMOUNT_BOUNDS.max.toLocaleString()}.`,
    },
    {
      icon: <Landmark size={15} />,
      title: "Connect your bank account",
      body: "Bank linking happens securely through Razorpay (coming soon) — your balance then pays out automatically on the schedule you set, once InPlayer's ad/revenue-share is switched on.",
    },
  ];

  return (
    <div className="space-y-0">
      {steps.map((step, i) => (
        <div key={step.title} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-500/20 to-amber-400/10 text-orange-400">
              {step.icon}
            </div>
            {i < steps.length - 1 && (
              <div className="my-1 w-px flex-1 bg-white/10 light:bg-black/10" />
            )}
          </div>
          <div className="pb-3.5">
            <p className="text-sm font-bold text-white light:text-slate-900">
              {step.title}
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-400 light:text-slate-600">
              {step.body}
            </p>
          </div>
        </div>
      ))}
      <p className="text-[11px] leading-relaxed text-slate-500">
        This is the real, currently-live flow — see it in action any time in
        the Revenue &amp; KYC panel on the Videos and Shorts tabs.
      </p>
    </div>
  );
}

// The trending-banner/hero-content placement question doesn't have a
// published answer yet — this is an explicit, clearly-labeled placeholder
// rather than a guess, so it can be swapped for the real criteria later
// without misleading anyone in the meantime.
function TrendingPlaceholderAnswer() {
  return (
    <div className="rounded-xl border border-dashed border-amber-400/25 bg-amber-500/[0.05] p-3">
      <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-amber-400">
        <HelpCircle size={13} /> Coming soon
      </p>
      <p className="mt-1.5 text-xs leading-relaxed text-slate-400 light:text-slate-600">
        We&apos;re still finalizing the exact criteria for hero/trending
        banner placement. This answer will be published here as soon as
        it&apos;s ready — in the meantime, reach out through Support in the
        navbar footer if you have questions.
      </p>
    </div>
  );
}

interface QAItem {
  id: string;
  question: string;
  icon: ReactNode;
  placeholder?: boolean;
  render: () => ReactNode;
}

const QA_ITEMS: QAItem[] = [
  {
    id: "monetization",
    question: "How do your videos get monetized?",
    icon: <IndianRupee size={16} />,
    render: () => <MonetizationAnswer />,
  },
  {
    id: "trending",
    question: "How do you put your video in the trending banner (hero content)?",
    icon: <Sparkles size={16} />,
    placeholder: true,
    render: () => <TrendingPlaceholderAnswer />,
  },
];

// Third tab on Your Channel — a short, real Q&A about how InPlayer works,
// requested alongside the Videos/Shorts tabs. Presented as an animated
// accordion (CSS transitions, not actual GIF files) so it fits the app's
// existing motion language instead of shipping placeholder media.
export default function HowInPlayerWorks() {
  const [openId, setOpenId] = useState<string | null>(QA_ITEMS[0].id);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 rounded-2xl border border-white/10 light:border-black/10 bg-gradient-to-br from-orange-500/[0.06] to-transparent p-4 sm:p-5">
        <div className="relative flex h-11 w-11 flex-shrink-0 items-center justify-center">
          <div className="absolute inset-0 animate-ping rounded-full bg-orange-400/20" />
          <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] text-white shadow-[0_10px_25px_rgba(255,153,0,.3)]">
            <Sparkles size={18} />
          </div>
        </div>
        <div>
          <h3 className="text-sm font-bold text-white light:text-slate-900">
            How InPlayer Works
          </h3>
          <p className="text-xs text-slate-400 light:text-slate-600">
            Answers to the questions creators ask us most.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {QA_ITEMS.map((item) => {
          const isOpen = openId === item.id;
          return (
            <div
              key={item.id}
              className="overflow-hidden rounded-2xl border border-white/10 light:border-black/10 bg-white/[0.02] light:bg-black/[0.02]"
            >
              <button
                type="button"
                onClick={() => setOpenId(isOpen ? null : item.id)}
                aria-expanded={isOpen}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
              >
                <div
                  className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full transition-colors duration-300 ${
                    isOpen
                      ? "bg-gradient-to-br from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] text-white"
                      : "bg-white/5 light:bg-black/5 text-orange-400"
                  }`}
                >
                  {item.icon}
                </div>
                <span className="flex-1 text-sm font-bold text-white light:text-slate-900">
                  {item.question}
                </span>
                {item.placeholder && !isOpen && (
                  <span className="flex-shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-400">
                    Soon
                  </span>
                )}
                <ChevronDown
                  size={16}
                  className={`flex-shrink-0 text-slate-500 transition-transform duration-300 ${
                    isOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              <div
                className={`grid overflow-hidden transition-all duration-300 ${
                  isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                }`}
              >
                <div className="min-h-0">
                  <div className="px-4 pb-4 pt-0.5">{item.render()}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
