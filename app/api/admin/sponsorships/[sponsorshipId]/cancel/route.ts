import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/app/lib/isAdmin";
import { logAdminAction } from "@/app/lib/auditLog";
import { cancelSponsorship, getSponsorship } from "@/app/lib/sponsorships";

// Manual admin action — e.g. a sponsor's assets never arrived, or a refund
// was issued outside the app. Does NOT touch any already-active creative
// rows automatically; if a campaign was already live, deactivate its
// creatives from the regular Admin -> Advertising page same as any house ad.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sponsorshipId: string }> }
) {
  let admin;
  try {
    admin = await requireAdmin(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sponsorshipId } = await params;
  const sponsorship = await getSponsorship(sponsorshipId).catch(() => null);
  if (!sponsorship) {
    return NextResponse.json({ error: "Sponsorship not found." }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const reason = typeof body?.reason === "string" ? body.reason : "Cancelled by admin.";

  await cancelSponsorship(sponsorshipId, reason);

  await logAdminAction({
    request,
    adminId: admin.userId,
    adminEmail: admin.email,
    action: "sponsorship.cancel",
    targetType: "sponsorship",
    targetId: sponsorshipId,
    details: reason,
  });

  return NextResponse.json({ success: true });
}
