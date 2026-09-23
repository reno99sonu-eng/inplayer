import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/app/lib/isAdmin";
import { listTeamMembers } from "@/app/lib/adminMembers";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized admin access." }, { status: 401 });
  }

  const members = await listTeamMembers();
  return NextResponse.json({ members });
}
