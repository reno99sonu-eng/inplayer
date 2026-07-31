import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/app/lib/isAdmin";
import { listBugReports, updateBugReportStatus, type BugReportStatus } from "@/app/lib/bugReports";
import { resolveUsernames } from "@/app/lib/resolveUsernames";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const statusParam = request.nextUrl.searchParams.get("status");
  const status: BugReportStatus | undefined =
    statusParam === "open" || statusParam === "in_progress" || statusParam === "resolved" ? statusParam : undefined;

  const { reports, tableMissing } = await listBugReports(status);
  const usernames = await resolveUsernames(reports.map((r) => r.reporterId));
  const withUsernames = reports.map((r) => ({ ...r, reporterUsername: usernames.get(r.reporterId) || null }));

  return NextResponse.json({ reports: withUsernames, tableMissing });
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { reportId, status, adminNotes } = body;

  if (!reportId || (status !== "open" && status !== "in_progress" && status !== "resolved")) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  await updateBugReportStatus(reportId, status, typeof adminNotes === "string" ? adminNotes.slice(0, 1000) : undefined);
  return NextResponse.json({ success: true });
}
