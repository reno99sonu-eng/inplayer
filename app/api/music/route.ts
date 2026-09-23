import { NextResponse } from "next/server";
import { getVisibleVideos } from "@/app/lib/contentAccessServer";
import { isMusicType } from "@/app/lib/contentTypes";
import { resolveUsernames } from "@/app/lib/resolveUsernames";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const genre = searchParams.get("genre");
  const channelId = searchParams.get("channelId");

  try {
    const allVideos = await getVisibleVideos();
    // Strict Isolation: Only items uploaded explicitly as music (contentType === "music")
    // Regular videos that creators merely categorized under "Music" belong in the main video library.
    let musicVideos = allVideos.filter(
      (v) =>
        isMusicType(v.contentType) &&
        (!v.visibility || v.visibility === "public")
    );

    if (channelId) {
      musicVideos = musicVideos.filter((v) => v.uploaderId === channelId);
    }

    const usernames = await resolveUsernames(
      musicVideos.map((v) => v.uploaderId as string | null | undefined)
    );

    const tracks = musicVideos.map((v) => {
      const videoId = v.videoId as string;
      const uploaderId = v.uploaderId as string | undefined;

      // Extract music settings
      const musicSettings = (v.musicSettings as Record<string, unknown>) || {};
      const rawCovers = musicSettings.covers;
      const covers =
        Array.isArray(rawCovers) && rawCovers.length > 0
          ? (rawCovers as string[])
          : v.thumbnailUrl
          ? [v.thumbnailUrl as string]
          : ["/recommendations/thumbnails/1.jpg"];

      const primaryCover = covers[0] || (v.thumbnailUrl as string) || "";
      const trackGenre =
        (musicSettings.genre as string) ||
        (v.category as string) ||
        "Pop";

      const artistName =
        (musicSettings.artist as string) ||
        (v.uploaderName as string) ||
        "Unknown Artist";

      return {
        id: videoId,
        videoId,
        title: (v.title as string) || "Untitled Track",
        artist: artistName,
        creator: artistName,
        uploaderId,
        uploaderUsername: uploaderId ? usernames.get(uploaderId) : undefined,
        uploaderAvatarUrl: (v.uploaderAvatarUrl as string) || undefined,
        avatar: (v.uploaderAvatarUrl as string) || "",
        thumbnail: primaryCover,
        thumbnailUrl: primaryCover,
        covers,
        coverIntervalSeconds:
          typeof musicSettings.coverIntervalSeconds === "number"
            ? musicSettings.coverIntervalSeconds
            : 7,
        lyrics: Array.isArray(musicSettings.lyrics) ? musicSettings.lyrics : [],
        genre: trackGenre,
        category: "Music",
        contentType: "music",
        isMusic: true,
        muxPlaybackId: (v.muxPlaybackId as string) || undefined,
        duration: (v.duration as number) || 0,
        views: (v.views as number) || 0,
        uploadedAt: (v.uploadedAt as string) || new Date().toISOString(),
        visibility: "public",
      };
    });

    let filtered = tracks;
    if (genre && genre.toLowerCase() !== "all") {
      filtered = tracks.filter(
        (t) => t.genre.toLowerCase() === genre.toLowerCase()
      );
    }

    return NextResponse.json(
      {
        tracks: filtered,
        // Also provide `videos` alias so standard Video.fromJson deserializers in Android
        // parse the tracks seamlessly without altering their schema expectations.
        videos: filtered,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      }
    );
  } catch (err) {
    console.error("Failed to fetch music tracks:", err);
    return NextResponse.json({ tracks: [], videos: [] }, { status: 500 });
  }
}
