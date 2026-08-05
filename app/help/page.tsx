"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, ChevronDown, Mail } from "lucide-react";

const faqs = [
  {
    q: "Can I download videos to watch offline?",
    a: "Yes, look for the Download option on any title's details page. Downloaded content will appear under Downloads in your profile.",
  },
  {
    q: "I found a bug or playback issue, what do I do?",
    a: "Please reach out to our support team using the contact option below with details about the issue and your device.",
  },
];

export default function HelpPage() {
  const router = useRouter();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-[#06101D] light:bg-[#FAF5E9] text-white light:text-slate-900">
      <div className="flex items-center gap-4 border-b border-white/10 light:border-black/10 px-5 py-5">
        <button
          onClick={() => router.back()}
          className="
            flex
            h-10
            w-10
            items-center
            justify-center
            rounded-full
            border
            border-white/10
            light:border-black/10
            bg-white/5
            light:bg-black/5
            transition-all
            duration-200
            hover:bg-white/15
            light:hover:bg-black/10
          "
        >
          <ArrowLeft size={20} />
        </button>

        <h1 className="text-lg font-black">Help & Support</h1>
      </div>

      <div className="mx-auto max-w-2xl px-5 py-8">
        <h2 className="mb-4 text-xs font-bold uppercase tracking-[0.25em] text-orange-300/80 light:text-orange-600/90">
          Frequently Asked Questions
        </h2>

        <div className="space-y-3">
          {faqs.map((item, index) => {
            const isOpen = openIndex === index;

            return (
              <div
                key={item.q}
                className="overflow-hidden rounded-2xl border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.03]"
              >
                <button
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  className="flex w-full items-center justify-between px-5 py-4 text-left"
                >
                  <span className="font-semibold text-white light:text-slate-900">{item.q}</span>
                  <ChevronDown
                    size={18}
                    className={`shrink-0 text-orange-300 light:text-orange-600 transition-transform duration-200 ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {isOpen && (
                  <p className="border-t border-white/10 light:border-black/10 px-5 py-4 text-sm leading-6 text-slate-400 light:text-slate-600">
                    {item.a}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-8 rounded-2xl border border-orange-400/20 light:border-orange-500/25 bg-orange-500/5 light:bg-orange-500/10 p-5">
          <p className="mb-3 text-sm text-slate-300 light:text-slate-700">
            Still need help? Reach out to our support team directly.
          </p>
          <a
            href="mailto:support@inplayer.in"
            className="
              inline-flex
              items-center
              gap-2
              rounded-full
              bg-gradient-to-r
              from-orange-500
              to-amber-400
              px-5
              py-2.5
              text-sm
              font-bold
              text-white
              transition
              hover:scale-105
            "
          >
            <Mail size={16} />
            support@inplayer.in
          </a>
        </div>
      </div>
    </div>
  );
}
