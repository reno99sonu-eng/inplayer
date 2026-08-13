import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/app/lib/verifyAuth";
import { listSponsorshipsForUser } from "@/app/lib/sponsorships";

// The signed-in sponsor's own campaign list — powers app/sponsorships/dashboard/page.tsx.
export async function GET(request: NextRequest) {
  let user;
  try {
    user = await verifyAuth(request);
  } catch {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  try {
    const sponsorships = await listSponsorshipsForUser(user.userId);
    return NextResponse.json({ sponsorships });
  } catch (err) {
    console.error("sponsorships: list failed (table may not exist yet):", err);
    return NextResponse.json({ sponsorships: [], tableMissing: true });
  }
}
