"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchAuthSession } from "aws-amplify/auth";
import { UploadCloud, Film, Loader2, X } from "lucide-react";
import { useAuthModal } from "@/app/components/auth/AuthProvider";
import ProcessingStatus from "@/app/components/ProcessingStatus";
import UploadThumbnailStep from "@/app/components/UploadThumbnailStep";
import BackButton from "@/app/components/BackButton";
import { CONTENT_CATEGORIES } from "@/app/data/categories";
import { compressImageToThumbnail } from "@/app/lib/imageCompress";
import { buildAIGeneratePrompt, parseAITitleSuggestions } from "@/app/lib/aiPrompts";
import VideoMetadataFields, {
  VideoMetadataValue,
  SpokenLanguage,
  Visibility,
} from "@/app/components/VideoMetadataFields";
import AITitleAssistModal from "@/app/components/AITitleAssistModal";
import ShortCreationTools, { ShortSettings } from "@/app/components/ShortCreationTools";

// Same categories as the nav bar's category chips (shared source).
const CATEGORIES = CONTENT_CATEGORIES;

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
  const [contentType, setContentType] = useState<"video" | "short">("video");
  const [shortSettings, setShortSettings] = useState<ShortSettings>({ soundtrack: null, musicClipSeconds: 30, filter: "original" });
  const [spokenLanguage, setSpokenLanguage] = useState<SpokenLanguage>("auto");

  // YouTube-style upload options.
  const [visibility, setVisibility] = useState<Visibility>("public");
  const [madeForKids, setMadeForKids] = useState(false);
  const [ageRestricted, setAgeRestricted] = useState(false);
  const [commentsEnabled, setCommentsEnabled] = useState(true);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");

  // Creator-picked thumbnail. Compressed to a data URL client-side (see
  // compressImageToThumbnail) and sent along with the rest of the form on
  // publish; a null preview means "let Mux use its auto-generated frame."
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [thumbnailBusy, setThumbnailBusy] = useState(false);
  const [thumbnailError, setThumbnailError] = useState<string | null>(null);
  const [aiGenerating, setAiGenerating] = useState(false);

const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);

const [aiType, setAiType] = useState<
  "title" | "description" | "tags" | null
>(null);

