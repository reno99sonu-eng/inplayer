import { NextRequest, NextResponse } from "next/server";
import type { ResolvedSoundtrack } from "@/app/data/soundtracks";

// Jamendo's public catalog — real, independent-label music, all released
// under Creative Commons licenses (as opposed to InPlayer's own local
// instrumentals, which are 100% synthesized with zero rights involved at
// all). This is the "works now, real licensing later" stopgap: free to
// query, free for creators to use under each track's own CC terms today,
// with a clear paid path (licensing.jamendo.com) once InPlayer wants a
// bigger commercial catalog. See the JAMENDO_CLIENT_ID setup note below —
// signing up for this is free and doesn't require a payment method.
const JAMENDO_SEARCH_ENDPOINT = "https://api.jamendo.com/v3.0/tracks/";
const PER_CALL_TIMEOUT_MS = 15_000;
const RESULT_LIMIT = 20;

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() || "";

  if (!query) {
    return NextResponse.json({ tracks: [] });
  }

  const clientId = process.env.JAMENDO_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      {
        error: "Real-music search isn't configured yet. Please contact the site admin.",
        debug: "JAMENDO_CLIENT_ID is missing",
      },
      { status: 500 }
    );
  }

  const params = new URLSearchParams({
    client_id: clientId,
    format: "json",
    search: query,
    limit: String(RESULT_LIMIT),
    audioformat: "mp32",
    include: "musicinfo",
    // Only tracks whose specific CC license allows commercial use — this
    // still isn't a substitute for the real licensing deal InPlayer will
    // get later, but it keeps today's free/stopgap catalog to tracks that
    // are at least legitimately usable on a monetized platform under
    // their own terms in the meantime.
    ccnc: "false",
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PER_CALL_TIMEOUT_MS);

  try {
    const response = await fetch(`${JAMENDO_SEARCH_ENDPOINT}?${params.toString()}`, {
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("Jamendo search error:", response.status, errorBody);
      return NextResponse.json(
        { error: "Couldn't search music right now. Please try again shortly." },
        { status: 502 }
      );
    }

    const data = await response.json();
    const results = Array.isArray(data?.results) ? data.results : [];

    const tracks: ResolvedSoundtrack[] = results
      .filter((t: unknown): t is Record<string, unknown> => !!t && typeof t === "object")
      .map((t: Record<string, unknown>) => ({
        id: `jamendo:${t.id}`,
        title: typeof t.name === "string" && t.name ? t.name : "Untitled",
        artist: typeof t.artist_name === "string" && t.artist_name ? t.artist_name : "Unknown artist",
        url: typeof t.audio === "string" ? t.audio : "",
        durationSeconds: typeof t.duration === "number" ? t.duration : 30,
        source: "jamendo" as const,
        licenseUrl: typeof t.license_ccurl === "string" ? t.license_ccurl : undefined,
      }))
      .filter((t: ResolvedSoundtrack) => t.url);

    return NextResponse.json({ tracks });
  } catch (err) {
    console.error("Jamendo search request failed:", err);
    return NextResponse.json(
      { error: "Couldn't search music right now. Please try again shortly." },
      { status: 502 }
    );
  } finally {
    clearTimeout(timer);
  }
}
