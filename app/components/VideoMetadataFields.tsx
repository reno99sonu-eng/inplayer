"use client";

import { useRef, useState } from "react";
import { UploadCloud, X, Globe, Link2, Lock, Film, PlaySquare, Loader2, Sparkles } from "lucide-react";

export const CONTENT_TYPES = [
  { value: "video", label: "Video" },
  { value: "short", label: "Short" },
] as const;

export const SPOKEN_LANGUAGES = [
  { value: "auto", label: "Auto-detect" },
  { value: "en", label: "English" },
  { value: "hi", label: "Hindi" },
  { value: "bn", label: "Bengali" },
] as const;

export type SpokenLanguage = (typeof SPOKEN_LANGUAGES)[number]["value"];

export const VISIBILITY_OPTIONS = [
  { value: "public", label: "Public", icon: <Globe size={14} />, hint: "Anyone can find and watch" },
  { value: "unlisted", label: "Unlisted", icon: <Link2 size={14} />, hint: "Only people with the link" },
  { value: "private", label: "Private", icon: <Lock size={14} />, hint: "Hidden from the site" },
] as const;

export type Visibility = (typeof VISIBILITY_OPTIONS)[number]["value"];

export interface VideoMetadataValue {
  title: string;
  description: string;
  category: string;
  contentType: "video" | "short";
  spokenLanguage: SpokenLanguage;
  visibility: Visibility;
  madeForKids: boolean;
  ageRestricted: boolean;
  commentsEnabled: boolean;
  tags: string[];
  membersOnly: boolean;
}

export interface ThumbnailPickerProps {
  previewUrl: string | null;
  onFileSelected: (file: File) => void;
  busy?: boolean;
  error?: string | null;
  muxFrames?: string[];
  selectedMuxThumbnail?: string | null;
  onMuxThumbnailSelected?: (url: string) => void;
  onGenerateAIThumbnail?: () => void;
  aiThumbnailBusy?: boolean;
}

interface VideoMetadataFieldsProps {
  value: VideoMetadataValue;
  onChange: <K extends keyof VideoMetadataValue>(field: K, value: VideoMetadataValue[K]) => void;
  categories: readonly string[];
  allowContentTypeChange?: boolean;
  thumbnail?: ThumbnailPickerProps;
  tagInput: string;
  onTagInputChange: (value: string) => void;
  aiGenerating?: boolean;
  onOpenAITitleAssist?: () => void;
  aiError?: string | null;
  aiSuggestions?: string[];
}

