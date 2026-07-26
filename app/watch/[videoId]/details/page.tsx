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

export default async function DetailsPage({
  params,
}: DetailsPageProps) {
  const { videoId } = await params;

  const result = await docClient.send(
    new GetCommand({
      TableName: "InPlayer-Videos",
      Key: {
        videoId,
      },
    })
  );

  const video = result.Item;

  if (!video) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050816] text-white">
        <div className="text-center">
          <h1 className="text-3xl font-black">
            Video not found
          </h1>

          <p className="mt-3 text-slate-400">
            This video doesn't exist or has been removed.
          </p>

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

  const usernameMap = await resolveUsernames([
    video.uploaderId,
  ]);

  const uploaderUsername =
    usernameMap.get(video.uploaderId) ??
    video.uploaderName;

  return (
    <main className="min-h-screen bg-[#050816] text-white">

      {/* HERO */}

      <section className="relative h-[70vh] w-full overflow-hidden">

        <Image
          src={video.thumbnailUrl}
          alt={video.title}
          fill
          priority
          className="object-cover"
        />

        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/70 to-transparent" />

        <div className="absolute inset-0 bg-gradient-to-t from-[#050816] via-transparent to-transparent" />

        <div className="relative z-20 flex h-full max-w-7xl items-end px-8 pb-12">

          <div className="max-w-3xl">

            <Link
              href="/"
              className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm backdrop-blur-lg hover:bg-white/20"
            >
              <ArrowLeft size={16} />
              Back
            </Link>

            <div className="mb-4 inline-flex rounded-full border border-orange-400/30 bg-orange-500/10 px-4 py-1 text-xs font-bold uppercase tracking-widest text-orange-300">
              Featured Weekly
            </div>

            <h1 className="text-5xl font-black leading-tight">
              {video.title}
            </h1>

            <div className="mt-6 flex flex-wrap items-center gap-6 text-sm text-slate-300">

              <div className="flex items-center gap-2">
                <Eye size={16} />
                {(video.views ?? 0).toLocaleString()} views
              </div>

              <div className="flex items-center gap-2">
                <Calendar size={16} />
                {new Date(
                  video.uploadedAt
                ).toLocaleDateString()}
              </div>

              <div className="flex items-center gap-2">
                <Tag size={16} />
                {video.category}
              </div>

            </div>

            <div className="mt-4 text-lg text-slate-200">
              by{" "}
              <Link
                href={`/creator/${uploaderUsername}`}
                className="font-semibold text-orange-300 hover:text-orange-200"
              >
                {video.uploaderName}
              </Link>
            </div>

            <div className="mt-8 flex flex-wrap gap-4">

              <Link
                href={`/watch/${video.videoId}`}
                className="inline-flex items-center gap-2 rounded-full bg-orange-500 px-8 py-4 font-bold text-white transition hover:bg-orange-600"
              >
                <Play
                  size={18}
                  fill="currentColor"
                />
                Watch Now
              </Link>

              <button
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-8 py-4 font-semibold backdrop-blur-xl hover:bg-white/20"
              >
                <Plus size={18} />
                Watchlist
              </button>

            </div>

          </div>

        </div>

      </section>

            {/* CONTENT */}

            <section className="mx-auto max-w-7xl px-8 py-14">

<div className="grid gap-12 lg:grid-cols-3">

  {/* LEFT COLUMN */}

  <div className="lg:col-span-2">

    <h2 className="mb-5 text-3xl font-black">
      Description
    </h2>

    <div className="rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-xl">

      <p className="whitespace-pre-wrap leading-8 text-slate-300">
        {video.description?.trim()
          ? video.description
          : "No description has been provided by the creator yet."}
      </p>

    </div>

    {video.tags?.length > 0 && (
      <>

        <h2 className="mt-10 mb-5 text-3xl font-black">
          Tags
        </h2>

        <div className="flex flex-wrap gap-3">

          {video.tags.map((tag: string) => (
            <span
              key={tag}
              className="rounded-full border border-orange-400/20 bg-orange-500/10 px-4 py-2 text-sm text-orange-300"
            >
              #{tag}
            </span>
          ))}

        </div>

      </>
    )}

  </div>

  {/* RIGHT COLUMN */}

  <div>

    <div className="rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-xl">

      <h3 className="text-2xl font-black">
        Video Information
      </h3>

      <div className="mt-8 space-y-5">

        <div>
          <p className="text-xs uppercase tracking-widest text-slate-500">
            Creator
          </p>

          <Link
            href={`/creator/${uploaderUsername}`}
            className="mt-1 block text-lg font-semibold text-orange-300 hover:text-orange-200"
          >
            {video.uploaderName}
          </Link>
        </div>

        <div>
          <p className="text-xs uppercase tracking-widest text-slate-500">
            Category
          </p>

          <p className="mt-1 text-lg">
            {video.category || "Uncategorized"}
          </p>
        </div>

        <div>
          <p className="text-xs uppercase tracking-widest text-slate-500">
            Views
          </p>

          <p className="mt-1 text-lg">
            {(video.views ?? 0).toLocaleString()}
          </p>
        </div>

        <div>
          <p className="text-xs uppercase tracking-widest text-slate-500">
            Uploaded
          </p>

          <p className="mt-1 text-lg">
            {new Date(video.uploadedAt).toLocaleDateString()}
          </p>
        </div>

      </div>

    </div>

  </div>

</div>

</section>

</main>
);
}