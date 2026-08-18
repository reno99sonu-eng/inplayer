"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  Headset,
  X,
  Send,
  Loader2,
  Sparkles,
  CheckCircle2,
  LifeBuoy,
  AlertCircle,
} from "lucide-react";
import { useAuthModal } from "@/app/components/auth/AuthProvider";
import { authedFetch } from "@/app/lib/apiFetch";
import { getSiteDomain } from "@/app/lib/siteDomain";
// Presets only — NOT supportKnowledge.ts, which holds the server-side
// system prompt and must never reach the client bundle.
import {
  getSupportGreeting,
  getSupportQuickPrompts,
} from "@/app/lib/supportPresets";
import type { SupportRole } from "@/app/lib/supportChat";

// ── AI Support Desk: the customer-facing widget ─────────────────────────
// One component serves both products. Which playbook the assistant answers
// from is decided by the URL via the shared getSiteDomain() helper — the
// same per-panel convention MaintenanceGate, AnnouncementBanner and the
// admin panel all use — so InPlayer and Hammart get genuinely separate
// support experiences without two copies of this UI to keep in sync.
//
// Theming: every colour here is declared as a dark-theme value with an
// explicit `light:` counterpart, matching the convention used across this
// codebase. Nothing relies on a default that only happens to look right in
// one theme — that was the exact cause of the "faded buttons" pass done
// earlier across the admin panel.

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const MAX_INPUT = 2000;

