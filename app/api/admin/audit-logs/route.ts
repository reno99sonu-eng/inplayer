import { NextRequest, NextResponse } from "next/server";
import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import { requireAdmin } from "@/app/lib/isAdmin";
import { AUDIT_LOGS_TABLE, auditDomainForAction } from "@/app/lib/auditLog";
import { resolveUsernames } from "@/app/lib/resolveUsernames";
import { getRequestLocation, getRequestDevice } from "@/app/lib/requestInfo";

// Real audit trail — every row here was written by app/lib/auditLog.ts at
// the moment an admin action (in app/api/admin/*) actually succeeded.
// Nothing here is simulated or backfilled; a quiet log simply means no
// admin action has happened yet.
const MAX_ROWS = 300;

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const items: Record<string, unknown>[] = [];
  try {
    let exclusiveStartKey: Record<string, unknown> | undefined;
    do {
      const result = await docClient.send(
        new ScanCommand({
          TableName: AUDIT_LOGS_TABLE,
          ExclusiveStartKey: exclusiveStartKey,
        })
      );
      items.push(...((result.Items || []) as Record<string, unknown>[]));
      exclusiveStartKey = result.LastEvaluatedKey;
    } while (exclusiveStartKey);
  } catch (err) {
    console.error("admin/audit-logs: scan failed (table may not exist yet):", err);
    return NextResponse.json({ items: [], tableMissing: true });
  }

  // Panel scoping. The domain is derived from the action name
  // (auditDomainForAction) rather than read off the row, so every entry
  // written before this existed classifies correctly with no backfill.
  //
  // NOTE the filter runs BEFORE the MAX_ROWS slice on purpose: slicing
  // first and filtering after would mean asking for Hammart returns only
  // whatever Hammart rows happened to survive a cut taken across all three
  // panels — on a busy InPlayer day that's frequently none at all.
  const domainParam = request.nextUrl.searchParams.get("domain");
  const domain =
    domainParam === "inplayer" || domainParam === "hammart" || domainParam === "sponsorship"
      ? domainParam
      : null;

  const scoped = domain
    ? items.filter((l) => auditDomainForAction(String(l.action || "")) === domain)
    : items;

  const sorted = scoped
    .sort(
      (a, b) =>
        new Date((b.createdAt as string) || 0).getTime() -
        new Date((a.createdAt as string) || 0).getTime()
    )
    .slice(0, MAX_ROWS);

  // "user" is the only targetType with a real profile to look up — video,
  // comment, message, report, and notification targets don't have a
  // single well-known display name to resolve here, so they're shown by
  // raw id instead (see the page, which formats each accordingly).
  const userTargetIds = sorted
    .filter((l) => l.targetType === "user")
    .map((l) => l.targetId as string);
  const usernames = await resolveUsernames(userTargetIds);

  const withLabels = sorted.map((l) => ({
    logId: l.logId,
    createdAt: l.createdAt,
    adminEmail: l.adminEmail,
    action: l.action,
    domain: auditDomainForAction(String(l.action || "")),
    targetType: l.targetType,
    targetId: l.targetId,
    targetLabel:
      l.targetType === "user" ? usernames.get(l.targetId as string) || null : null,
    details: l.details || null,
    location: l.location || null,
    device: l.device || null,
    ipAddress: l.ipAddress || null,
  }));

  // The viewer's OWN current device/location, so the page can flag any
  // log entry that doesn't match — the real "was this actually me?"
  // signal now that there's only one admin email to check against.
  return NextResponse.json({
    items: withLabels,
    viewerLocation: getRequestLocation(request),
    viewerDevice: getRequestDevice(request),
  });
}
