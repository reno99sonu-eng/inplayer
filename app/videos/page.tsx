import { getReadyVideos } from "@/app/lib/videoStore";
import { searchUsersByUsername } from "@/app/lib/userSearch";
import Link from "next/link";
import Image from "next/image";
import { Film } from "lucide-react";
import BackButton from "@/app/components/BackButton";

export const dynamic = "force-dynamic";

interface VideosPageProps {
  searchParams: Promise<{ category?: string; search?: string }>;
}

// The fields this listing page actually reads off a raw ready-video item
// (see app/lib/videoStore.ts, which returns Record<string, unknown>[] —
// the real shape isn't a formal DynamoDB item interface, so the known
// fields are cast once here rather than scattering `as string` everywhere
// below).
interface VideoCard {
  videoId: string;
  title: string;
  uploaderName: string;
  category: string;
  thumbnailUrl?: string;
}

export default async function VideosPage({ searchParams }: VideosPageProps) {
  const { category, search } = await searchParams;

  // A search term also looks for matching creators/usernames — shown as
  // its own row above the video grid — so the homepage search bar can
  // find people, not just video titles.
  const matchingUsers = search ? await searchUsersByUsername(search, 6) : [];

  // Shared 30-second cached list (see lib/videoStore) — no per-request
  // table Scan. Already sorted newest-first.
  let videos: VideoCard[] = (await getReadyVideos())
    // Only public videos appear in listings (unlisted stays link-only,
    // private stays hidden from discovery).
    .filter((v) => !v.visibility || v.visibility === "public")
    .map((v) => ({
      videoId: v.videoId as string,
      title: v.title as string,
      uploaderName: v.uploaderName as string,
      category: v.category as string,
      thumbnailUrl: v.thumbnailUrl as string | undefined,
    }));

  if (category) {
    videos = videos.filter((v) => v.category === category);
  }

  // Free-text / voice search across title, uploader, and category.
  if (search) {
    const q = search.toLowerCase();
    videos = videos.filter(
      (v) =>
        (v.title || "").toLowerCase().includes(q) ||
        (v.uploaderName || "").toLowerCase().includes(q) ||
        (v.category || "").toLowerCase().includes(q)
    );
  }

  const heading = search
    ? `Results for “${search}”`
    : category
      ? category
      : "All Videos";

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-8 sm:py-12">
      <BackButton />

      <h1 className="text-2xl sm:text-3xl font-black text-white light:text-slate-900">
        {heading}
      </h1>
      <p className="mt-1 text-sm text-slate-400 light:text-slate-600">
        {search
          ? `Videos matching “${search}”.`
          : category
            ? `Everything uploaded under ${category}.`
            : "Everything actually uploaded to InPlayer so far."}
      </p>

      {matchingUsers.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-3 text-sm font-black text-white light:text-slate-900">Creators</h2>
          <div className="flex flex-wrap gap-3">
            {matchingUsers.map((u) => (
              <Link
                key={u.userId}
                href={`/u/${encodeURIComponent(u.username)}`}
                className="flex items-center gap-2.5 rounded-full border border-white/10 light:border-black/10 bg-white/[0.02] light:bg-black/[0.02] py-2 pl-2 pr-4 transition hover:border-orange-400/40"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- avatar may be a data URL. */}
                <img
                  src={u.avatarUrl || "/avatars/avatar.png"}
                  alt={u.username}
                  className="h-8 w-8 flex-shrink-0 rounded-full object-cover"
                />
                <span className="text-sm font-semibold text-white light:text-slate-900">
                  @{u.username}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {videos.length === 0 ? (
        <div className="mt-16 flex flex-col items-center justify-center text-center">
          <Film size={40} className="mb-4 text-slate-600" />
          <p className="font-semibold text-white light:text-slate-900">
            {search
              ? `No results for “${search}”`
              : category
                ? `No videos in ${category} yet`
                : "No videos yet"}
          </p>
          <p className="mt-1 text-sm text-slate-400 light:text-slate-600">
            {search
              ? "Try a different search."
              : category
                ? "Try a different category, or check back later."
                : "Upload one to see it appear here."}
          </p>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {videos.map((video) => (
            <Link
              key={video.videoId}
              href={`/watch/${video.videoId}`}
              className="group"
            >
              <div className="relative aspect-video overflow-hidden rounded-2xl bg-white/5 light:bg-black/5">
                {video.thumbnailUrl && (
                  <Image
                    src={video.thumbnailUrl}
                    alt={video.title}
                    fill
                    sizes="(max-width: 768px) 50vw, 25vw"
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                )}
                <div className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  {video.category}
                </div>
              </div>

              <h3 className="mt-2 line-clamp-2 text-sm font-semibold text-white light:text-slate-900">
                {video.title}
              </h3>

              <p className="mt-0.5 text-xs text-slate-400 light:text-slate-600">
                {video.uploaderName}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
