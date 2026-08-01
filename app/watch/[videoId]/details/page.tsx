import { GetCommand } from "@aws-sdk/lib-dynamodb";
import Link from "next/link";
import Image from "next/image";
import { Play, Plus, ArrowLeft, Eye, Calendar, Tag } from "lucide-react";

import { docClient } from "@/app/lib/dynamodb";
import { resolveUsernames } from "@/app/lib/resolveUsernames";

export const dynamic = "force-dynamic";

interface DetailsPageProps {
  params: Promise<{
    videoId: string;
  }>;
}

export default async function DetailsPage({ params }: DetailsPageProps) {
  const { videoId } = await params;

  const result = await docClient.send(
    new GetCommand({
      TableName: "InPlayer-Videos",
      Key: { videoId },
    })
  );

  const video = result.Item;

  if (!video) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050816] text-white">
        <div className="text-center px-4">
          <h1 className="text-3xl font-black">Video not found</h1>
          <p className="mt-3 text-slate-400">This video doesn't exist or has been removed.</p>
          <Link
            href="/"
            className="mt-8 inline-flex rounded-xl bg-orange-500 px-6 py-3 font-semibold text-white hover:bg-orange-600"
          >
            Return Home
          </Link>
        </div>
      </div>
    );
  }

  const usernameMap = await resolveUsernames([video.uploaderId]);
  const uploaderUsername = usernameMap.get(video.uploaderId) ?? video.uploaderName;

  const thumbnailSrc = video.thumbnailUrl || "/recommendations/thumbnails/1.jpg";

  return (
    <main className="min-h-screen bg-[#050816] text-white">
      {/* HERO BANNER SECTION */}
      <section className="relative min-h-[340px] sm:min-h-[420px] lg:h-[50vh] xl:h-[55vh] max-h-[600px] w-full overflow-hidden bg-black">
        {/* Background Image Banner matching homepage hero */}
        <div className="absolute inset-0 z-0">
          <Image
            src={thumbnailSrc}
            alt={video.title}
            fill
            priority
            sizes="100vw"
            className="object-cover object-center opacity-65"
          />
          {/* Gradient Overlays */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#050816] via-[#050816]/75 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#050816] via-transparent to-transparent" />
        </div>

        {/* Hero Content Grid */}
        <div className="relative z-20 flex h-full max-w-7xl items-end mx-auto px-4 sm:px-8 pb-8 pt-12 sm:pb-12">
          <div className="flex w-full items-end justify-between gap-8">
            {/* Left Column: Text & Controls */}
            <div className="max-w-2xl min-w-0">
              <Link
                href="/"
                className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3.5 py-1.5 text-xs font-semibold backdrop-blur-lg hover:bg-white/20 transition"
              >
                <ArrowLeft size={14} />
                Back to Home
              </Link>

              <div className="mb-3 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-orange-400 animate-pulse" />
                <span className="inline-flex rounded-full border border-orange-400/30 bg-orange-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-orange-300">
                  Featured Weekly Video
                </span>
              </div>

              <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black leading-tight tracking-tight text-white line-clamp-2">
                {video.title}
              </h1>

              <div className="mt-4 flex flex-wrap items-center gap-4 text-xs sm:text-sm text-slate-300">
                <div className="flex items-center gap-1.5">
                  <Eye size={15} className="text-orange-400" />
                  {(video.views ?? 0).toLocaleString()} views
                </div>

                <div className="flex items-center gap-1.5">
                  <Calendar size={15} className="text-orange-400" />
                  {new Date(video.uploadedAt).toLocaleDateString()}
                </div>

                {video.category && (
                  <div className="flex items-center gap-1.5">
                    <Tag size={15} className="text-orange-400" />
                    {video.category}
                  </div>
                )}
              </div>

              <div className="mt-3 text-sm text-slate-200">
                by{" "}
                <Link
                  href={`/u/${encodeURIComponent(uploaderUsername)}`}
                  className="font-bold text-orange-300 hover:underline hover:text-orange-200"
                >
                  {video.uploaderName}
                </Link>
              </div>

              {/* Action Buttons */}
              <div className="mt-6 flex flex-nowrap items-center gap-2 sm:gap-3 overflow-x-auto no-scrollbar">
                <Link
                  href={`/watch/${video.videoId}`}
                  className="flex flex-shrink-0 items-center gap-2 rounded-full bg-gradient-to-r from-orange-500 via-amber-400 to-yellow-300 px-5 sm:px-7 py-2.5 sm:py-3.5 text-xs sm:text-sm font-bold text-slate-900 shadow-lg transition hover:scale-105"
                >
                  <Play size={16} fill="currentColor" />
                  Watch Now
                </Link>

                <button
                  type="button"
                  className="flex flex-shrink-0 items-center gap-2 rounded-full border border-white/15 bg-white/10 px-5 sm:px-7 py-2.5 sm:py-3.5 text-xs sm:text-sm font-semibold backdrop-blur-xl hover:bg-white/20 transition"
                >
                  <Plus size={16} />
                  Watchlist
                </button>
              </div>
            </div>

            {/* Right Column: Poster Card (Fits to screen on md+ devices) */}
            <div className="hidden md:block flex-shrink-0">
              <div className="relative aspect-video w-72 lg:w-96 rounded-2xl overflow-hidden border border-white/15 shadow-[0_20px_50px_rgba(0,0,0,0.6)]">
                <Image
                  src={thumbnailSrc}
                  alt={video.title}
                  fill
                  sizes="384px"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CONTENT DETAILS */}
      <section className="mx-auto max-w-7xl px-4 sm:px-8 py-10">
        <div className="grid gap-8 lg:grid-cols-3">
          {/* LEFT COLUMN: Description & Tags */}
          <div className="lg:col-span-2 space-y-8">
            <div>
              <h2 className="mb-4 text-2xl font-black">Description</h2>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl">
                <p className="whitespace-pre-wrap leading-relaxed text-slate-300 text-sm sm:text-base">
                  {video.description?.trim()
                    ? video.description
                    : "No description has been provided by the creator yet."}
                </p>
              </div>
            </div>

            {video.tags?.length > 0 && (
              <div>
                <h2 className="mb-4 text-2xl font-black">Tags</h2>
                <div className="flex flex-wrap gap-2">
                  {video.tags.map((tag: string) => (
                    <span
                      key={tag}
                      className="rounded-full border border-orange-400/20 bg-orange-500/10 px-3.5 py-1.5 text-xs font-semibold text-orange-300"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: Video Metadata Card */}
          <div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl">
              <h3 className="text-xl font-black">Video Information</h3>

              <div className="mt-6 space-y-4 text-sm">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Creator</p>
                  <Link
                    href={`/u/${encodeURIComponent(uploaderUsername)}`}
                    className="mt-0.5 block font-semibold text-orange-300 hover:underline"
                  >
                    {video.uploaderName}
                  </Link>
                </div>

                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Category</p>
                  <p className="mt-0.5 font-medium">{video.category || "Uncategorized"}</p>
                </div>

                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Views</p>
                  <p className="mt-0.5 font-medium">{(video.views ?? 0).toLocaleString()}</p>
                </div>

                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Uploaded</p>
                  <p className="mt-0.5 font-medium">{new Date(video.uploadedAt).toLocaleDateString()}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}