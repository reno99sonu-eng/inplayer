"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchAuthSession } from "aws-amplify/auth";
import { UploadCloud, Film, PlaySquare, Loader2, X , Music2 } from "lucide-react";
import { useAuthModal } from "@/app/components/auth/AuthProvider";
import ProcessingStatus from "@/app/components/ProcessingStatus";
import UploadThumbnailStep from "@/app/components/UploadThumbnailStep";
import BackButton from "@/app/components/BackButton";
import { CONTENT_CATEGORIES } from "@/app/data/categories";
import {
  CONTENT_TYPE_LABEL,
  CONTENT_TYPE_WORD,
  UPLOAD_ACCEPT,
  type ContentType,
} from "@/app/lib/contentTypes";
import { compressImageToThumbnail } from "@/app/lib/imageCompress";
import { buildAIGeneratePrompt, parseAITitleSuggestions } from "@/app/lib/aiPrompts";
import VideoMetadataFields, {
  VideoMetadataValue,
  SpokenLanguage,
  Visibility,
} from "@/app/components/VideoMetadataFields";
import AITitleAssistModal from "@/app/components/AITitleAssistModal";
import ShortCreationTools, { ShortSettings } from "@/app/components/ShortCreationTools";
import MusicUploadTools, {
  emptyMusicSettings,
  type MusicSettings,
} from "@/app/components/MusicUploadTools";
import { sha256HexOfFile } from "@/app/lib/audioHash";
import { extractLocalVideoThumbnails } from "@/app/lib/videoThumbnailExtractor";
import { audienceFlags, type VideoAudience } from "@/app/lib/contentAccess";

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
  const [contentType, setContentType] = useState<ContentType>("video");
  const [shortSettings, setShortSettings] = useState<ShortSettings>({
    soundtrack: null,
    musicClipSeconds: 30,
    filter: "original",
  });
  const [musicSettings, setMusicSettings] = useState<MusicSettings>(emptyMusicSettings);
  const [spokenLanguage, setSpokenLanguage] = useState<SpokenLanguage>("auto");

  // YouTube-style upload options.
  const [visibility, setVisibility] = useState<Visibility>("public");
  // One 3-way choice (Everyone / Kids / 18+) replacing what used to be a
  // separate "made for kids" picker AND a "restrict to 18+" toggle that
  // could contradict each other. The two old booleans are still sent to
  // the API, derived from this via audienceFlags(), so every existing
  // reader of them keeps working unchanged.
  const [audience, setAudience] = useState<VideoAudience>("everyone");
  const [commentsEnabled, setCommentsEnabled] = useState(true);
  const [membersOnly, setMembersOnly] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");

  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [localVideoFrames, setLocalVideoFrames] = useState<string[]>([]);
  const [thumbnailBusy, setThumbnailBusy] = useState(false);
  const [thumbnailError, setThumbnailError] = useState<string | null>(null);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiThumbnailBusy, setAiThumbnailBusy] = useState(false);

  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [aiType, setAiType] = useState<"title" | "description" | "tags" | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiTitleAssistOpen, setAiTitleAssistOpen] = useState(false);

  useEffect(() => {
    (() => {
      try {
        const params = new URLSearchParams(window.location.search);
        const typeParam = params.get("type");
        if (typeParam === "short") setContentType("short");
        if (typeParam === "video") setContentType("video");
        if (typeParam === "music") setContentType("music");

        const preset = sessionStorage.getItem("inplayer-upload-preset");
        if (preset === "podcast" && CATEGORIES.includes("Podcasts")) {
          setCategory("Podcasts");
        }
        if (preset) sessionStorage.removeItem("inplayer-upload-preset");
      } catch {
        /* ignore */
      }
    })();
  }, []);

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

  const metadataValue: VideoMetadataValue = {
    title,
    description,
    category,
    contentType,
    spokenLanguage,
    visibility,
    audience,
    ...audienceFlags(audience),
    commentsEnabled,
    tags,
    membersOnly,
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
        setContentType(val as ContentType);
        break;
      case "spokenLanguage":
        setSpokenLanguage(val as SpokenLanguage);
        break;
      case "visibility":
        setVisibility(val as Visibility);
        break;
      case "audience":
        setAudience(val as VideoAudience);
        break;
      // madeForKids/ageRestricted are derived from `audience` above and
      // never set directly, so there's deliberately no case for them here.
      case "commentsEnabled":
        setCommentsEnabled(val as boolean);
        break;
      case "tags":
        setTags(val as string[]);
        break;
      case "membersOnly":
        setMembersOnly(val as boolean);
        break;
    }
  };

  const [stage, setStage] = useState<Stage>("picking");
  const [progress, setProgress] = useState(0);
  const [uploadedVideoId, setUploadedVideoId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Guards against a fast double-click firing handlePublish twice before
  // `stage` re-renders away from the Publish button (which would create two
  // Mux uploads + two DynamoDB video records for one file — there's no
  // idempotency key on /api/upload/create to catch that server-side).
  const [publishing, setPublishing] = useState(false);

  const handleFile = async (selected: File | null) => {
    if (!selected) return;

    const isMusicUpload = contentType === "music";

    // Browsers disagree about audio MIME types — the same .m4a arrives as
    // audio/mp4, audio/x-m4a, video/mp4 or "" depending on OS and browser,
    // and .flac is frequently blank. So for music the extension is trusted
    // when the reported type is unhelpful, rather than rejecting a file the
    // user can plainly see is a song.
    if (isMusicUpload) {
      const looksAudio =
        selected.type.startsWith("audio/") ||
        /\.(mp3|m4a|aac|wav|flac|ogg|oga|opus)$/i.test(selected.name);
      if (!looksAudio) {
        setError("Please choose an audio file (MP3, M4A, WAV, FLAC).");
        return;
      }
    } else if (!selected.type.startsWith("video/")) {
      setError("Please choose a video file.");
      return;
    }

    setError(null);
    setFile(selected);

    const nameWithoutExt = selected.name.replace(/\.[^/.]+$/, "");
    setTitle(nameWithoutExt);

    setStage("details");

    // Instantly extract 4 candidate frame snapshots from the local video
    // file. Skipped entirely for music: there are no frames in an audio
    // file, so the extractor would spin up a <video> element that never
    // produces anything. The cover image is supplied by the creator
    // instead, and is mandatory — see handlePublish.
    if (isMusicUpload) {
      // Byte-for-byte fingerprint, computed here in the browser because
      // the audio goes straight from here to Mux and never passes through
      // our server. It lets /api/upload/create spot a re-upload of
      // something already on InPlayer. A null result (no secure context,
      // no Web Crypto) simply means that one check doesn't run — see
      // app/lib/audioHash.ts.
      const hash = await sha256HexOfFile(selected);
      setMusicSettings((prev) => ({ ...prev, audioSha256: hash }));
      return;
    }

    try {
      const frames = await extractLocalVideoThumbnails(selected, 4);
      if (frames.length > 0) {
        setLocalVideoFrames(frames);
        setThumbnailPreview(frames[0]);
      }
    } catch (err) {
      console.error("Failed to extract video frame thumbnails:", err);
    }
  };

  const handleGenerateAIThumbnail = async () => {
    if (aiThumbnailBusy) return;
    setAiThumbnailBusy(true);
    setThumbnailError(null);

    try {
      const res = await fetch("/api/ai-thumbnail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: title || description || "Video thumbnail",
          title,
          category,
          generateNew: true,
          frameUrls: localVideoFrames,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "AI thumbnail generation failed.");
      if (data.thumbnailUrl) {
        setThumbnailPreview(data.thumbnailUrl);
      }
    } catch (err) {
      setThumbnailError(err instanceof Error ? err.message : "Couldn't generate AI thumbnail.");
    } finally {
      setAiThumbnailBusy(false);
    }
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
    if (!file || publishing) return;

    if (!title.trim()) {
      setError("Please give your upload a title.");
      return;
    }

    // Music has no video frame for Mux to build a thumbnail from, so the
    // cover art is the only image this track will ever have — on its card,
    // in search, in playlists and behind the player. The server enforces
    // this too (app/api/upload/create); this is just the friendlier place
    // to find out.
    if (contentType === "music" && musicSettings.covers.length === 0) {
      setError("Please add cover art — a music upload needs at least one image.");
      return;
    }

    setPublishing(true);
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
          audience,
          ...audienceFlags(audience),
          commentsEnabled,
          tags,
          // Longform, not literally "video" — a members-only track is an
          // ordinary thing to publish, and the watch page already handles
          // gated audio.
          membersOnly: contentType !== "short" ? membersOnly : undefined,
          // Sent for both content types now — Videos can pick a background
          // soundtrack/Look too (see ShortCreationTools below).
          shortSettings,
          thumbnailDataUrl: thumbnailPreview,
          // Music-only. Ignored by the server for any other content type.
          ...(contentType === "music" && {
            covers: musicSettings.covers,
            coverIntervalSeconds: musicSettings.coverIntervalSeconds,
            lyrics: musicSettings.lyrics,
            audioSha256: musicSettings.audioSha256,
            declaredOwnership: musicSettings.declaredOwnership,
          }),
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
      setPublishing(false);
    } catch (err) {
      console.error("Upload error:", err);
      setError(`Something went wrong uploading your video: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setStage("error");
      setPublishing(false);
    }
  };

  // Fully resets every piece of upload-session state back to a blank
  // picker — used both by the "X" cancel button and by the "Upload
  // Another" button shown on the success screens below. Without this being
  // reachable from the success screens, the only way to start a second
  // upload was leaving /upload entirely and hoping a fresh navigation back
  // remounted the page instead of restoring the stale "processing" state
  // from before — which isn't guaranteed, and is exactly what made
  // uploading a second time in the same session unreliable.
  const resetUpload = () => {
    setFile(null);
    setTitle("");
    setDescription("");
    setCategory(CATEGORIES[0]);
    setShortSettings({ soundtrack: null, musicClipSeconds: 30, filter: "original" });
    setMusicSettings(emptyMusicSettings());
    setSpokenLanguage("auto");
    setVisibility("public");
    setAudience("everyone");
    setCommentsEnabled(true);
    setTags([]);
    setTagInput("");
    setThumbnailPreview(null);
    setThumbnailBusy(false);
    setThumbnailError(null);
    setStage("picking");
    setProgress(0);
    setError(null);
    setUploadedVideoId(null);
    setPublishing(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
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
          You need an InPlayer account to upload videos and shorts.
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
    <div className="mx-auto max-w-[760px] px-4 py-8 sm:py-12">
      <div className="hidden sm:block">
        <BackButton />
      </div>

      <div className="text-center sm:text-left">
        <h1 className="text-2xl font-black text-white light:text-slate-900 sm:text-3xl">
          {contentType === "short" ? "Shorts Upload Panel" : contentType === "music" ? "Music Upload Panel" : "Videos Upload Panel"}
        </h1>
        <p className="mt-1 text-sm text-slate-400 light:text-slate-600">
          {contentType === "short"
            ? "Upload vertical short videos (9:16 format) up to 60 seconds with music and filters."
            : contentType === "music"
              ? "Upload a song or audio track. It plays in the normal player with your cover art on screen, and behaves like a video everywhere else."
              : "Upload 16:9 long-form videos, tutorials, podcasts, and movies for your channel."}
        </p>
      </div>

      {/* Individual Panel Selector Buttons: Videos & Shorts */}
      <div className="mt-6 mb-8 flex items-center justify-center gap-3 sm:justify-start">
        <button
          type="button"
          onClick={() => setContentType("video")}
          className={`flex items-center gap-2.5 rounded-2xl px-6 py-3 text-sm font-bold transition-all duration-300 ${
            contentType === "video"
              ? "bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] text-white shadow-[0_10px_25px_rgba(255,153,0,.35)] scale-105"
              : "border border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/10 hover:text-white light:border-black/10 light:bg-black/[0.03] light:text-slate-700"
          }`}
        >
          <Film size={18} />
          <span>Videos Panel</span>
        </button>

        <button
          type="button"
          onClick={() => setContentType("short")}
          className={`flex items-center gap-2.5 rounded-2xl px-6 py-3 text-sm font-bold transition-all duration-300 ${
            contentType === "short"
              ? "bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] text-white shadow-[0_10px_25px_rgba(255,153,0,.35)] scale-105"
              : "border border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/10 hover:text-white light:border-black/10 light:bg-black/[0.03] light:text-slate-700"
          }`}
        >
          <PlaySquare size={18} />
          <span>Shorts Panel</span>
        </button>

        <button
          type="button"
          onClick={() => setContentType("music")}
          className={`flex items-center gap-2.5 rounded-2xl px-6 py-3 text-sm font-bold transition-all duration-300 ${
            contentType === "music"
              ? "bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] text-white shadow-[0_10px_25px_rgba(255,153,0,.35)] scale-105"
              : "border border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/10 hover:text-white light:border-black/10 light:bg-black/[0.03] light:text-slate-700"
          }`}
        >
          <Music2 size={18} />
          <span>Music Panel</span>
        </button>
      </div>

      <div className="mt-4">
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
              {contentType === "short" ? (
                <PlaySquare size={30} className="text-orange-400" />
              ) : contentType === "music" ? (
                <Music2 size={30} className="text-orange-400" />
              ) : (
                <UploadCloud size={30} className="text-orange-400" />
              )}
            </div>
            <div>
              <p className="font-semibold text-white light:text-slate-900 sm:text-lg">
                {contentType === "short"
                  ? "Drag and drop a short video file (9:16 vertical)"
                  : contentType === "music"
                    ? "Drag and drop an audio file (MP3, M4A, WAV, FLAC)"
                    : "Drag and drop a video file (16:9 recommended)"}
              </p>
              <p className="mt-1 text-sm text-slate-400 light:text-slate-600">
                or click to browse from your device
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept={UPLOAD_ACCEPT[contentType]}
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0] || null)}
            />
          </div>
        )}

        {(stage === "details" || stage === "error") && file && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 light:border-black/10 light:bg-black/[0.02]">
              {contentType === "short" ? (
                <PlaySquare size={22} className="flex-shrink-0 text-orange-400" />
              ) : contentType === "music" ? (
                <Music2 size={22} className="flex-shrink-0 text-orange-400" />
              ) : (
                <Film size={22} className="flex-shrink-0 text-orange-400" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white light:text-slate-900">
                  {file.name}
                </p>
                <p className="text-xs text-slate-400 light:text-slate-600">
                  {(file.size / (1024 * 1024)).toFixed(1)} MB • {CONTENT_TYPE_LABEL[contentType]}
                </p>
              </div>
              <button
                onClick={resetUpload}
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-white/5 hover:text-white light:hover:bg-black/5 light:hover:text-slate-900"
              >
                <X size={16} />
              </button>
            </div>

            <VideoMetadataFields
              value={metadataValue}
              onChange={handleMetadataChange}
              categories={CATEGORIES}
              allowContentTypeChange={true}
              aiGenerating={aiGenerating}
              onOpenAITitleAssist={() => setAiTitleAssistOpen(true)}
              aiError={aiType === "title" ? aiError : null}
              aiSuggestions={aiType === "title" ? aiSuggestions : []}
              // Music gets no thumbnail picker here: its artwork is the
              // cover art in MusicUploadTools below, and cover 1 becomes
              // the thumbnail automatically. Two separate image pickers
              // for one track is how a creator ends up with a card that
              // doesn't match the sleeve behind the player.
              thumbnail={contentType === "short" || contentType === "music" ? undefined : {
                previewUrl: thumbnailPreview,
                onFileSelected: handleThumbnailSelected,
                busy: thumbnailBusy,
                error: thumbnailError,
                muxFrames: localVideoFrames,
                onMuxThumbnailSelected: (url) => setThumbnailPreview(url),
                onGenerateAIThumbnail: handleGenerateAIThumbnail,
                aiThumbnailBusy: aiThumbnailBusy,
              }}
              tagInput={tagInput}
              onTagInputChange={setTagInput}
            />

            {contentType === "music" && (
              <MusicUploadTools
                value={musicSettings}
                onChange={setMusicSettings}
                audioFile={file}
                onPosterChange={setThumbnailPreview}
                title={title}
                description={description}
                tags={tags}
              />
            )}

            {contentType !== "music" && (
              <ShortCreationTools
                value={shortSettings}
                onChange={setShortSettings}
                contentType={contentType}
              />
            )}

            {error && (
              <p className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300 light:text-red-700">
                {error}
              </p>
            )}

            <button
              onClick={handlePublish}
              disabled={publishing}
              className="w-full rounded-2xl bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] py-3.5 font-bold text-white shadow-[0_15px_35px_rgba(255,153,0,.3)] transition-all hover:-translate-y-0.5 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
            >
              {publishing ? "Publishing..." : `Publish ${CONTENT_TYPE_LABEL[contentType]}`}
            </button>
          </div>
        )}

        {stage === "uploading" && (
          <div className="flex flex-col items-center gap-5 py-12 text-center">
            <div className="relative h-20 w-20">
              <svg className="h-20 w-20 -rotate-90" viewBox="0 0 80 80">
                <circle
                  cx="40"
                  cy="40"
                  r="34"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="6"
                  className="text-white/10 light:text-black/10"
                />
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
                Uploading your {CONTENT_TYPE_WORD[contentType]}...
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
              renderReady={(info) =>
                contentType === "short" ? (
                  <div className="py-8 text-center">
                    <p className="text-lg font-bold text-white light:text-slate-900">Your Short is published! 🎉</p>
                    <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                      <button
                        onClick={() => router.push(`/shorts?v=${uploadedVideoId}`)}
                        className="rounded-2xl bg-gradient-to-r from-[#FF7A18] to-[#FFD54A] px-6 py-2.5 font-bold text-white shadow"
                      >
                        Watch Short
                      </button>
                      <button
                        onClick={resetUpload}
                        className="rounded-2xl border border-white/10 px-6 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-orange-400/30 hover:bg-white/5 light:border-black/10 light:text-slate-700 light:hover:bg-black/5"
                      >
                        Upload Another
                      </button>
                    </div>
                  </div>
                ) : (
                  <UploadThumbnailStep
                    videoId={uploadedVideoId}
                    muxPlaybackId={info.muxPlaybackId}
                    duration={info.duration}
                    defaultThumbnailUrl={info.thumbnailUrl}
                    contentType={contentType}
                    onDone={() => router.push(`/watch/${uploadedVideoId}`)}
                  />
                )
              }
            />
            <div className="mt-2 flex flex-wrap justify-center gap-3">
              <button
                onClick={resetUpload}
                className="rounded-2xl bg-gradient-to-r from-[#FF7A18] to-[#FFD54A] px-6 py-2.5 text-sm font-bold text-white shadow transition hover:-translate-y-0.5"
              >
                Upload Another
              </button>
              <button
                onClick={() => router.push("/")}
                className="rounded-2xl border border-white/10 px-6 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-orange-400/30 hover:bg-white/5 light:border-black/10 light:text-slate-700 light:hover:bg-black/5"
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