const [aiError, setAiError] = useState<string | null>(null);
const [aiTitleAssistOpen, setAiTitleAssistOpen] = useState(false);

  const handleThumbnailSelected = async (selected: File) => {
    if (!selected.type.startsWith("image/")) {
      setThumbnailError("Please choose an image file.");
      return;
    }
    setThumbnailError(null);
    setThumbnailBusy(true);
    try {
      const dataUrl = await compressImageToThumbnail(selected);
      setThumbnailPreview(dataUrl);
    } catch (err) {
      console.error("Thumbnail processing failed:", err);
      setThumbnailError("Couldn't process that image. Please try a different one.");
    } finally {
      setThumbnailBusy(false);
    }
  };

  // Single view of all the metadata fields for VideoMetadataFields (shared
  // with the My Channel edit panel — see that component for why). The page
  // keeps its state as individual hooks (simplest given how many other
  // handlers below already reference them directly) and just assembles/
  // dispatches through this pair.
  const metadataValue: VideoMetadataValue = {
    title,
    description,
    category,
    contentType,
    spokenLanguage,
    visibility,
    madeForKids,
    ageRestricted,
    commentsEnabled,
    tags,
  };

  const handleMetadataChange = <K extends keyof VideoMetadataValue>(
    field: K,
    val: VideoMetadataValue[K]
  ) => {
    switch (field) {
      case "title":
        setTitle(val as string);
        break;
      case "description":
        setDescription(val as string);
        break;
      case "category":
        setCategory(val as string);
        break;
      case "contentType":
        setContentType(val as "video" | "short");
        break;
      case "spokenLanguage":
        setSpokenLanguage(val as SpokenLanguage);
        break;
      case "visibility":
        setVisibility(val as Visibility);
        break;
      case "madeForKids":
        setMadeForKids(val as boolean);
        break;
      case "ageRestricted":
        setAgeRestricted(val as boolean);
        break;
      case "commentsEnabled":
        setCommentsEnabled(val as boolean);
        break;
      case "tags":
        setTags(val as string[]);
        break;
    }
  };

  // Honor a preset from the Create menu (e.g. "Podcast" preselects the
  // Podcasts category). Read once on mount, then clear it.
  useEffect(() => {
    try {
      const preset = sessionStorage.getItem("inplayer-upload-preset");
      if (preset === "podcast" && CATEGORIES.includes("Podcasts")) {
        setCategory("Podcasts");
      }
      if (preset) sessionStorage.removeItem("inplayer-upload-preset");
    } catch {
      /* ignore */
    }
  }, []);

  const [stage, setStage] = useState<Stage>("picking");
  const [progress, setProgress] = useState(0);
  const [uploadedVideoId, setUploadedVideoId] = useState<string | null>(null);
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
  const handleGenerateAI = async (
    type: "title" | "description" | "tags",
    userDescription?: string
  ) => {
    setAiGenerating(true);
    setAiError(null);
    setAiSuggestions([]);
    setAiType(type);

    try {
      const response = await fetch("/api/ai-generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: buildAIGeneratePrompt(type, {
            title,
            description,
            category,
            contentType,
            userDescription,
          }),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "AI generation failed.");
      }

      if (type === "title") {
        const suggestions = parseAITitleSuggestions(data.text);
        setAiSuggestions(suggestions);
      }
    } catch (err) {
      console.error(err);
      setAiError(err instanceof Error ? err.message : "AI couldn't generate content.");
    } finally {
      setAiGenerating(false);
    }
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
          title,
          description,
          category,
          contentType,
          spokenLanguage,
          visibility,
          madeForKids,
          ageRestricted,
          commentsEnabled,
          tags,
          shortSettings: contentType === "short" ? shortSettings : undefined,
          thumbnailDataUrl: thumbnailPreview,
        }),
      });
      
      const createData = await createRes.json();

      if (!createRes.ok) {
        setError(createData.error || "Couldn't start the upload. Please try again.");
        setStage("error");
        return;
      }

      const { uploadUrl, videoId: createdVideoId } = createData;
      setUploadedVideoId(createdVideoId);

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
    setContentType("video");
    setShortSettings({ soundtrack: null, musicClipSeconds: 30, filter: "original" });
    setSpokenLanguage("auto");
    setVisibility("public");
    setMadeForKids(false);
    setAgeRestricted(false);
    setCommentsEnabled(true);
    setTags([]);
    setTagInput("");
    setThumbnailPreview(null);
    setThumbnailBusy(false);
    setThumbnailError(null);
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
        <p className="mt-2 max-w-sm text-sm text-slate-400 light:text-slate-600">
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
      {/* Desktop/tablet only — mobile relies on the device's own back
          gesture/nav, matching the rest of the app's mobile conventions. */}
      <div className="hidden sm:block">
        <BackButton />
      </div>

      <h1 className="text-2xl sm:text-3xl font-black text-white light:text-slate-900">
        Upload Video
      </h1>
      <p className="mt-1 text-sm text-slate-400 light:text-slate-600">
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
              <p className="mt-1 text-sm text-slate-400 light:text-slate-600">
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
                <p className="text-xs text-slate-400 light:text-slate-600">
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

            <VideoMetadataFields
              value={metadataValue}
              onChange={handleMetadataChange}
              categories={CATEGORIES}
              aiGenerating={aiGenerating}
              onOpenAITitleAssist={() => setAiTitleAssistOpen(true)}
              aiError={aiType === "title" ? aiError : null}
              aiSuggestions={aiType === "title" ? aiSuggestions : []}
              thumbnail={{
                previewUrl: thumbnailPreview,
                onFileSelected: handleThumbnailSelected,
                busy: thumbnailBusy,
                error: thumbnailError,
              }}
              tagInput={tagInput}
              onTagInputChange={setTagInput}
            />
            {contentType === "short" && <ShortCreationTools value={shortSettings} onChange={setShortSettings} />}

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
              <p className="mt-1 text-sm text-slate-400 light:text-slate-600">
                Please keep this tab open.
              </p>
            </div>
          </div>
        )}

        {stage === "processing" && uploadedVideoId && (
          <div>
            <ProcessingStatus
              videoId={uploadedVideoId}
              renderReady={(info) => (
                <UploadThumbnailStep
                  videoId={uploadedVideoId}
                  muxPlaybackId={info.muxPlaybackId}
                  duration={info.duration}
                  defaultThumbnailUrl={info.thumbnailUrl}
                  onDone={() => router.push(`/watch/${uploadedVideoId}`)}
                />
              )}
            />
            <div className="mt-2 flex justify-center">
              <button
                onClick={() => router.push("/")}
                className="rounded-2xl border border-white/10 light:border-black/10 px-6 py-2.5 text-sm font-semibold text-slate-200 light:text-slate-700 transition hover:border-orange-400/30 hover:bg-white/5 light:hover:bg-black/5"
              >
                Back to Home
              </button>
            </div>
          </div>
        )}
      </div>
      <AITitleAssistModal
        open={aiTitleAssistOpen}
        onClose={() => setAiTitleAssistOpen(false)}
        initialDescription={description}
        generating={aiGenerating}
        error={aiType === "title" ? aiError : null}
        suggestions={aiType === "title" ? aiSuggestions : []}
        onGenerate={(userDescription) => handleGenerateAI("title", userDescription)}
        onPick={(pickedTitle) => {
          setTitle(pickedTitle);
          setAiTitleAssistOpen(false);
        }}
      />
    </div>
  );
}
