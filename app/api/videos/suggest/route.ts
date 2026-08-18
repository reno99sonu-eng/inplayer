import { NextRequest, NextResponse } from "next/server";
import { getVisibleVideos } from "@/app/lib/contentAccessServer";

// Live search-as-you-type suggestions, drawn from the exact same
// 30-second-cached ready-videos list every other listing surface already
// uses (see app/lib/videoStore.ts) — no extra DynamoDB Scan per keystroke,
// just an in-memory filter/sort over data that's already loaded for the
// homepage/videos/shorts pages. Mirrors the prefix-first ranking
// app/lib/userSearch.ts already uses for username suggestions.
export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") || "").trim().toLowerCase();

  if (q.length < 1) {
    return NextResponse.json({ suggestions: [] });
  }

  try {
    const videos = await getVisibleVideos();

    const matches = videos.filter((video) => {
      const title = ((video.title as string) || "").toLowerCase();
      return title.includes(q) && (!video.visibility || video.visibility === "public");
    });

    const ranked = matches
      .sort((a, b) => {
        const aTitle = ((a.title as string) || "").toLowerCase();
        const bTitle = ((b.title as string) || "").toLowerCase();
        const aStarts = aTitle.startsWith(q) ? 0 : 1;
        const bStarts = bTitle.startsWith(q) ? 0 : 1;
        if (aStarts !== bStarts) return aStarts - bStarts;
        return aTitle.length - bTitle.length;
      })
      .slice(0, 8)
      .map((video) => ({
        videoId: video.videoId as string,
        title: video.title as string,
        thumbnailUrl: (video.thumbnailUrl as string) || null,
        contentType: (video.contentType as string) || "video",
      }));

    return NextResponse.json({ suggestions: ranked });
  } catch (err) {
    console.error("Video suggest search failed:", err);
    return NextResponse.json({ suggestions: [] });
  }
}
