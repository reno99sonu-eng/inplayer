import { getReadyVideos } from "@/app/lib/videoStore";
import Link from "next/link";
import Image from "next/image";
import { Film } from "lucide-react";
import BackButton from "@/app/components/BackButton";

export const dynamic = "force-dynamic";

interface VideosPageProps {
  searchParams: Promise<{ category?: string; search?: string }>;
}

export default async function VideosPage({ searchParams }: VideosPageProps) {
  const { category, search } = await searchParams;

  // Shared 30-second cached list (see lib/videoStore) — no per-request
  // table Scan. Already sorted newest-first.
  let videos = (await getReadyVideos())
    // Only public videos appear in listings (unlisted stays link-only,
    // private stays hidden from discovery).
    .filter((v) => !v.visibility || v.visibility === "public");

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
