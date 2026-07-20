"use client";

import { useEffect, useState } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import Image from "next/image";
import Link from "next/link";
import { Pencil, Trash2, Loader2, X, Check } from "lucide-react";
import { useAuthModal } from "@/app/components/auth/AuthProvider";
import { formatViews, formatTimeAgo } from "@/app/lib/formatters";

const CATEGORIES = [
  "Movies",
  "Trending",
  "Music",
  "Gaming",
  "AI",
  "Live",
  "Podcasts",
  "News",
  "Sports",
  "Kids",
  "Comedy",
  "Education",
];

interface MyVideo {
  videoId: string;
  title: string;
  description: string;
  category: string;
  status: string;
  thumbnailUrl?: string;
  views: number;
  uploadedAt: string;
}

export default function MyVideosPage() {
  const { signedIn, authLoading, openSignIn } = useAuthModal();
  const [videos, setVideos] = useState<MyVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!signedIn) {
      setLoading(false);
      return;
    }

    async function load() {
      try {
        const session = await fetchAuthSession();
        const idToken = session.tokens?.idToken?.toString();

        const res = await fetch("/api/my-videos", {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        const data = await res.json();
        setVideos(data.videos || []);
      } catch (err) {
        console.error("Failed to load your videos:", err);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [signedIn]);

  const startEditing = (video: MyVideo) => {
    setEditingId(video.videoId);
    setEditTitle(video.title);
    setEditDescription(video.description || "");
    setEditCategory(video.category);
    setError(null);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setError(null);
  };

  const handleSave = async (videoId: string) => {
    if (!editTitle.trim()) {
      setError("Title can't be empty.");
      return;
    }

    setSavingId(videoId);
    setError(null);

    try {
      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken?.toString();

      const res = await fetch(`/api/my-videos/${videoId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          title: editTitle.trim(),
          description: editDescription.trim(),
          category: editCategory,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Couldn't save changes.");
        return;
      }

      setVideos((prev) =>
        prev.map((v) =>
          v.videoId === videoId
            ? {
                ...v,
                title: editTitle.trim(),
                description: editDescription.trim(),
                category: editCategory,
              }
            : v
        )
      );
      setEditingId(null);
    } catch (err) {
      console.error("Failed to save video edits:", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (videoId: string) => {
    setDeletingId(videoId);

    try {
      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken?.toString();

      const res = await fetch(`/api/my-videos/${videoId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${idToken}` },
      });

      if (res.ok) {
        setVideos((prev) => prev.filter((v) => v.videoId !== videoId));
      }
    } catch (err) {
      console.error("Failed to delete video:", err);
    } finally {
      setDeletingId(null);
      setConfirmingDeleteId(null);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 size={28} className="animate-spin text-orange-400" />
      </div>
    );
  }

  if (!signedIn) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
        <h2 className="text-2xl font-black text-white light:text-slate-900">
          Sign in to see your videos
        </h2>
        <button
          onClick={openSignIn}
          className="mt-6 rounded-2xl bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] px-8 py-3 font-bold text-white shadow-[0_15px_35px_rgba(255,153,0,.3)] transition-all hover:-translate-y-0.5"
        >
          Sign In
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1000px] px-4 py-8 sm:py-12">
      <h1 className="text-2xl sm:text-3xl font-black text-white light:text-slate-900">
        Your Channel
      </h1>
      <p className="mt-1 text-sm text-slate-400 light:text-slate-600">
        Manage everything you've uploaded to InPlayer.
      </p>

      {videos.length === 0 ? (
        <div className="mt-16 flex flex-col items-center justify-center text-center">
          <p className="font-semibold text-white light:text-slate-900">
            You haven't uploaded anything yet
          </p>
          <Link
            href="/upload"
            className="mt-4 rounded-2xl bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] px-6 py-2.5 text-sm font-bold text-white"
          >
            Upload a video
          </Link>
        </div>
      ) : (
        <div className="mt-8 space-y-3">
          {videos.map((video) => (
            <div
              key={video.videoId}
              className="rounded-2xl border border-white/10 light:border-black/10 bg-white/[0.02] light:bg-black/[0.02] p-4"
            >
              {editingId === video.videoId ? (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full rounded-xl border border-white/10 light:border-black/10 bg-[#07111F] light:bg-[#FAF5E9] px-3 py-2 text-sm text-white light:text-slate-900 outline-none focus:border-orange-400/50"
                    placeholder="Title"
                  />
                  <textarea
                    rows={2}
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="w-full resize-none rounded-xl border border-white/10 light:border-black/10 bg-[#07111F] light:bg-[#FAF5E9] px-3 py-2 text-sm text-white light:text-slate-900 outline-none focus:border-orange-400/50"
                    placeholder="Description"
                  />
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    className="w-full rounded-xl border border-white/10 light:border-black/10 bg-[#07111F] light:bg-[#FAF5E9] px-3 py-2 text-sm text-white light:text-slate-900 outline-none focus:border-orange-400/50"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>

                  {error && <p className="text-xs text-red-400">{error}</p>}

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSave(video.videoId)}
                      disabled={savingId === video.videoId}
                      className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
                    >
                      <Check size={14} />
                      {savingId === video.videoId ? "Saving..." : "Save"}
                    </button>
                    <button
                      onClick={cancelEditing}
                      className="flex items-center gap-1.5 rounded-full border border-white/10 light:border-black/10 px-4 py-2 text-xs font-semibold text-slate-300 light:text-slate-700"
                    >
                      <X size={14} />
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-4">
                  <div className="relative h-[70px] w-[125px] flex-shrink-0 overflow-hidden rounded-xl bg-white/5 light:bg-black/5">
                    {video.thumbnailUrl && (
                      <Image
                        src={video.thumbnailUrl}
                        alt={video.title}
                        fill
                        sizes="125px"
                        className="object-cover"
                      />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-semibold text-white light:text-slate-900">
                      {video.title}
                    </h3>
                    <p className="text-xs text-slate-400 light:text-slate-600">
                      {video.category} • {formatViews(video.views || 0)} •{" "}
                      {formatTimeAgo(video.uploadedAt)}
                    </p>

                    <span
                      className={`mt-2 inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                        video.status === "ready"
                          ? "bg-emerald-500/15 text-emerald-400"
                          : video.status === "processing"
                          ? "bg-amber-500/15 text-amber-400"
                          : "bg-red-500/15 text-red-400"
                      }`}
                    >
                      {video.status}
                    </span>
                  </div>

                  <div className="flex flex-shrink-0 items-start gap-1">
                    <button
                      onClick={() => startEditing(video)}
                      className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition hover:bg-white/5 light:hover:bg-black/5 hover:text-white light:hover:text-slate-900"
                    >
                      <Pencil size={15} />
                    </button>

                    {confirmingDeleteId === video.videoId ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDelete(video.videoId)}
                          disabled={deletingId === video.videoId}
                          className="rounded-full bg-red-500/15 px-3 py-1.5 text-xs font-bold text-red-400 disabled:opacity-60"
                        >
                          {deletingId === video.videoId ? "..." : "Confirm"}
                        </button>
                        <button
                          onClick={() => setConfirmingDeleteId(null)}
                          className="rounded-full px-3 py-1.5 text-xs font-semibold text-slate-400 hover:bg-white/5 light:hover:bg-black/5"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmingDeleteId(video.videoId)}
                        className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition hover:bg-red-500/10 hover:text-red-400"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
