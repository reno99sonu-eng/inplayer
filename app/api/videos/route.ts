import { NextResponse } from "next/server";
import { getVisibleVideos } from "@/app/lib/contentAccessServer";
import { resolveUsernames } from "@/app/lib/resolveUsernames";

import { isMusicType } from "@/app/lib/contentTypes";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const channelId = searchParams.get("channelId");
  const contentType = searchParams.get("contentType");
  const isPaginated = searchParams.has("limit") || searchParams.has("offset");
  const requestedLimit = Number.parseInt(searchParams.get("limit") ?? "24", 10);
  const requestedOffset = Number.parseInt(searchParams.get("offset") ?? "0", 10);
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(48, Math.max(1, requestedLimit))
    : 24;
  const offset = Number.isFinite(requestedOffset)
    ? Math.max(0, requestedOffset)
    : 0;

  try {
    const allReady = await getVisibleVideos();
    let items = allReady.filter(
      (v) => !v.visibility || v.visibility === "public"
    );

    // Strict content separation:
    // By default, /api/videos returns standard longform videos (NO music, NO shorts).
    // An explicit ?contentType= query allows querying music or shorts specifically.
    if (contentType === "music") {
      items = items.filter((v) => isMusicType(v.contentType));
    } else if (contentType === "short" || contentType === "raftaar") {
      items = items.filter((v) => v.contentType === "short" && !v.seriesId);
    } else if (contentType === "film" || contentType === "raftaar_film") {
      items = items.filter((v) => v.contentType === "film");
    } else if (contentType !== "all") {
      // Default: pure longform videos only
      items = items.filter(
        (v) => !isMusicType(v.contentType) && v.contentType !== "short" && v.contentType !== "film" && !v.seriesId
      );
    }

    if (channelId) {
      items = items.filter((v) => v.uploaderId === channelId);
    }

    // Android asks for a small first page so it can paint immediately, then
    // requests more as the person scrolls. Keep the existing unpaginated
    // response for website and older app clients. Filtering always happens
    // before slicing so audience/private visibility rules remain unchanged.
    const total = items.length;
    const pageItems = isPaginated ? items.slice(offset, offset + limit) : items;

    const usernames = await resolveUsernames(
      pageItems.map((video) => video.uploaderId as string | null | undefined)
    );

    const videos = pageItems.map((video) => {
      const uploaderId = video.uploaderId as string | undefined;
      return {
        ...video,
        uploaderUsername: uploaderId ? usernames.get(uploaderId) : undefined,
      };
    });

    const responseBody = isPaginated
      ? {
          videos,
          pagination: {
            limit,
            offset,
            total,
            hasMore: offset + videos.length < total,
          },
        }
      : { videos };

    return NextResponse.json(responseBody, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      },
    });
  } catch (err) {
    console.error("Failed to fetch videos for API:", err);
    return NextResponse.json({ videos: [] }, { status: 500 });
  }
}
