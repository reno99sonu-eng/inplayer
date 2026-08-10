import { NextResponse } from "next/server";
import { getReadyVideos } from "@/app/lib/videoStore";
import { resolveUsernames } from "@/app/lib/resolveUsernames";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const channelId = searchParams.get("channelId");
  
  try {
    const allReady = await getReadyVideos();
    let items = allReady.filter(
      (v) => !v.visibility || v.visibility === "public"
    );
    
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
