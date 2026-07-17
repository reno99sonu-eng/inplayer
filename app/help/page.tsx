"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, ChevronDown, Mail } from "lucide-react";

const faqs = [
  {
    q: "How do I cancel my Premium subscription?",
    a: "Go to Settings from your profile menu, then look for the subscription section to manage or cancel your plan at any time.",
  },
  {
    q: "Can I download videos to watch offline?",
    a: "Yes, look for the Download option on any title's details page. Downloaded content will appear under Downloads in your profile.",
  },
  {
    q: "How many devices can I use at once?",
    a: "Premium members can stream on up to 4 devices simultaneously, depending on your plan.",
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
    <div className="min-h-screen bg-[#06101D] text-white">
      <div className="flex items-center gap-4 border-b border-white/10 px-5 py-5">
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
            bg-white/5
            transition-all
            duration-200
            hover:bg-white/15
          "
        >
          <ArrowLeft size={20} />
        </button>

        <h1 className="text-lg font-black">Help & Support</h1>
      </div>

      <div className="mx-auto max-w-2xl px-5 py-8">
        <h2 className="mb-4 text-xs font-bold uppercase tracking-[0.25em] text-orange-300/80">
          Frequently Asked Questions
        </h2>

        <div className="space-y-3">
          {faqs.map((item, index) => {
            const isOpen = openIndex === index;

            return (
              <div
                key={item.q}
                className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]"
              >
                <button
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  className="flex w-full items-center justify-between px-5 py-4 text-left"
                >
                  <span className="font-semibold text-white">{item.q}</span>
                  <ChevronDown
                    size={18}
                    className={`shrink-0 text-orange-300 transition-transform duration-200 ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {isOpen && (
                  <p className="border-t border-white/10 px-5 py-4 text-sm leading-6 text-slate-400">
                    {item.a}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-8 rounded-2xl border border-orange-400/20 bg-orange-500/5 p-5">
          <p className="mb-3 text-sm text-slate-300">
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
