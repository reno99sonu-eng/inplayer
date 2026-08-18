import type { SiteDomain } from "@/app/lib/siteDomain";
import type { SupportRole } from "@/app/lib/supportChat";

// Client-safe half of the support desk's copy: the opening line and the
// starter chips, i.e. the only parts the browser actually needs.
//
// Deliberately kept OUT of supportKnowledge.ts. That file holds the full
// system prompt — every internal rule, every product fact, and the exact
// escalation token format — and it is imported only by the server route.
// Importing it from the widget would bundle the entire prompt into the
// public JavaScript, which both bloats the bundle and puts the assistant's
// whole rulebook (including "say this token to escalate") in plain view.
// Two small files is the correct trade.

export function getSupportGreeting(domain: SiteDomain, role: SupportRole): string {
  if (domain === "hammart") {
    return role === "vendor"
      ? "Hi — I'm the Hammart seller assistant. Ask me about orders, payouts, KYC or your listings and I'll walk you through it."
      : "Hi — I'm the Hammart support assistant. Tell me what's happening with your order, payment or delivery and I'll sort it out.";
  }
  return role === "creator"
    ? "Hi — I'm the InPlayer creator assistant. Uploads, monetization, live streams, payouts — tell me what's going on."
    : "Hi — I'm the InPlayer support assistant. Tell me what's not working and I'll help you fix it.";
}

export function getSupportQuickPrompts(
  domain: SiteDomain,
  role: SupportRole
): string[] {
  if (domain === "hammart") {
    return role === "vendor"
      ? [
          "When do I get paid for an order?",
          "My KYC is still pending",
          "A listing of mine was rejected",
          "How do I confirm a UPI payment?",
        ]
      : [
          "I paid but my order is still pending",
          "Why can't I pay by card?",
          "No sellers near my pincode",
          "How do I cancel an order?",
        ];
  }
  return role === "creator"
    ? [
        "My upload is stuck on processing",
        "When will I be eligible to monetize?",
        "My live stream won't start",
        "My Revenue page shows zero views",
      ]
    : [
        "A video won't play",
        "How do I change my username?",
        "I can't sign in",
        "How do subscriptions work?",
      ];
}
