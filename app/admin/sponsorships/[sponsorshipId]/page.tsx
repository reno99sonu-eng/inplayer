"use client";

import { authedFetch } from "@/app/lib/apiFetch";
import { compressImageToBanner } from "@/app/lib/imageCompress";
import { MIDROLL_VIDEO_MAX_BYTES } from "@/app/lib/videoAds";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, AlertTriangle, Upload, Trash2, CheckCircle2, Ban, Image as ImageIcon, Video } from "lucide-react";

interface SponsorshipDetail {
  sponsorshipId: string;
  companyName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  websiteUrl: string;
  packageType: string;
  sections: string[];
  amountInr: number;
  paymentStatus: string;
  legalName: string;
  panOrGst: string;
  businessAddress: string;
  status: string;
  activatedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

interface CreativeRow {
  adId: string;
  placement?: string;
  imageUrl?: string;
  linkUrl: string;
  title: string;
  active: boolean;
  status?: string;
  impressions?: number;
  clicks?: number;
}

const SECTION_LABELS: Record<string, string> = {
  midroll: "Mid-Roll Video Ad",
  homepage_banner: "Homepage Banner",
  watch_banner: "Watch Page Banner",
};

interface PendingImage {
  imageUrl: string;
  imageUrlDesktop: string;
  fileName: string;
}

export default function AdminSponsorshipDetailPage() {
  const params = useParams();
  const sponsorshipId = params?.sponsorshipId as string;

  const [sponsorship, setSponsorship] = useState<SponsorshipDetail | null>(null);
  const [creatives, setCreatives] = useState<CreativeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [pendingImages, setPendingImages] = useState<Record<string, PendingImage[]>>({});
  const [uploadingSection, setUploadingSection] = useState<string | null>(null);

  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [videoUploading, setVideoUploading] = useState(false);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const [activating, setActivating] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authedFetch(`/api/admin/sponsorships/${sponsorshipId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't load this sponsorship.");
      setSponsorship(data.sponsorship);
      setCreatives(data.creatives || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sponsorshipId]);

  const handleImageFilesChange = async (section: string, files: FileList | null) => {
    if (!files || files.length === 0) return;
    const existing = pendingImages[section] || [];
    const room = Math.max(0, 3 - existing.length);
    const toProcess = Array.from(files).slice(0, room);

    const processed: PendingImage[] = [];
    for (const file of toProcess) {
      try {
        const [imageUrl, imageUrlDesktop] = await Promise.all([
          compressImageToBanner(file, 140_000, 0.75),
          compressImageToBanner(file, 140_000, 2.33),
        ]);
        processed.push({ imageUrl, imageUrlDesktop, fileName: file.name });
      } catch (err) {
        console.error(`Couldn't process ${file.name}:`, err);
      }
    }
    setPendingImages((prev) => ({ ...prev, [section]: [...existing, ...processed] }));
  };

  const removePendingImage = (section: string, index: number) => {
    setPendingImages((prev) => ({
      ...prev,
      [section]: (prev[section] || []).filter((_, i) => i !== index),
    }));
  };

  const uploadBannerAssets = async (section: string) => {
    const images = pendingImages[section] || [];
    if (images.length === 0) return;
    setUploadingSection(section);
    setActionError(null);
    try {
      const res = await authedFetch(`/api/admin/sponsorships/${sponsorshipId}/banner-assets`, {
        method: "POST",
        body: JSON.stringify({
          section,
          images: images.map((img) => ({ imageUrl: img.imageUrl, imageUrlDesktop: img.imageUrlDesktop })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn't upload those images.");
      setPendingImages((prev) => ({ ...prev, [section]: [] }));
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setUploadingSection(null);
    }
  };

  const handleVideoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setVideoError(null);
    if (!file) return;
    if (file.type !== "video/mp4" && file.type !== "video/webm") {
      setVideoError("Mid-roll videos must be MP4 or WebM.");
      return;
    }
    if (file.size > MIDROLL_VIDEO_MAX_BYTES) {
      setVideoError(`That file is ${(file.size / 1_000_000).toFixed(1)}MB — mid-roll videos must be 50MB or smaller.`);
      return;
    }
    setVideoFile(file);
  };

  const uploadVideo = async () => {
    if (!videoFile) return;
    setVideoUploading(true);
    setActionError(null);
    try {
      const res = await authedFetch("/api/admin/midroll-ads/create-upload", {
        method: "POST",
        body: JSON.stringify({ sponsorshipId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn't start video upload.");

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", data.uploadUrl);
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed with status ${xhr.status}`)));
        xhr.onerror = () => reject(new Error("Network error during upload."));
        xhr.send(videoFile);
      });

      setVideoFile(null);
      if (videoInputRef.current) videoInputRef.current.value = "";
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setVideoUploading(false);
    }
  };

  const activate = async () => {
    setActivating(true);
    setActionError(null);
    try {
      const res = await authedFetch(`/api/admin/sponsorships/${sponsorshipId}/activate`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn't activate this sponsorship.");
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setActivating(false);
    }
  };

  const cancel = async () => {
    const reason = window.prompt("Reason for cancelling (visible only in the admin audit log):") || "Cancelled by admin.";
    setCancelling(true);
    setActionError(null);
    try {
      const res = await authedFetch(`/api/admin/sponsorships/${sponsorshipId}/cancel`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn't cancel this sponsorship.");
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center">
        <Loader2 size={24} className="animate-spin text-indigo-400" />
      </div>
    );
  }

  if (error || !sponsorship) {
    return (
      <div className="flex items-start gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300 light:text-red-800 font-semibold">
        <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
        <span>{error || "Sponsorship not found."}</span>
      </div>
    );
  }

  return (
    <div>
      <Link href="/admin/sponsorships" className="mb-4 flex items-center gap-1.5 text-xs font-semibold text-indigo-300 hover:text-indigo-200">
        <ArrowLeft size={14} /> Back to Sponsorships
      </Link>

      <div className="rounded-2xl border border-white/10 bg-[#071120] p-5 light:border-black/10 light:bg-white">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-white light:text-slate-900">{sponsorship.companyName}</h2>
            <p className="text-xs text-slate-400 light:text-slate-600">
              {sponsorship.sections.map((s) => SECTION_LABELS[s] || s).join(", ")} · ₹{sponsorship.amountInr.toLocaleString("en-IN")} · Reference {sponsorship.sponsorshipId}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {sponsorship.status !== "active" && sponsorship.status !== "cancelled" && sponsorship.paymentStatus === "paid" && (
              <button
                onClick={activate}
                disabled={activating}
                className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
              >
                {activating ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                Activate — go live for 7 days
              </button>
            )}
            {sponsorship.status !== "cancelled" && (
              <button
                onClick={cancel}
                disabled={cancelling}
                className="flex items-center gap-1.5 rounded-xl border border-red-500/30 px-3.5 py-2 text-xs font-bold text-red-300 disabled:opacity-60"
              >
                {cancelling ? <Loader2 size={14} className="animate-spin" /> : <Ban size={14} />}
                Cancel
              </button>
            )}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 border-t border-white/10 pt-4 text-xs sm:grid-cols-2 light:border-black/10">
          <div><span className="text-slate-500">Contact:</span> <span className="text-slate-200 light:text-slate-800">{sponsorship.contactName} · {sponsorship.contactEmail} · {sponsorship.contactPhone}</span></div>
          <div><span className="text-slate-500">Website:</span> <span className="text-slate-200 light:text-slate-800">{sponsorship.websiteUrl}</span></div>
          <div><span className="text-slate-500">Legal name (KYC):</span> <span className="text-slate-200 light:text-slate-800">{sponsorship.legalName}</span></div>
          <div><span className="text-slate-500">PAN/GST (KYC):</span> <span className="text-slate-200 light:text-slate-800">{sponsorship.panOrGst}</span></div>
          <div className="sm:col-span-2"><span className="text-slate-500">Address (KYC):</span> <span className="text-slate-200 light:text-slate-800">{sponsorship.businessAddress}</span></div>
          <div><span className="text-slate-500">Payment:</span> <span className="text-slate-200 light:text-slate-800">{sponsorship.paymentStatus}</span></div>
          <div><span className="text-slate-500">Status:</span> <span className="text-slate-200 light:text-slate-800">{sponsorship.status}{sponsorship.expiresAt ? ` · live until ${new Date(sponsorship.expiresAt).toLocaleString("en-IN")}` : ""}</span></div>
        </div>
      </div>

      {actionError && (
        <div className="mt-4 flex items-start gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-xs font-semibold text-red-300 light:text-red-800">
          <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {sponsorship.paymentStatus !== "paid" && (
        <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-xs text-amber-300 light:text-amber-800 font-semibold">
          This order hasn&apos;t been paid for yet — assets can&apos;t be activated until payment is confirmed.
        </div>
      )}

      {/* Banner sections: image upload */}
      {sponsorship.sections
        .filter((s) => s === "homepage_banner" || s === "watch_banner")
        .map((section) => {
          const staged = creatives.filter((c) => c.placement === (section === "homepage_banner" ? "homepage" : "watch"));
          const pending = pendingImages[section] || [];
          return (
            <div key={section} className="mt-4 rounded-2xl border border-white/10 bg-[#071120] p-4 light:border-black/10 light:bg-white">
              <p className="flex items-center gap-1.5 text-sm font-black text-white light:text-slate-900">
                <ImageIcon size={15} /> {SECTION_LABELS[section]} — up to 3 images
              </p>

              {staged.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {staged.map((c) => (
                    <div key={c.adId} className="flex items-center gap-1.5 rounded-lg bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-slate-300 light:bg-black/5 light:text-slate-700">
                      {c.active ? <CheckCircle2 size={11} className="text-emerald-400" /> : <Loader2 size={11} className="text-amber-400" />}
                      {c.active ? "Live" : "Staged"} · {c.impressions ?? 0} views · {c.clicks ?? 0} clicks
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-3 flex flex-wrap gap-2">
                {pending.map((img, i) => (
                  <div key={i} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.imageUrl} alt={img.fileName} className="h-16 w-16 rounded-lg border border-white/10 object-cover" />
                    <button
                      onClick={() => removePendingImage(section, i)}
                      className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white"
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                ))}
                {pending.length < 3 && (
                  <label className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-lg border border-dashed border-white/20 text-slate-400 hover:border-orange-400/50 hover:text-orange-400">
                    <Upload size={16} />
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => handleImageFilesChange(section, e.target.files)}
                    />
                  </label>
                )}
              </div>

              {pending.length > 0 && (
                <button
                  onClick={() => uploadBannerAssets(section)}
                  disabled={uploadingSection === section}
                  className="mt-3 flex items-center gap-1.5 rounded-xl bg-orange-500 px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
                >
                  {uploadingSection === section ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  Upload {pending.length} image{pending.length > 1 ? "s" : ""}
                </button>
              )}
            </div>
          );
        })}

      {/* Mid-roll section: video upload */}
      {sponsorship.sections.includes("midroll") && (
        <div className="mt-4 rounded-2xl border border-white/10 bg-[#071120] p-4 light:border-black/10 light:bg-white">
          <p className="flex items-center gap-1.5 text-sm font-black text-white light:text-slate-900">
            <Video size={15} /> Mid-Roll Video Ad — 1 video, up to 50MB
          </p>

          {creatives
            .filter((c) => !c.placement)
            .map((c) => (
              <div key={c.adId} className="mt-3 flex items-center gap-1.5 rounded-lg bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-slate-300 w-fit light:bg-black/5 light:text-slate-700">
                {c.active ? <CheckCircle2 size={11} className="text-emerald-400" /> : <Loader2 size={11} className="text-amber-400" />}
                {c.status === "processing" ? "Processing on Mux…" : c.active ? "Live" : "Staged, ready to activate"} · {c.impressions ?? 0} views · {c.clicks ?? 0} clicks
              </div>
            ))}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input ref={videoInputRef} type="file" accept="video/mp4,video/webm" onChange={handleVideoFileChange} className="text-xs text-slate-300 light:text-slate-700" />
            {videoFile && (
              <button
                onClick={uploadVideo}
                disabled={videoUploading}
                className="flex items-center gap-1.5 rounded-xl bg-orange-500 px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
              >
                {videoUploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                Upload video
              </button>
            )}
          </div>
          {videoError && <p className="mt-1 text-[11px] font-semibold text-red-400">{videoError}</p>}
        </div>
      )}
    </div>
  );
}
