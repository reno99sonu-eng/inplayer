import { NextResponse } from "next/server";
import { getBhashiniConfigStatus } from "@/app/lib/bhashiniTranslate";

export const dynamic = "force-dynamic";

/**
 * GET /api/bhashini/status
 * Returns Bhashini system configuration and approval diagnostics without exposing any secret keys.
 */
export async function GET() {
  const status = getBhashiniConfigStatus();

  return NextResponse.json({
    service: "bhashini",
    configured: status.configured,
    approvalStatus: status.approvalStatus,
    hasApiKey: status.hasApiKey,
    hasUserId: status.hasUserId,
    supportedLanguages: status.supportedLanguages,
    note: status.configured
      ? "Bhashini credentials configured. Manager approval required for active production quota."
      : "Bhashini credentials pending configuration in environment variables.",
  });
}
