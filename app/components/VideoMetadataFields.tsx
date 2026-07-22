"use client";

import { useRef } from "react";
import { UploadCloud, X, Globe, Link2, Lock, Film, PlaySquare } from "lucide-react";

// Single source of truth for these option lists — shared by the Upload
// page and the My Channel edit panel so the two forms can never drift
// apart from each other (see VideoMetadataFields below).
export const CONTENT_TYPES = [
  { value: "video", label: "Video" },
  { value: "short", label: "Short" },
] as const;

// Matches the CAPTION_TARGETS list in app/api/webhooks/mux/route.ts. Mux's
// own speech-recognition has no dedicated model for Hindi or Bengali, so
// its "auto" language detection is unreliable for them (it regularly
// mistakes Hindi for Urdu). Telling us the real spoken language up front
// lets the caption pipeline skip that guesswork entirely.
export const SPOKEN_LANGUAGES = [
  { value: "auto", label: "Auto-detect" },
  { value: "en", label: "English" },
  { value: "hi", label: "Hindi" },
  { value: "bn", label: "Bengali" },
] as const;

export type SpokenLanguage = (typeof SPOKEN_LANGUAGES)[number]["value"];

export const VISIBILITY_OPTIONS = [
  { value: "public", label: "Public", icon: <Globe size={15} />, hint: "Anyone can find and watch" },
  { value: "unlisted", label: "Unlisted", icon: <Link2 size={15} />, hint: "Only people with the link" },
  { value: "private", label: "Private", icon: <Lock size={15} />, hint: "Hidden from the site" },
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
}

export interface ThumbnailPickerProps {
  /** Data URL of a newly-picked image, or the existing thumbnail to preview. Null shows the empty state. */
  previewUrl: string | null;
  onFileSelected: (file: File) => void;
  busy?: boolean;
  error?: string | null;
}

interface VideoMetadataFieldsProps {
  value: VideoMetadataValue;
  onChange: <K extends keyof VideoMetadataValue>(field: K, value: VideoMetadataValue[K]) => void;
  categories: readonly string[];
  /** false renders Content Type as a read-only label instead of a picker — used in the edit panel, where changing it after upload would desync the captions/rendition pipeline. */
  allowContentTypeChange?: boolean;
  thumbnail?: ThumbnailPickerProps;
  tagInput: string;
  onTagInputChange: (value: string) => void;
}

// A small on/off switch row used for the age-restriction and comments
// options.
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
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 light:border-black/10 bg-[#07111F] light:bg-black/[0.03] px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-white light:text-slate-900">
          {label}
        </p>
        <p className="text-xs text-slate-400 light:text-slate-600">{desc}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={onChange}
        className={`relative h-6 w-11 flex-shrink-0 rounded-full transition-colors ${
          on ? "bg-orange-500" : "bg-white/15 light:bg-black/15"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
            on ? "left-[22px]" : "left-0.5"
          }`}
        />
      </button>
    </div>
  );
}

