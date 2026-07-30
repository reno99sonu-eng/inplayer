import { NextRequest, NextResponse } from "next/server";
import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import { requireAdmin } from "@/app/lib/isAdmin";
import {
  PAYOUTS_TABLE,
  REVENUE_LEDGER_TABLE,
  MEMBERSHIPS_TABLE,
  getNextPayoutWindow,
} from "@/app/lib/creatorPayouts";
import { resolveUsernames } from "@/app/lib/resolveUsernames";

// Real numbers only — every figure here is either summed straight from
// InPlayer-Revenue-Ledger (one real row per Razorpay-confirmed charge,
// written by app/api/webhooks/razorpay) or read straight from
// InPlayer-Creator-Payouts (updated by that same webhook and by
// app/api/creator/payout-run). Nothing here is a views-based estimate —
// if there's been no real paid membership charge yet, every total below is
// a genuine zero, not a placeholder.

async function scanAll(tableName: string): Promise<Record<string, unknown>[]> {
  const items: Record<string, unknown>[] = [];
  let exclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const result = await docClient.send(
      new ScanCommand({ TableName: tableName, ExclusiveStartKey: exclusiveStartKey })
    );
    items.push(...((result.Items || []) as Record<string, unknown>[]));
    exclusiveStartKey = result.LastEvaluatedKey;
  } while (exclusiveStartKey);
  return items;
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let ledger: Record<string, unknown>[] = [];
  let tableMissing = false;
  try {
    ledger = await scanAll(REVENUE_LEDGER_TABLE);
  } catch (err) {
    console.error("admin/revenue: ledger scan failed (table may not exist yet):", err);
    tableMissing = true;
  }

  let payouts: Record<string, unknown>[] = [];
  try {
    payouts = await scanAll(PAYOUTS_TABLE);
  } catch (err) {
    console.error("admin/revenue: payouts scan failed (table may not exist yet):", err);
    tableMissing = true;
  }

  let activeMemberships = 0;
  try {
    const memberships = await scanAll(MEMBERSHIPS_TABLE);
    activeMemberships = memberships.filter((m) => m.status === "active").length;
  } catch (err) {
    console.error("admin/revenue: memberships scan failed (table may not exist yet):", err);
  }

  if (tableMissing) {
    return NextResponse.json({
      tableMissing: true,
      summary: null,
      creators: [],
    });
  }

  const totalGrossInr = ledger.reduce((sum, r) => sum + ((r.amountInr as number) || 0), 0);
  const totalCreatorShareInr = ledger.reduce(
    (sum, r) => sum + ((r.creatorShareInr as number) || 0),
    0
  );
  const totalPlatformShareInr = Math.round((totalGrossInr - totalCreatorShareInr) * 100) / 100;

  const window = getNextPayoutWindow();

  // Only creators who've actually submitted KYC at least once have a row
  // here at all — that's a real, meaningful filter, not a cap.
  const creators = payouts
    .filter((p) => (p.kycStatus as string) !== "not_started")
    .map((p) => ({
      userId: p.userId as string,
      kycStatus: (p.kycStatus as string) || "not_started",
      lifetimeEarnedInr: (p.lifetimeEarnedInr as number) || 0,
      lifetimePaidOutInr: (p.lifetimePaidOutInr as number) || 0,
      pendingPayoutInr: (p.pendingPayoutInr as number) ?? null,
      payoutEligible: Boolean(p.payoutEligible),
      payoutFrequency: (p.payoutFrequency as string) || null,
      lastChargeAt: (p.lastChargeAt as string) || null,
    }))
    .sort((a, b) => b.lifetimeEarnedInr - a.lifetimeEarnedInr);

  const usernames = await resolveUsernames(creators.map((c) => c.userId));
  const withUsernames = creators.map((c) => ({
    ...c,
    username: usernames.get(c.userId) || null,
  }));

  return NextResponse.json({
    tableMissing: false,
    summary: {
      totalGrossInr,
      totalCreatorShareInr: Math.round(totalCreatorShareInr * 100) / 100,
      totalPlatformShareInr,
      totalCharges: ledger.length,
      activeMemberships,
      verifiedCreatorCount: withUsernames.filter((c) => c.kycStatus === "verified").length,
      payoutWindowLabel: window.label,
      payoutWindowOpen: window.isOpenNow,
    },
    creators: withUsernames,
  });
}