function ToggleRow({
  label,
  desc,
  on,
  onChange,
}: {
  label: string;
  desc: string;
  on: boolean;
  onChange: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-[#060D18] px-3 py-2 light:border-black/10 light:bg-white">
      <div className="min-w-0">
        <p className="text-xs font-bold text-white light:text-slate-900">
          {label}
        </p>
        <p className="text-[11px] text-slate-400 light:text-slate-600">{desc}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={onChange}
        className={`relative h-5 w-9 flex-shrink-0 rounded-full transition-colors ${
          on ? "bg-orange-500" : "bg-white/15 light:bg-black/15"
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
            on ? "left-[18px]" : "left-0.5"
          }`}
        />
      </button>
    </div>
  );
}

export default function VideoMetadataFields({
  value,
  onChange,
  categories,
  allowContentTypeChange = true,
  thumbnail,
  tagInput,
  onTagInputChange,
  aiGenerating = false,
  onOpenAITitleAssist,
  aiError = null,
  aiSuggestions = [],
}: VideoMetadataFieldsProps) {
  const thumbInputRef = useRef<HTMLInputElement>(null);
  const muxFrames = thumbnail?.muxFrames ?? [];
  const [aiThumbBusy, setAiThumbBusy] = useState(false);
  const [aiThumbError, setAiThumbError] = useState<string | null>(null);

  // Mobile Segmented Tab State for ultra-compact 1-screen editing on mobile
  const [mobileTab, setMobileTab] = useState<"details" | "settings">("details");

  const runAIThumbnail = async () => {
    if (muxFrames.length === 0 || aiThumbBusy) return;
    setAiThumbBusy(true);
    setAiThumbError(null);
    try {
      const res = await fetch("/api/ai-thumbnail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          frameUrls: muxFrames,
          title: value.title,
          category: value.category,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "AI couldn't pick a thumbnail.");
      if (data.thumbnailUrl) {
        thumbnail?.onMuxThumbnailSelected?.(data.thumbnailUrl);
      }
    } catch (err) {
      setAiThumbError(err instanceof Error ? err.message : "AI couldn't pick a thumbnail.");
    } finally {
      setAiThumbBusy(false);
    }
  };

  const addTag = () => {
    const t = tagInput.trim().replace(/^#/, "");
    if (!t) return;
    if (value.tags.length >= 15) return;
    if (!value.tags.some((existing) => existing.toLowerCase() === t.toLowerCase())) {
      onChange("tags", [...value.tags, t]);
    }
    onTagInputChange("");
  };

  const removeTag = (t: string) => onChange("tags", value.tags.filter((x) => x !== t));

  return (
    <div className="space-y-3">
      {/* Mobile Segmented Tab Control (Shown on Mobile, Hidden on Desktop) */}
      <div className="flex rounded-xl border border-white/10 bg-black/20 p-1 light:border-black/10 light:bg-black/5 lg:hidden">
        <button
          type="button"
          onClick={() => setMobileTab("details")}
          className={`flex-1 py-1.5 text-center text-xs font-bold rounded-lg transition-all ${
            mobileTab === "details"
              ? "bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] text-white shadow"
              : "text-slate-400 hover:text-white light:text-slate-600"
          }`}
        >
          1. Details & Thumbnail
        </button>
        <button
          type="button"
          onClick={() => setMobileTab("settings")}
          className={`flex-1 py-1.5 text-center text-xs font-bold rounded-lg transition-all ${
            mobileTab === "settings"
              ? "bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] text-white shadow"
              : "text-slate-400 hover:text-white light:text-slate-600"
          }`}
        >
          2. Visibility & Settings
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
        {/* SECTION 1: Details & Thumbnail (Visible on Desktop OR Mobile Tab 1) */}
        <div className={`space-y-3.5 ${mobileTab === "details" ? "block" : "hidden lg:block"}`}>
          {/* Title Field + AI Assist */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs font-bold text-slate-300 light:text-slate-700">
                Title
              </label>
              <button
                type="button"
                onClick={onOpenAITitleAssist}
                disabled={aiGenerating}
                className="inline-flex items-center gap-1 rounded-lg bg-orange-500/15 px-2.5 py-1 text-[11px] font-bold text-orange-400 transition hover:bg-orange-500 hover:text-white disabled:opacity-50"
              >
                <Sparkles size={12} />
                {aiGenerating ? "Generating..." : "✨ AI Title Assist"}
              </button>
            </div>
            {aiError && <p className="mb-1 text-xs text-red-400">{aiError}</p>}
            {aiSuggestions.length > 1 && (
              <div className="mb-1.5 flex flex-wrap gap-1">
                {aiSuggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => onChange("title", suggestion)}
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-medium transition ${
                      value.title === suggestion
                        ? "border-orange-400 bg-orange-500/15 text-orange-300"
                        : "border-white/10 text-slate-400 hover:border-orange-400/40 light:border-black/10 light:text-slate-600"
                    }`}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
            <input
              type="text"
              value={value.title}
              onChange={(e) => onChange("title", e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-[#060D18] px-3 py-2 text-xs text-white caret-orange-400 outline-none focus:border-orange-400/50 light:border-black/10 light:bg-white light:text-slate-900 sm:text-sm"
              placeholder="Give your video a title"
            />
          </div>

          {/* Description Field */}
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-300 light:text-slate-700">
              Description
            </label>
            <textarea
              rows={2}
              value={value.description}
              onChange={(e) => onChange("description", e.target.value)}
              className="w-full resize-none rounded-xl border border-white/10 bg-[#060D18] px-3 py-2 text-xs text-white caret-orange-400 outline-none focus:border-orange-400/50 light:border-black/10 light:bg-white light:text-slate-900 sm:text-sm"
              placeholder="Tell viewers about your video..."
            />
          </div>

          {/* Thumbnail Selector Section */}
          {thumbnail && (
            <div className="rounded-xl border border-white/10 bg-[#060D18] p-3 light:border-black/10 light:bg-white space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-300 light:text-slate-700">
                  Thumbnail
                </label>
                {thumbnail.onGenerateAIThumbnail && (
                  <button
                    type="button"
                    onClick={thumbnail.onGenerateAIThumbnail}
                    disabled={thumbnail.aiThumbnailBusy}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-orange-500/15 px-2.5 py-1 text-[11px] font-bold text-orange-400 transition hover:bg-orange-500 hover:text-white disabled:opacity-50"
                  >
                    {thumbnail.aiThumbnailBusy ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Sparkles size={12} />
                    )}
                    <span>{thumbnail.aiThumbnailBusy ? "Generating AI Image..." : "✨ Generate AI Thumbnail"}</span>
                  </button>
                )}
              </div>

              {muxFrames && muxFrames.length > 0 && (
                <div>
                  <p className="mb-1.5 text-[11px] font-semibold text-slate-400 light:text-slate-600">
                    🎬 Pick from Video Frames
                  </p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {muxFrames.map((frameUrl, idx) => {
                      const selected = thumbnail?.previewUrl === frameUrl || thumbnail?.selectedMuxThumbnail === frameUrl;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => thumbnail?.onMuxThumbnailSelected?.(frameUrl)}
                          className={`aspect-video overflow-hidden rounded-xl border transition-all ${
                            selected
                              ? "border-orange-500 ring-2 ring-orange-500"
                              : "border-white/10 hover:border-orange-400/50"
                          }`}
                        >
                          <img src={frameUrl} alt={`Frame ${idx + 1}`} className="h-full w-full object-cover" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3">
                <div
                  onClick={() => thumbInputRef.current?.click()}
                  role="button"
                  className="group relative flex aspect-video h-14 cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-dashed border-white/20 bg-black/20 hover:border-orange-400/50"
                >
                  {thumbnail.previewUrl && (!muxFrames || !muxFrames.includes(thumbnail.previewUrl)) ? (
                    <img src={thumbnail.previewUrl} alt="Custom" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex items-center gap-1.5 text-slate-400 px-3 text-center">
                      <UploadCloud size={16} className="text-orange-400" />
                      <span className="text-[11px] font-semibold">Upload Custom Image</span>
                    </div>
                  )}
                  <input
                    ref={thumbInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) thumbnail.onFileSelected(f);
                      e.target.value = "";
                    }}
                  />
                </div>
              </div>
              {thumbnail.error && <p className="mt-1 text-xs text-red-400">{thumbnail.error}</p>}
            </div>
          )}
        </div>

        {/* SECTION 2: Visibility & Settings (Visible on Desktop OR Mobile Tab 2) */}
        <div className={`space-y-3.5 ${mobileTab === "settings" ? "block" : "hidden lg:block"}`}>
          {/* Category & Spoken Language */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-300 light:text-slate-700">
                Category
              </label>
              <select
                value={value.category}
                onChange={(e) => onChange("category", e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#060D18] px-2.5 py-2 text-xs text-white outline-none focus:border-orange-400/50 light:border-black/10 light:bg-white light:text-slate-900"
              >
                {categories.map((c) => (
                  <option key={c} value={c} className="bg-[#07111F] text-white light:bg-white light:text-slate-900">
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {value.contentType === "video" ? (
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-300 light:text-slate-700">
                  Spoken Language
                </label>
                <select
                  value={value.spokenLanguage}
                  onChange={(e) => onChange("spokenLanguage", e.target.value as SpokenLanguage)}
                  className="w-full rounded-xl border border-white/10 bg-[#060D18] px-2.5 py-2 text-xs text-white outline-none focus:border-orange-400/50 light:border-black/10 light:bg-white light:text-slate-900"
                >
                  {SPOKEN_LANGUAGES.map((l) => (
                    <option key={l.value} value={l.value} className="bg-[#07111F] text-white light:bg-white light:text-slate-900">
                      {l.label}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-300 light:text-slate-700">
                  Content Format
                </label>
                <div className="flex h-9 items-center rounded-xl border border-white/10 bg-[#060D18] px-3 text-xs font-semibold text-orange-400 light:border-black/10 light:bg-white">
                  Shorts (9:16)
                </div>
              </div>
            )}
          </div>

          {/* Visibility Pills */}
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-300 light:text-slate-700">
              Visibility
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {VISIBILITY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onChange("visibility", opt.value)}
                  className={`flex items-center justify-center gap-1.5 rounded-xl border py-1.5 text-xs font-semibold transition-all ${
                    value.visibility === opt.value
                      ? "border-orange-400/60 bg-orange-500/15 text-orange-300 light:text-orange-700"
                      : "border-white/10 bg-[#060D18] text-slate-400 hover:border-white/20 light:border-black/10 light:bg-white light:text-slate-600"
                  }`}
                >
                  {opt.icon}
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Audience */}
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-300 light:text-slate-700">
              Audience
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => onChange("madeForKids", false)}
                className={`rounded-xl border py-1.5 text-xs font-semibold transition-all ${
                  !value.madeForKids
                    ? "border-orange-400/60 bg-orange-500/15 text-orange-300 light:text-orange-700"
                    : "border-white/10 bg-[#060D18] text-slate-400 hover:border-white/20 light:border-black/10 light:bg-white light:text-slate-600"
                }`}
              >
                Not for kids
              </button>
              <button
                type="button"
                onClick={() => onChange("madeForKids", true)}
                className={`rounded-xl border py-1.5 text-xs font-semibold transition-all ${
                  value.madeForKids
                    ? "border-orange-400/60 bg-orange-500/15 text-orange-300 light:text-orange-700"
                    : "border-white/10 bg-[#060D18] text-slate-400 hover:border-white/20 light:border-black/10 light:bg-white light:text-slate-600"
                }`}
              >
                Made for kids
              </button>
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-300 light:text-slate-700">
              Tags <span className="text-slate-500">(up to 15)</span>
            </label>
            <div className="flex flex-wrap gap-1 rounded-xl border border-white/10 bg-[#060D18] p-1.5 light:border-black/10 light:bg-white">
              {value.tags.map((t) => (
                <span
                  key={t}
                  className="flex items-center gap-1 rounded-md bg-orange-500/15 px-2 py-0.5 text-[10px] font-semibold text-orange-300 light:text-orange-700"
                >
                  #{t}
                  <button
                    type="button"
                    onClick={() => removeTag(t)}
                    className="text-orange-300/70 hover:text-orange-200"
                  >
                    <X size={10} />
                  </button>
                </span>
              ))}
              <input
                value={tagInput}
                onChange={(e) => onTagInputChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    addTag();
                  } else if (e.key === "Backspace" && !tagInput && value.tags.length > 0) {
                    removeTag(value.tags[value.tags.length - 1]);
                  }
                }}
                onBlur={addTag}
                placeholder={value.tags.length === 0 ? "Add tag..." : ""}
                className="min-w-[90px] flex-1 bg-transparent px-1 py-0.5 text-xs text-white outline-none placeholder:text-slate-500 light:text-slate-900"
              />
            </div>
          </div>

          {/* Toggles */}
          <div className="space-y-1">
            <ToggleRow
              label="Restrict to 18+"
              desc="Age gate playback"
              on={value.ageRestricted}
              onChange={() => onChange("ageRestricted", !value.ageRestricted)}
            />
            <ToggleRow
              label="Allow comments"
              desc="Enable viewer comments"
              on={value.commentsEnabled}
              onChange={() => onChange("commentsEnabled", !value.commentsEnabled)}
            />
            {value.contentType === "video" && (
              <ToggleRow
                label="Members only"
                desc="Gated to paid members"
                on={value.membersOnly}
                onChange={() => onChange("membersOnly", !value.membersOnly)}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
