import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/app/lib/verifyAuth";
import type { SiteDomain } from "@/app/lib/siteDomain";
import {
  createSupportTicket,
  saveTranscript,
  getSupportTicket,
  type SupportMessage,
  type SupportPriority,
  type SupportRole,
} from "@/app/lib/supportChat";
import {
  buildSupportSystemPrompt,
  ESCALATE_TOKEN_RE,
  RESOLVED_TOKEN,
} from "@/app/lib/supportKnowledge";

export const dynamic = "force-dynamic";

// Same provider setup and fallback ladder the existing /api/ai-generate
// route already uses (OpenAI first, Groq as the drop-in OpenAI-compatible
// alternative), so this needs no new key and no new dependency — it reuses
// whichever of the two is already configured in the environment.
const CANDIDATE_MODELS = ["gpt-4o-mini", "gpt-4o"];
const PER_CALL_TIMEOUT_MS = 45_000;

// A support conversation doesn't need unbounded history, and an unbounded
// one is a real cost/latency problem plus an easy abuse vector. Keep the
// most recent turns; the full transcript is still stored for the admin.
const MAX_TURNS_SENT_TO_MODEL = 16;
const MAX_MESSAGE_CHARS = 2000;

const VALID_DOMAINS: SiteDomain[] = ["inplayer", "hammart"];
const VALID_ROLES: SupportRole[] = ["user", "creator", "customer", "vendor"];

interface ChatBody {
  domain?: string;
  role?: string;
  ticketId?: string | null;
  pageUrl?: string;
  messages?: { role?: string; content?: string }[];
}