// The full set of video/short metadata fields, shared verbatim between the
// Upload flow (app/upload/page.tsx) and the My Channel edit panel
// (app/my-videos/page.tsx) so the two can never drift out of feature
// parity with each other again — see the CATEGORIES-list drift bug this
// replaced. Callers own the actual state; this component is just the form.
export default function VideoMetadataFields({
  value,
  onChange,
  categories,
  allowContentTypeChange = true,
  thumbnail,
  tagInput,
  onTagInputChange,
}: VideoMetadataFieldsProps) {
  const thumbInputRef = useRef<HTMLInputElement>(null);

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
    <div className="space-y-5">
      {thumbnail && (
        <div>
          <label className="mb-2 block text-xs font-medium text-slate-400 light:text-slate-600">
            Thumbnail
          </label>
          <div
            onClick={() => thumbInputRef.current?.click()}
            role="button"
            tabIndex={0}
            className="group relative flex aspect-video w-full max-w-[280px] cursor-pointer items-center justify-center overflow-hidden rounded-2xl border border-white/10 light:border-black/10 bg-[#07111F] light:bg-black/[0.03]"
          >
            {thumbnail.previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- data-URL/remote preview inside a small fixed form control; next/image's fill+sizes ceremony adds nothing here.
              <img
                src={thumbnail.previewUrl}
                alt="Thumbnail preview"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center gap-1.5 text-slate-500">
                <UploadCloud size={20} />
                <span className="text-[11px] font-medium">Choose a thumbnail</span>
              </div>
            )}
            <div className="absolute inset-0 flex items-center justify-center bg-black/55 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
              <span className="text-xs font-semibold text-white">
                {thumbnail.busy ? "Processing…" : "Change thumbnail"}
              </span>
            </div>
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
          <p className="mt-1.5 text-xs text-slate-500">
            Cropped to a consistent 16:9 frame automatically, so it looks
            right everywhere it&apos;s shown — on every device.
          </p>
          {thumbnail.error && (
            <p className="mt-1 text-xs text-red-400">{thumbnail.error}</p>
          )}
        </div>
      )}

      <div>
        <label className="mb-2 block text-xs font-medium text-slate-400 light:text-slate-600">
          Title
        </label>
        <input
          type="text"
          value={value.title}
          onChange={(e) => onChange("title", e.target.value)}
          className="w-full rounded-2xl border border-white/10 light:border-black/10 bg-[#07111F] light:bg-black/[0.03] px-4 py-3 text-white light:text-slate-900 caret-orange-400 outline-none focus:border-orange-400/50"
          placeholder="Give your video a title"
        />
      </div>

      <div>
        <label className="mb-2 block text-xs font-medium text-slate-400 light:text-slate-600">
          Description
        </label>
        <textarea
          rows={4}
          value={value.description}
          onChange={(e) => onChange("description", e.target.value)}
          className="w-full resize-none rounded-2xl border border-white/10 light:border-black/10 bg-[#07111F] light:bg-black/[0.03] px-4 py-3 text-white light:text-slate-900 caret-orange-400 outline-none focus:border-orange-400/50"
          placeholder="Tell viewers about your video"
        />
      </div>

      <div>
        <label className="mb-2 block text-xs font-medium text-slate-400 light:text-slate-600">
          Content Type
        </label>
        {allowContentTypeChange ? (
          <div className="grid grid-cols-2 gap-3">
            {CONTENT_TYPES.map((type) => (
              <button
                key={type.value}
                type="button"
                onClick={() => onChange("contentType", type.value)}
                className={`rounded-2xl border py-3 text-sm font-semibold transition-all ${
                  value.contentType === type.value
                    ? "border-orange-400/50 bg-orange-500/10 text-orange-300 light:text-orange-700"
                    : "border-white/10 light:border-black/10 text-slate-400 light:text-slate-600 hover:border-white/20 light:hover:border-black/20"
                }`}
              >
                {type.label}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-2xl border border-white/10 light:border-black/10 bg-white/[0.02] light:bg-black/[0.02] px-4 py-3 text-sm font-semibold text-slate-300 light:text-slate-700">
            {value.contentType === "short" ? (
              <PlaySquare size={15} className="text-orange-400" />
            ) : (
              <Film size={15} className="text-orange-400" />
            )}
            {value.contentType === "short" ? "Short" : "Video"}
            <span className="ml-auto text-right text-[11px] font-normal leading-tight text-slate-500">
              Set at upload — can&apos;t be changed
            </span>
          </div>
        )}
      </div>

      {/* Shorts never get captions, so this only matters — and only shows
          — for Videos. */}
      {value.contentType === "video" && (
        <div>
          <label className="mb-2 block text-xs font-medium text-slate-400 light:text-slate-600">
            Spoken Language
          </label>
          <select
            value={value.spokenLanguage}
            onChange={(e) => onChange("spokenLanguage", e.target.value as SpokenLanguage)}
            className="w-full rounded-2xl border border-white/10 light:border-black/10 bg-[#07111F] light:bg-black/[0.03] px-4 py-3 text-white light:text-slate-900 outline-none focus:border-orange-400/50"
          >
            {SPOKEN_LANGUAGES.map((l) => (
              <option key={l.value} value={l.value} className="bg-[#07111F] text-white">
                {l.label}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-xs text-slate-500">
            Helps us generate accurate captions. Auto-detect works well for
            English, but can misidentify Hindi or Bengali — pick it directly
            if that&apos;s what&apos;s spoken.
          </p>
        </div>
      )}

      <div>
        <label className="mb-2 block text-xs font-medium text-slate-400 light:text-slate-600">
          Category
        </label>
        <select
          value={value.category}
          onChange={(e) => onChange("category", e.target.value)}
          className="w-full rounded-2xl border border-white/10 light:border-black/10 bg-[#07111F] light:bg-black/[0.03] px-4 py-3 text-white light:text-slate-900 outline-none focus:border-orange-400/50"
        >
          {categories.map((c) => (
            <option key={c} value={c} className="bg-[#07111F] text-white">
              {c}
            </option>
          ))}
        </select>
      </div>

      {/* Tags */}
      <div>
        <label className="mb-2 block text-xs font-medium text-slate-400 light:text-slate-600">
          Tags <span className="text-slate-500">(optional, up to 15)</span>
        </label>
        <div className="flex flex-wrap gap-2 rounded-2xl border border-white/10 light:border-black/10 bg-[#07111F] light:bg-black/[0.03] p-2.5">
          {value.tags.map((t) => (
            <span
              key={t}
              className="flex items-center gap-1 rounded-full bg-orange-500/15 px-2.5 py-1 text-xs font-semibold text-orange-300 light:text-orange-700"
            >
              #{t}
              <button
                type="button"
                onClick={() => removeTag(t)}
                aria-label={`Remove ${t}`}
                className="text-orange-300/70 transition hover:text-orange-200 light:text-orange-700/70"
              >
                <X size={12} />
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
            placeholder={value.tags.length === 0 ? "Add a tag and press Enter" : ""}
            className="min-w-[120px] flex-1 bg-transparent px-1 py-1 text-sm text-white light:text-slate-900 caret-orange-400 outline-none placeholder:text-slate-500"
          />
        </div>
      </div>

      {/* Visibility */}
      <div>
        <label className="mb-2 block text-xs font-medium text-slate-400 light:text-slate-600">
          Visibility
        </label>
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {VISIBILITY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange("visibility", opt.value)}
              className={`flex flex-col items-center gap-1.5 rounded-2xl border py-3 text-xs font-semibold transition-all ${
                value.visibility === opt.value
                  ? "border-orange-400/50 bg-orange-500/10 text-orange-300 light:text-orange-700"
                  : "border-white/10 light:border-black/10 text-slate-400 light:text-slate-600 hover:border-white/20 light:hover:border-black/20"
              }`}
            >
              {opt.icon}
              {opt.label}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-slate-500">
          {VISIBILITY_OPTIONS.find((o) => o.value === value.visibility)?.hint}
        </p>
      </div>

      {/* Audience */}
      <div>
        <label className="mb-2 block text-xs font-medium text-slate-400 light:text-slate-600">
          Audience
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => onChange("madeForKids", false)}
            className={`rounded-2xl border py-3 text-sm font-semibold transition-all ${
              !value.madeForKids
                ? "border-orange-400/50 bg-orange-500/10 text-orange-300 light:text-orange-700"
                : "border-white/10 light:border-black/10 text-slate-400 light:text-slate-600 hover:border-white/20 light:hover:border-black/20"
            }`}
          >
            Not made for kids
          </button>
          <button
            type="button"
            onClick={() => onChange("madeForKids", true)}
            className={`rounded-2xl border py-3 text-sm font-semibold transition-all ${
              value.madeForKids
                ? "border-orange-400/50 bg-orange-500/10 text-orange-300 light:text-orange-700"
                : "border-white/10 light:border-black/10 text-slate-400 light:text-slate-600 hover:border-white/20 light:hover:border-black/20"
            }`}
          >
            Made for kids
          </button>
        </div>
      </div>

      {/* Age restriction + comments toggles */}
      <div className="space-y-2.5">
        <ToggleRow
          label="Restrict to viewers 18+"
          desc="Adds an age-confirmation gate before playback."
          on={value.ageRestricted}
          onChange={() => onChange("ageRestricted", !value.ageRestricted)}
        />
        <ToggleRow
          label="Allow comments"
          desc="Let viewers comment on this video."
          on={value.commentsEnabled}
          onChange={() => onChange("commentsEnabled", !value.commentsEnabled)}
        />
      </div>
    </div>
  );
}
