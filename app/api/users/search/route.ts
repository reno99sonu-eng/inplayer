import { NextRequest, NextResponse } from "next/server";
import { searchUsersByUsername } from "@/app/lib/userSearch";

// Public (no sign-in required) — finding a user by handle is basic
// discovery, same trust level as browsing videos. What you can then DO
// with that result (message them, see their full profile) is where auth
// and privacy are actually enforced.
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") || "";

  if (q.trim().length < 2) {
    return NextResponse.json({ users: [] });
  }

  const users = await searchUsersByUsername(q.trim(), 15);
  return NextResponse.json({ users });
}