export default function SupportChatWidget() {
  const pathname = usePathname();
  const domain = getSiteDomain(pathname);
  const { signedIn, openSignIn, user } = useAuthModal();

  // Sponsorship has its own dedicated contact route already; support chat
  // is scoped to the two products that have real end-user support load.
  const supported = domain === "inplayer" || domain === "hammart";

  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<SupportRole | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);
  const [resolved, setResolved] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Reset everything when moving between products, so a Hammart order
  // question can never bleed into an InPlayer creator conversation.
  useEffect(() => {
    setOpen(false);
    setRole(null);
    setMessages([]);
    setTicketId(null);
    setReference(null);
    setResolved(false);
    setError(null);
  }, [domain]);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, sending, reference]);

  // Escape closes the panel, matching every other overlay in the app.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || sending || !role) return;

      const next: ChatMessage[] = [...messages, { role: "user", content: trimmed }];
      setMessages(next);
      setInput("");
      setSending(true);
      setError(null);

      try {
        const res = await authedFetch("/api/support/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            domain,
            role,
            ticketId,
            pageUrl: typeof window !== "undefined" ? window.location.pathname : "",
            messages: next,
          }),
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          setError(
            data?.error || "Something went wrong reaching the assistant."
          );
          return;
        }

        setMessages([...next, { role: "assistant", content: data.reply }]);
        if (data.ticketId) setTicketId(data.ticketId);
        if (data.reference) setReference(data.reference);
        if (data.resolved) setResolved(true);
      } catch (err) {
        console.error("Support chat failed:", err);
        setError("Couldn't reach support just now. Please try again.");
      } finally {
        setSending(false);
      }
    },
    [messages, sending, role, domain, ticketId]
  );

  if (!supported) return null;

  const isHammart = domain === "hammart";
  const productName = isHammart ? "Hammart" : "InPlayer";
  const roleOptions: { value: SupportRole; label: string; hint: string }[] =
    isHammart
      ? [
          { value: "customer", label: "I'm a buyer", hint: "Orders, payments, delivery" },
          { value: "vendor", label: "I'm a seller", hint: "Listings, KYC, payouts" },
        ]
      : [
          { value: "user", label: "I'm a viewer", hint: "Playback, account, subscriptions" },
          { value: "creator", label: "I'm a creator", hint: "Uploads, monetization, live" },
        ];

  return (
    <>
      {/* Launcher — sits above the mobile bottom nav (which is h-16/pb-20 on
          small screens) so it can never cover those tab targets. */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`Get ${productName} support`}
          className="
            fixed bottom-24 right-4 z-[9990] flex items-center gap-2 rounded-full
            bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A]
            px-4 py-3 text-sm font-bold text-white
            shadow-[0_10px_30px_rgba(255,153,0,.35)]
            transition-transform duration-300 hover:-translate-y-0.5 active:scale-95
            lg:bottom-6 lg:right-6
          "
        >
          <Headset size={18} />
          <span className="hidden sm:inline">Support</span>
        </button>
      )}

      {open && (
        <div
          className="fixed inset-0 z-[9991] flex items-end justify-end bg-black/50 p-0 backdrop-blur-sm light:bg-black/30 sm:p-4 lg:p-6"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={`${productName} support chat`}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="
              flex h-[92dvh] w-full flex-col overflow-hidden
              rounded-t-3xl border border-white/10 bg-[#0b1220]
              light:border-black/10 light:bg-[#FBF6EA]
              shadow-[0_24px_60px_rgba(0,0,0,0.5)]
              sm:h-[min(620px,88dvh)] sm:max-w-md sm:rounded-3xl
            "
          >
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.03] px-4 py-3">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-orange-500/15">
                <LifeBuoy size={18} className="text-orange-400 light:text-orange-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black text-white light:text-slate-900">
                  {productName} Support
                </p>
                <p className="flex items-center gap-1 truncate text-[11px] font-medium text-slate-400 light:text-slate-600">
                  <Sparkles size={10} className="text-orange-400 light:text-orange-600" />
                  AI assistant · replies instantly
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close support chat"
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl text-slate-400 light:text-slate-600 transition hover:bg-white/10 light:hover:bg-black/10 hover:text-white light:hover:text-slate-900"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {!signedIn ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center">
                  <LifeBuoy size={30} className="text-orange-400 light:text-orange-600" />
                  <p className="text-sm font-semibold text-white light:text-slate-900">
                    Sign in to start a support chat
                  </p>
                  <p className="text-xs leading-5 text-slate-400 light:text-slate-600">
                    We link every conversation to your account so the team can
                    follow up properly.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      openSignIn();
                    }}
                    className="mt-1 rounded-2xl bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] px-5 py-2.5 text-sm font-bold text-white transition-transform duration-300 hover:-translate-y-0.5 active:scale-95"
                  >
                    Sign in
                  </button>
                </div>
              ) : !role ? (
                /* Role picker — this is what makes the answers land: a buyer
                   and a seller asking "when do I get paid" need completely
                   different replies. */
                <div className="flex h-full flex-col justify-center gap-3">
                  <p className="text-center text-sm font-semibold text-white light:text-slate-900">
                    First — which of these is you?
                  </p>
                  {roleOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setRole(opt.value)}
                      className="
                        w-full rounded-2xl border border-white/10 light:border-black/10
                        bg-white/[0.04] light:bg-white px-4 py-3 text-left
                        light:shadow-sm transition
                        hover:border-orange-400/50 hover:bg-white/[0.07] light:hover:bg-orange-50
                      "
                    >
                      <p className="text-sm font-bold text-white light:text-slate-900">
                        {opt.label}
                      </p>
                      <p className="mt-0.5 text-[11px] font-medium text-slate-400 light:text-slate-600">
                        {opt.hint}
                      </p>
                    </button>
                  ))}
                </div>
              ) : (
                <>
                  {/* Greeting always shows first, before any exchange. */}
                  <Bubble role="assistant">
                    {getSupportGreeting(domain, role)}
                  </Bubble>

                  {messages.length === 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {getSupportQuickPrompts(domain, role).map((q) => (
                        <button
                          key={q}
                          type="button"
                          onClick={() => send(q)}
                          className="
                            rounded-full border border-white/10 light:border-black/10
                            bg-white/[0.04] light:bg-white px-3 py-1.5
                            text-[11px] font-semibold text-slate-300 light:text-slate-700
                            light:shadow-sm transition
                            hover:border-orange-400/50 hover:text-orange-300 light:hover:text-orange-600
                          "
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  )}

                  {messages.map((m, i) => (
                    <Bubble key={i} role={m.role}>
                      {m.content}
                    </Bubble>
                  ))}

                  {sending && (
                    <div className="flex items-center gap-2 pl-1 text-xs font-medium text-slate-400 light:text-slate-600">
                      <Loader2 size={13} className="animate-spin text-orange-400 light:text-orange-600" />
                      Thinking through your issue…
                    </div>
                  )}

                  {reference && (
                    <div className="flex items-start gap-2 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-3 py-2.5">
                      <AlertCircle size={15} className="mt-0.5 flex-shrink-0 text-amber-400 light:text-amber-600" />
                      <p className="text-[11px] font-medium leading-5 text-amber-300 light:text-amber-800">
                        Passed to the {productName} team. Your reference is{" "}
                        <span className="font-black">{reference}</span> — quote
                        it if you follow up by email.
                      </p>
                    </div>
                  )}

                  {resolved && !reference && (
                    <div className="flex items-start gap-2 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2.5">
                      <CheckCircle2 size={15} className="mt-0.5 flex-shrink-0 text-emerald-400 light:text-emerald-700" />
                      <p className="text-[11px] font-medium leading-5 text-emerald-300 light:text-emerald-800">
                        Marked as resolved. Reopen any time by sending another
                        message.
                      </p>
                    </div>
                  )}

                  {error && (
                    <div className="flex items-start gap-2 rounded-2xl border border-red-500/25 bg-red-500/10 px-3 py-2.5">
                      <AlertCircle size={15} className="mt-0.5 flex-shrink-0 text-red-400 light:text-red-700" />
                      <p className="text-[11px] font-medium leading-5 text-red-300 light:text-red-800">
                        {error}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Composer */}
            {signedIn && role && (
              <div className="border-t border-white/10 light:border-black/10 bg-white/[0.02] light:bg-black/[0.02] px-3 py-3">
                <div className="flex items-end gap-2">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value.slice(0, MAX_INPUT))}
                    onKeyDown={(e) => {
                      // Enter sends, Shift+Enter makes a new line — the
                      // convention people already expect from every chat app.
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        send(input);
                      }
                    }}
                    rows={1}
                    placeholder="Describe what's happening…"
                    disabled={sending}
                    className="
                      max-h-28 min-h-[42px] flex-1 resize-none rounded-2xl
                      border border-white/10 light:border-slate-300
                      bg-white/[0.04] light:bg-white
                      px-3.5 py-2.5 text-sm text-white light:text-slate-900
                      placeholder:text-slate-500 light:placeholder:text-slate-500
                      light:shadow-sm outline-none transition
                      focus:border-orange-400/60 disabled:opacity-60
                    "
                  />
                  <button
                    type="button"
                    onClick={() => send(input)}
                    disabled={sending || !input.trim()}
                    aria-label="Send message"
                    className="
                      flex h-[42px] w-[42px] flex-shrink-0 items-center justify-center
                      rounded-2xl bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A]
                      text-white shadow-[0_8px_20px_rgba(255,153,0,.25)]
                      transition active:scale-95
                      disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none
                    "
                  >
                    {sending ? (
                      <Loader2 size={17} className="animate-spin" />
                    ) : (
                      <Send size={17} />
                    )}
                  </button>
                </div>
                <p className="mt-1.5 px-1 text-[10px] font-medium text-slate-500 light:text-slate-600">
                  AI assistant — never share passwords, OTPs or card details.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function Bubble({
  role,
  children,
}: {
  role: "user" | "assistant";
  children: React.ReactNode;
}) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={
          isUser
            ? "max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-gradient-to-r from-[#FF7A18] to-[#FF9A00] px-3.5 py-2.5 text-sm font-medium leading-6 text-white"
            : "max-w-[88%] whitespace-pre-wrap rounded-2xl rounded-bl-md border border-white/10 light:border-black/10 bg-white/[0.05] light:bg-white px-3.5 py-2.5 text-sm leading-6 text-slate-200 light:text-slate-800 light:shadow-sm"
        }
      >
        {children}
      </div>
    </div>
  );
}
