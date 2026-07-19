"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchAuthSession } from "aws-amplify/auth";
import {
  UploadCloud,
  Film,
  Loader2,
  CheckCircle2,
  X,
} from "lucide-react";
import { useAuthModal } from "@/app/components/auth/AuthProvider";

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

type Stage = "picking" | "details" | "uploading" | "processing" | "error";

export default function UploadPage() {
  const router = useRouter();
  const { signedIn, authLoading, openSignIn } = useAuthModal();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);

  const [stage, setStage] = useState<Stage>("picking");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleFile = (selected: File | null) => {
    if (!selected) return;

    if (!selected.type.startsWith("video/")) {
      setError("Please choose a video file.");
      return;
    }

    setError(null);
    setFile(selected);

    const nameWithoutExt = selected.name.replace(/\.[^/.]+$/, "");
    setTitle(nameWithoutExt);

    setStage("details");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    handleFile(e.dataTransfer.files?.[0] || null);
  };

  const handlePublish = async () => {
    if (!file) return;

    if (!title.trim()) {
      setError("Please give your video a title.");
      return;
    }

    setError(null);
    setStage("uploading");
    setProgress(0);

    try {
      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken?.toString();

      if (!idToken) {
        setError("Your session has expired. Please sign in again.");
        setStage("error");
        return;
      }

      const createRes = await fetch("/api/upload/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          category,
        }),
      });

      const createData = await createRes.json();

      if (!createRes.ok) {
        setError(createData.error || "Couldn't start the upload. Please try again.");
        setStage("error");
        return;
      }

      const { uploadUrl } = createData;

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl);

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            setProgress(Math.round((event.loaded / event.total) * 100));
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        };

        xhr.onerror = () => reject(new Error("Network error during upload"));

        xhr.send(file);
      });

      setStage("processing");
    } catch (err) {
      console.error("Upload error:", err);
      setError("Something went wrong uploading your video. Please try again.");
      setStage("error");
    }
  };

  const resetUpload = () => {
    setFile(null);
    setTitle("");
    setDescription("");
    setCategory(CATEGORIES[0]);
    setStage("picking");
    setProgress(0);
    setError(null);
  };

  if (authLoading) {
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
          Sign in to upload
        </h2>
        <p className="mt-2 max-w-sm text-sm text-slate-400 light:text-slate-500">
          You need an InPlayer account to upload videos.
        </p>
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
    <div className="mx-auto max-w-[720px] px-4 py-8 sm:py-12">
      <h1 className="text-2xl sm:text-3xl font-black text-white light:text-slate-900">
        Upload Video
      </h1>
      <p className="mt-1 text-sm text-slate-400 light:text-slate-500">
        Share your content with the InPlayer community.
      </p>

      <div className="mt-8">
        {stage === "picking" && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`
              flex flex-col items-center justify-center gap-4
              rounded-[28px] border-2 border-dashed
              px-6 py-16 sm:py-20
              text-center cursor-pointer
              transition-all duration-300
              ${
                dragActive
                  ? "border-orange-400 bg-orange-500/10"
                  : "border-white/15 light:border-black/15 bg-white/[0.02] light:bg-black/[0.02] hover:border-orange-400/50"
              }
            `}
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-orange-500/10">
              <UploadCloud size={28} className="text-orange-400" />
            </div>
            <div>
              <p className="font-semibold text-white light:text-slate-900">
                Drag and drop a video file
              </p>
              <p className="mt-1 text-sm text-slate-400 light:text-slate-500">
                or click to browse from your computer
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0] || null)}
            />
          </div>
        )}

        {(stage === "details" || stage === "error") && file && (
          <div className="space-y-5">
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.02] p-4">
              <Film size={20} className="flex-shrink-0 text-orange-400" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white light:text-slate-900">
                  {file.name}
                </p>
                <p className="text-xs text-slate-400 light:text-slate-500">
                  {(file.size / (1024 * 1024)).toFixed(1)} MB
                </p>
              </div>
              <button
                onClick={resetUpload}
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-white/5 light:hover:bg-black/5 hover:text-white light:hover:text-slate-900"
              >
                <X size={16} />
              </button>
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium text-slate-400 light:text-slate-500">
                Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-2xl border border-white/10 light:border-black/10 bg-[#07111F] light:bg-black/[0.03] px-4 py-3 text-white light:text-slate-900 caret-orange-400 outline-none focus:border-orange-400/50"
                placeholder="Give your video a title"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium text-slate-400 light:text-slate-500">
                Description
              </label>
              <textarea
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full resize-none rounded-2xl border border-white/10 light:border-black/10 bg-[#07111F] light:bg-black/[0.03] px-4 py-3 text-white light:text-slate-900 caret-orange-400 outline-none focus:border-orange-400/50"
                placeholder="Tell viewers about your video"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium text-slate-400 light:text-slate-500">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-2xl border border-white/10 light:border-black/10 bg-[#07111F] light:bg-black/[0.03] px-4 py-3 text-white light:text-slate-900 outline-none focus:border-orange-400/50"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c} className="bg-[#07111F] text-white">
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {error && (
              <p className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300 light:text-red-700">
                {error}
              </p>
            )}

            <button
              onClick={handlePublish}
              className="w-full rounded-2xl bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] py-3.5 font-bold text-white shadow-[0_15px_35px_rgba(255,153,0,.3)] transition-all hover:-translate-y-0.5 active:scale-[0.98]"
            >
              Publish
            </button>
          </div>
        )}

        {stage === "uploading" && (
          <div className="flex flex-col items-center gap-5 py-12 text-center">
            <div className="relative h-20 w-20">
              <svg className="h-20 w-20 -rotate-90" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="34" fill="none" stroke="currentColor" strokeWidth="6" className="text-white/10 light:text-black/10" />
                <circle
                  cx="40"
                  cy="40"
                  r="34"
                  fill="none"
                  stroke="url(#uploadGradient)"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 34}`}
                  strokeDashoffset={`${2 * Math.PI * 34 * (1 - progress / 100)}`}
                  className="transition-all duration-300"
                />
                <defs>
                  <linearGradient id="uploadGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#FF7A18" />
                    <stop offset="100%" stopColor="#FFD54A" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white light:text-slate-900">
                {progress}%
              </div>
            </div>
            <div>
              <p className="font-semibold text-white light:text-slate-900">
                Uploading your video...
              </p>
              <p className="mt-1 text-sm text-slate-400 light:text-slate-500">
                Please keep this tab open.
              </p>
            </div>
          </div>
        )}

        {stage === "processing" && (
          <div className="flex flex-col items-center gap-5 py-12 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/15 border border-emerald-400/30">
              <CheckCircle2 size={36} className="text-emerald-400" />
            </div>
            <div>
              <p className="font-semibold text-white light:text-slate-900">
                Upload complete!
              </p>
              <p className="mt-1 max-w-sm text-sm text-slate-400 light:text-slate-500">
                Your video is being processed now — this usually takes a few minutes. It'll appear on InPlayer automatically once it's ready.
              </p>
            </div>
            <button
              onClick={() => router.push("/")}
              className="mt-2 rounded-2xl border border-white/10 light:border-black/10 px-6 py-2.5 text-sm font-semibold text-slate-200 light:text-slate-700 transition hover:border-orange-400/30 hover:bg-white/5 light:hover:bg-black/5"
            >
              Back to Home
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