export async function POST(request: NextRequest) {
  // Signed-in only: every ticket has to belong to a real account or the
  // admin panel has nobody to reply to, and an anonymous endpoint that
  // bills AI tokens is an obvious abuse target.
  let user;
  try {
    user = await verifyAuth(request);
  } catch {
    return NextResponse.json(
      { error: "Please sign in to use support chat." },
      { status: 401 }
    );
  }

  let body: ChatBody;
  try {
    body = (await request.json()) as ChatBody;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const domain = (VALID_DOMAINS as string[]).includes(body.domain || "")
    ? (body.domain as SiteDomain)
    : "inplayer";
  const role = (VALID_ROLES as string[]).includes(body.role || "")
    ? (body.role as SupportRole)
    : domain === "hammart"
      ? "customer"
      : "user";

  const incoming = Array.isArray(body.messages) ? body.messages : [];
  const history: SupportMessage[] = incoming
    .filter(
      (m): m is { role: string; content: string } =>
        typeof m?.content === "string" &&
        m.content.trim().length > 0 &&
        (m.role === "user" || m.role === "assistant")
    )
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content.slice(0, MAX_MESSAGE_CHARS),
      at: new Date().toISOString(),
    }));

  if (!history.length || history[history.length - 1].role !== "user") {
    return NextResponse.json(
      { error: "Nothing to reply to." },
      { status: 400 }
    );
  }

  const apiKey = process.env.OPENAI_API_KEY || process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "Support chat isn't configured yet. Please use the contact email in the footer and we'll help you directly.",
      },
      { status: 503 }
    );
  }

  const systemPrompt = buildSupportSystemPrompt(domain, role, {
    name: user.name,
    email: user.email,
    pageUrl: body.pageUrl,
  });

  const modelMessages = [
    { role: "system" as const, content: systemPrompt },
    ...history.slice(-MAX_TURNS_SENT_TO_MODEL).map((m) => ({
      role: m.role,
      content: m.content,
    })),
  ];

  let replyText: string | null = null;
  let lastErrorStatus = 502;

  for (const model of CANDIDATE_MODELS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PER_CALL_TIMEOUT_MS);
    try {
      const endpoint = process.env.OPENAI_API_KEY
        ? "https://api.openai.com/v1/chat/completions"
        : "https://api.groq.com/openai/v1/chat/completions";

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: modelMessages,
          // Low but not zero: support answers should be consistent and
          // factual, not creative.
          temperature: 0.3,
          max_tokens: 500,
        }),
        signal: controller.signal,
      });

      if (response.ok) {
        const data = await response.json();
        const text = data?.choices?.[0]?.message?.content;
        if (typeof text === "string" && text.trim()) {
          replyText = text.trim();
          break;
        }
        lastErrorStatus = 502;
        continue;
      }

      lastErrorStatus = response.status;
      console.error(
        `support chat: model ${model} failed`,
        response.status,
        await response.text()
      );
      if (response.status === 404 || response.status === 429 || response.status >= 500) {
        continue;
      }
      break;
    } catch (err) {
      console.error(`support chat: request failed (${model}):`, err);
      continue;
    } finally {
      clearTimeout(timer);
    }
  }

  if (!replyText) {
    return NextResponse.json(
      {
        error:
          "I couldn't reach the assistant just now. Please try again in a moment — or send this to the team and we'll pick it up.",
      },
      { status: lastErrorStatus >= 400 ? lastErrorStatus : 502 }
    );
  }

  // ── Parse and strip the control tokens ────────────────────────────────
  // These are an internal signalling channel between the model and this
  // route; they must never survive into what the person reads.
  const escalateMatch = replyText.match(ESCALATE_TOKEN_RE);
  const resolved = replyText.includes(RESOLVED_TOKEN);

  const escalated = Boolean(escalateMatch);
  const priority = (escalateMatch?.[1]?.toLowerCase() as SupportPriority) || "normal";
  const escalationReason = escalateMatch?.[2]?.trim() || null;

  const visibleReply = replyText
    .replace(ESCALATE_TOKEN_RE, "")
    .split(RESOLVED_TOKEN)
    .join("")
    .trim();

  const fullTranscript: SupportMessage[] = [
    ...history,
    { role: "assistant", content: visibleReply, at: new Date().toISOString() },
  ];

  // ── Persist ───────────────────────────────────────────────────────────
  // Every conversation becomes a row the admin panel can see, from the
  // first message — so a person who gives up mid-chat still leaves a trail
  // (status "abandoned"), rather than the team only ever seeing the ones
  // that happened to escalate. Storage is best-effort throughout: a chat
  // must never fail because the reporting side had a problem.
  let ticketId = typeof body.ticketId === "string" ? body.ticketId : null;

  if (!ticketId) {
    const firstUserMessage =
      history.find((m) => m.role === "user")?.content ?? "Support request";
    const subject =
      firstUserMessage.length > 70
        ? `${firstUserMessage.slice(0, 70).trimEnd()}…`
        : firstUserMessage;

    const created = await createSupportTicket({
      domain,
      role,
      userId: user.userId,
      userEmail: user.email || "",
      userName: user.name || "",
      subject,
      pageUrl: body.pageUrl || "",
      messages: fullTranscript,
    });
    ticketId = created.ticketId;
  }

  if (ticketId) {
    await saveTranscript(ticketId, fullTranscript, {
      status: escalated ? "open" : resolved ? "ai_resolved" : "abandoned",
      priority: escalated ? priority : undefined,
      escalationReason: escalated ? escalationReason : undefined,
      aiSummary: escalated ? escalationReason : undefined,
    });
  }

  return NextResponse.json({
    reply: visibleReply,
    ticketId,
    escalated,
    resolved,
    // Surfaced so the widget can show the "passed to the team" state with
    // a real reference the person can quote later.
    reference: escalated && ticketId ? ticketId.slice(0, 8).toUpperCase() : null,
  });
}

// Lets the widget re-open an existing conversation (e.g. after a refresh)
// without starting a fresh ticket for the same problem.
export async function GET(request: NextRequest) {
  let user;
  try {
    user = await verifyAuth(request);
  } catch {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const ticketId = request.nextUrl.searchParams.get("ticketId");
  if (!ticketId) {
    return NextResponse.json({ error: "ticketId is required." }, { status: 400 });
  }

  const ticket = await getSupportTicket(ticketId);
  // Ownership check — a ticket ID is a plain UUID, so without this anyone
  // holding one could read someone else's support conversation.
  if (!ticket || ticket.userId !== user.userId) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  return NextResponse.json({
    ticketId: ticket.ticketId,
    status: ticket.status,
    messages: ticket.messages,
  });
}
