import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/app/lib/isAdmin";
import type { SiteDomain } from "@/app/lib/siteDomain";
import {
  listSupportTickets,
  updateSupportTicketStatus,
  type SupportTicketStatus,
} from "@/app/lib/supportChat";

export const dynamic = "force-dynamic";

const VALID_DOMAINS: SiteDomain[] = ["inplayer", "hammart"];
const VALID_STATUSES: SupportTicketStatus[] = [
  "ai_resolved",
  "open",
  "in_progress",
  "resolved",
  "abandoned",
];

// Admin-only view of the AI Support Desk, always scoped to ONE panel's
// domain. Mirrors how /api/admin/* routes already work in this app:
// requireAdmin() at the top, catch → 401.
export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
  } catch {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  const domainParam = request.nextUrl.searchParams.get("domain") || "inplayer";
  const domain = (VALID_DOMAINS as string[]).includes(domainParam)
    ? (domainParam as SiteDomain)
    : "inplayer";

  const statusParam = request.nextUrl.searchParams.get("status");
  const status =
    statusParam && (VALID_STATUSES as string[]).includes(statusParam)
      ? (statusParam as SupportTicketStatus)
      : undefined;

  const { tickets, tableMissing } = await listSupportTickets(domain, status);

  // Counts are computed over the whole domain (unfiltered) so the status
  // tabs can show real totals even while a filter is applied — the same
  // tab-with-counts pattern every other admin list here uses.
  const all = status ? (await listSupportTickets(domain)).tickets : tickets;
  const counts = {
    total: all.length,
    open: all.filter((t) => t.status === "open").length,
    in_progress: all.filter((t) => t.status === "in_progress").length,
    ai_resolved: all.filter((t) => t.status === "ai_resolved").length,
    resolved: all.filter((t) => t.status === "resolved").length,
    abandoned: all.filter((t) => t.status === "abandoned").length,
  };

  return NextResponse.json({ tickets, counts, tableMissing });
}

export async function PATCH(request: NextRequest) {
  try {
    await requireAdmin(request);
  } catch {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  let body: { ticketId?: string; status?: string; adminNotes?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (!body.ticketId || !(VALID_STATUSES as string[]).includes(body.status || "")) {
    return NextResponse.json(
      { error: "ticketId and a valid status are required." },
      { status: 400 }
    );
  }

  try {
    await updateSupportTicketStatus(
      body.ticketId,
      body.status as SupportTicketStatus,
      body.adminNotes
    );
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("admin support PATCH failed:", err);
    return NextResponse.json(
      { error: "Couldn't update that ticket." },
      { status: 500 }
    );
  }
}
