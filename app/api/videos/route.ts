import { NextResponse } from "next/server";
import { getVisibleVideos } from "@/app/lib/contentAccessServer";
import { resolveUsernames } from "@/app/lib/resolveUsernames";

import { isMusicType } from "@/app/lib/contentTypes";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const channelId = searchParams.get("channelId");
  const contentType = searchParams.get("contentType");

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
      items = items.filter((v) => v.contentType === "short");
    } else if (contentType !== "all") {
      // Default: pure longform videos only
      items = items.filter(
        (v) => !isMusicType(v.contentType) && v.contentType !== "short"
      );
    }

    if (channelId) {
      items = items.filter((v) => v.uploaderId === channelId);
    }
    
    const usernames = await resolveUsernames(
      items.map((video) => video.uploaderId as string | null | undefined)
    );

    const videos = items.map((video) => {
      const uploaderId = video.uploaderId as string | undefined;
      return {
        ...video,
        uploaderUsername: uploaderId ? usernames.get(uploaderId) : undefined,
      };
    });

    return NextResponse.json({ videos }, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      },
    });
  } catch (err) {
    console.error("Failed to fetch videos for API:", err);
    return NextResponse.json({ videos: [] }, { status: 500 });
  }
}
