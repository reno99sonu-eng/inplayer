import type { Metadata } from "next";
import { getVisibleVideos } from "@/app/lib/contentAccessServer";
import { isMusicType } from "@/app/lib/contentTypes";
import { resolveUsernames } from "@/app/lib/resolveUsernames";
import type { MusicTrack } from "@/app/context/MusicPlayerContext";
import MusicPageClient from "@/app/components/music/MusicPageClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "InPlayer Music | Listen to Trending Tracks & Hits",
  description:
    "Discover trending music, browse popular genres, and listen to top creator tracks on InPlayer Music.",
  alternates: { canonical: "/music" },
};

interface MusicPageProps {
  searchParams: Promise<{ v?: string; genre?: string }>;
}

export default async function MusicPage({ searchParams }: MusicPageProps) {
  const { v: initialVideoId } = await searchParams;

  let tracks: MusicTrack[] = [];
  let topArtists: {
    id: string;
    name: string;
    username?: string;
    avatarUrl?: string;
    tracksCount: number;
  }[] = [];

  try {
    const allVideos = await getVisibleVideos();
    const musicVideos = allVideos.filter(
      (v) =>
        isMusicType(v.contentType) &&
        (!v.visibility || v.visibility === "public")
    );

    const usernames = await resolveUsernames(
      musicVideos.map((v) => v.uploaderId as string | null | undefined)
    );

    tracks = musicVideos.map((v) => {
      const videoId = v.videoId as string;
      const uploaderId = v.uploaderId as string | undefined;

      // Extract music settings
      const musicSettings = (v.musicSettings as any) || {};
      const covers = Array.isArray(musicSettings.covers) && musicSettings.covers.length > 0
        ? musicSettings.covers
        : v.thumbnailUrl
        ? [v.thumbnailUrl as string]
        : ["/recommendations/thumbnails/1.jpg"];

      return {
        videoId,
        title: (v.title as string) || "Untitled Track",
        artist: (v.uploaderName as string) || "Unknown Artist",
        uploaderId,
        uploaderUsername: uploaderId ? usernames.get(uploaderId) : undefined,
        uploaderAvatarUrl: v.uploaderAvatarUrl as string | undefined,
        covers,
        coverIntervalSeconds: musicSettings.coverIntervalSeconds || 7,
        lyrics: Array.isArray(musicSettings.lyrics) ? musicSettings.lyrics : [],
        genre: (musicSettings.genre as string) || (v.category as string) || "Pop",
        muxPlaybackId: v.muxPlaybackId as string | undefined,
        duration: (v.duration as number) || 0,
        views: (v.views as number) || 0,
        likeCount: (v.likeCount as number) || 0,
      };
    });

    // If initialVideoId is specified, place it first in the list
    if (initialVideoId) {
      const idx = tracks.findIndex((t) => t.videoId === initialVideoId);
      if (idx > 0) {
        const [target] = tracks.splice(idx, 1);
        tracks.unshift(target);
      }
    }

    // Aggregate top artists
    const artistMap = new Map<string, { id: string; name: string; username?: string; avatarUrl?: string; tracksCount: number }>();
    for (const t of tracks) {
      const id = t.uploaderId || t.artist;
      const existing = artistMap.get(id);
      if (existing) {
        existing.tracksCount += 1;
      } else {
        artistMap.set(id, {
          id,
          name: t.artist,
          username: t.uploaderUsername,
          avatarUrl: t.uploaderAvatarUrl,
          tracksCount: 1,
        });
      }
    }
    topArtists = Array.from(artistMap.values())
      .sort((a, b) => b.tracksCount - a.tracksCount)
      .slice(0, 12);
  } catch (err) {
    console.error("Failed to load music tracks:", err);
  }

  return <MusicPageClient tracks={tracks} topArtists={topArtists} />;
}
