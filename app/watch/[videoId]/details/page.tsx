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
          <h1 className="text-2xl font-black">Video not found</h1>
          <p className="mt-2 text-sm text-slate-400">This video doesn&apos;t exist or has been removed.</p>
          <Link
            href="/"
            className="mt-6 inline-flex rounded-xl bg-orange-500 px-5 py-2.5 text-xs font-bold text-white hover:bg-orange-600"
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
      {/* HERO BANNER SECTION - Compact height across devices */}
      <section className="relative min-h-[260px] sm:min-h-[320px] lg:h-[40vh] max-h-[440px] w-full overflow-hidden bg-black">
        {/* Animated Back Arrow Button at Top Left Corner */}
        <Link
          href="/"
          aria-label="Back to home"
          className="group absolute top-4 left-4 z-30 flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/40 text-white backdrop-blur-md transition-all hover:scale-110 hover:border-orange-400/50 hover:bg-black/60"
        >
          <ArrowLeft size={18} className="transition-transform duration-300 group-hover:-translate-x-0.5" />
        </Link>

        {/* Background Image Banner */}
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
          <div className="absolute inset-0 bg-gradient-to-r from-[#050816] via-[#050816]/80 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#050816] via-transparent to-transparent" />
        </div>

        {/* Hero Content Grid */}
        <div className="relative z-20 flex h-full max-w-7xl items-end mx-auto px-4 sm:px-8 pb-5 pt-14">
          <div className="flex w-full items-end justify-between gap-6">
            {/* Left Column: Text & Single-Line Metadata/Actions Bar */}
            <div className="max-w-3xl min-w-0 flex-1">
              {/* Compact Orange Badge */}
              <div className="mb-2 flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-orange-400 animate-pulse" />
                <span className="inline-flex rounded-full border border-orange-400/30 bg-orange-500/10 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-orange-300">
                  Featured Weekly Video
                </span>
              </div>

              {/* Smaller Video Title */}
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-black leading-tight tracking-tight text-white line-clamp-2">
                {video.title}
              </h1>

              {/* Compact Metadata + Buttons Single Line Row */}
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-slate-300">
                <div className="flex items-center gap-1">
                  <Eye size={13} className="text-orange-400" />
                  <span>{(video.views ?? 0).toLocaleString()} views</span>
                </div>

                <span className="text-slate-600">•</span>

                <div className="flex items-center gap-1">
                  <Calendar size={13} className="text-orange-400" />
                  <span>{new Date(video.uploadedAt).toLocaleDateString()}</span>
                </div>

                {video.category && (
                  <>
                    <span className="text-slate-600">•</span>
                    <div className="flex items-center gap-1">
                      <Tag size={13} className="text-orange-400" />
                      <span>{video.category}</span>
                    </div>
                  </>
                )}

                <span className="text-slate-600">•</span>

                <div>
                  by{" "}
                  <Link
                    href={`/u/${encodeURIComponent(uploaderUsername)}`}
                    className="font-bold text-orange-300 hover:underline hover:text-orange-200"
                  >
                    {video.uploaderName}
                  </Link>
                </div>

                {/* Compact Action Buttons Inline */}
                <div className="flex items-center gap-2 sm:ml-2">
                  <Link
                    href={`/watch/${video.videoId}`}
                    className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-orange-500 via-amber-400 to-yellow-300 px-4 py-1.5 text-xs font-bold text-slate-900 shadow-md transition hover:scale-105"
                  >
                    <Play size={13} fill="currentColor" />
                    Watch Now
                  </Link>

                  <button
                    type="button"
                    className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-xs font-semibold backdrop-blur-xl hover:bg-white/20 transition"
                  >
                    <Plus size={13} />
                    Watchlist
                  </button>
                </div>
              </div>
            </div>

            {/* Right Column: Compact Poster Card */}
            <div className="hidden md:block flex-shrink-0">
              <div className="relative aspect-video w-56 lg:w-72 rounded-2xl overflow-hidden border border-white/15 shadow-[0_15px_40px_rgba(0,0,0,0.6)]">
                <Image
                  src={thumbnailSrc}
                  alt={video.title}
                  fill
                  sizes="288px"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CONTENT DETAILS - Compact Gaps & Padding */}
      <section className="mx-auto max-w-7xl px-4 sm:px-8 py-6 sm:py-8">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* LEFT COLUMN: Description & Tags */}
          <div className="lg:col-span-2 space-y-6">
            <div>
              <h2 className="mb-3 text-lg font-black">Description</h2>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5 backdrop-blur-xl">
                <p className="whitespace-pre-wrap leading-relaxed text-slate-300 text-xs sm:text-sm">
                  {video.description?.trim()
                    ? video.description
                    : "No description has been provided by the creator yet."}
                </p>
              </div>
            </div>

            {video.tags?.length > 0 && (
              <div>
                <h2 className="mb-3 text-lg font-black">Tags</h2>
                <div className="flex flex-wrap gap-2">
                  {video.tags.map((tag: string) => (
                    <span
                      key={tag}
                      className="rounded-full border border-orange-400/20 bg-orange-500/10 px-3 py-1 text-xs font-semibold text-orange-300"
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
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl">
              <h3 className="text-base font-black">Video Information</h3>

              <div className="mt-4 space-y-3 text-xs">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Creator</p>
                  <Link
                    href={`/u/${encodeURIComponent(uploaderUsername)}`}
                    className="mt-0.5 block font-semibold text-orange-300 hover:underline"
                  >
                    {video.uploaderName}
                  </Link>
                </div>

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Category</p>
                  <p className="mt-0.5 font-medium text-slate-200">{video.category || "Uncategorized"}</p>
                </div>

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Views</p>
                  <p className="mt-0.5 font-medium text-slate-200">{(video.views ?? 0).toLocaleString()}</p>
                </div>

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Uploaded</p>
                  <p className="mt-0.5 font-medium text-slate-200">{new Date(video.uploadedAt).toLocaleDateString()}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}