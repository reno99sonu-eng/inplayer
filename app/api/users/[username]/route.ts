import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/app/lib/verifyAuth";
import { getPublicProfile } from "@/app/lib/getPublicProfile";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

interface Params {
  params: Promise<{ username: string }>;
}

// A user's public channel (app/u/[username]) — optional auth, like
// browsing a video: signed-out visitors can view public profiles, but
// privacy gating (private / connections-only) needs to know who's asking.
// The actual lookup/gating/video-fetch logic lives in
// app/lib/getPublicProfile.ts, shared with the channel page's own
// server-rendered anonymous pass — this route exists so a signed-in
// browser can re-fetch its own AUTHENTICATED view (via the Bearer token
// below, which a Server Component has no way to read) once it mounts.
export async function GET(request: NextRequest, { params }: Params) {
  const { username } = await params;

  let viewerId: string | null = null;
  try {
    const viewer = await verifyAuth(request);
    viewerId = viewer.userId;
  } catch {
    // Not signed in — fine, this endpoint works for anonymous visitors too.
  }

  const result = await getPublicProfile(username, viewerId);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result.data, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    },
  });
}
