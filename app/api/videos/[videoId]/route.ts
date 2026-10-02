import { NextResponse } from "next/server";
import { resolveUsernames } from "@/app/lib/resolveUsernames";
import { getShareableVideoById } from "@/app/lib/sharedContent";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ videoId: string }> }
) {
  const { videoId } = await params;
  
  try {
    const video = await getShareableVideoById(videoId);

    if (!video) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    
    const uploaderId = video.uploaderId as string | undefined;
    let uploaderUsername;
    if (uploaderId) {
      const usernames = await resolveUsernames([uploaderId]);
      uploaderUsername = usernames.get(uploaderId);
    }

    return NextResponse.json({
      ...video,
      uploaderUsername,
    });
  } catch (err) {
    console.error("Failed to fetch video details for API:", err);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
