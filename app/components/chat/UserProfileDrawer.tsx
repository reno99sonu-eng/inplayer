"use client";

import { useEffect, useState } from "react";
import {
  X,
  ShieldCheck,
  Bell,
  BellOff,
  Ban,
  Timer,
  FileText,
  Image as ImageIcon,
  CheckCircle2,
  ExternalLink,
  Users,
  Video,
} from "lucide-react";
import { formatTimeAgo, formatViews } from "@/app/lib/formatters";

interface SharedMediaItem {
  id: string;
  type: "image" | "video" | "file" | "voice";
  url: string;
  name?: string;
  createdAt: string;
}

interface UserProfileDrawerProps {
  open: boolean;
  onClose: () => void;
  username: string;
  avatarUrl: string;
  online: boolean;
  lastActiveAt?: string | null;
  conversationId: string;
  muted?: boolean;
  blocked?: boolean;
  disappearingEnabled?: boolean;
  disappearingLabel?: string;
  onToggleMute: () => void;
  onToggleBlock: () => void;
  onToggleDisappearing: () => void;
  sharedMedia?: SharedMediaItem[];
}

interface PublicUserData {
  name?: string;
  description?: string;
  isVerified?: boolean;
  subscriberCount?: number;
  totalViews?: number;
  joinedAt?: string;
}

export default function UserProfileDrawer({
  open,
  onClose,
  username,
  avatarUrl,
  online,
  lastActiveAt,
  muted,
  blocked,
  disappearingEnabled,
  disappearingLabel,
  onToggleMute,
  onToggleBlock,
  onToggleDisappearing,
  sharedMedia = [],
}: UserProfileDrawerProps) {
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [profileData, setProfileData] = useState<PublicUserData | null>(null);
  const [activeTab, setActiveTab] = useState<"about" | "media">("about");

  useEffect(() => {
    if (!open || !username || username === "…") return;
    let isSubscribed = true;

    async function loadPublicData() {
      setLoadingProfile(true);
      try {
        const res = await fetch(`/api/users/${encodeURIComponent(username)}`);
        if (res.ok) {
          const data = await res.json();
          if (isSubscribed) {
            setProfileData({
              name: data.name || username,
              description: data.description || "Hey there! I am using InPlayer.",
              isVerified: !!data.isVerified,
              subscriberCount: data.subscriberCount || 0,
              totalViews: data.totalViews || 0,
            });
          }
        }
      } catch (err) {
        console.error("Failed to load user profile drawer data:", err);
      } finally {
        if (isSubscribed) setLoadingProfile(false);
      }
    }

    loadPublicData();
    return () => {
      isSubscribed = false;
    };
  }, [open, username]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm transition-opacity duration-300 animate-fadeIn">
      {/* Backdrop overlay click to close */}
      <div className="flex-1" onClick={onClose} />

      {/* Drawer Container */}
      <div className="relative flex h-full w-full max-w-md flex-col border-l border-white/10 bg-[#0A1628] light:bg-white text-white light:text-slate-900 shadow-2xl transition-transform duration-300 animate-slideLeft">
        {/* Drawer Header */}
        <div className="flex items-center justify-between border-b border-white/10 light:border-slate-200 px-5 py-4 bg-white/[0.02] light:bg-slate-50">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-orange-400" />
            <h3 className="text-base font-bold text-slate-100 light:text-slate-900">
              Contact Info
            </h3>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 light:border-slate-300 bg-white/5 light:bg-slate-100 text-slate-400 hover:text-white light:hover:text-slate-900 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-5 py-6 space-y-6">
          {/* Avatar Hero Card */}
          <div className="flex flex-col items-center text-center">
            <div className="relative mb-3">
              <img
                src={avatarUrl || "/avatars/avatar.png"}
                alt={username}
                className="h-28 w-28 rounded-full object-cover border-4 border-orange-500/20 shadow-xl"
              />
              {online ? (
                <span className="absolute bottom-1 right-1 h-5 w-5 rounded-full border-4 border-[#0A1628] light:border-white bg-emerald-400 shadow-md" />
              ) : (
                <span className="absolute bottom-1 right-1 h-5 w-5 rounded-full border-4 border-[#0A1628] light:border-white bg-slate-500 shadow-md" />
              )}
            </div>

            <div className="flex items-center justify-center gap-1.5">
              <h2 className="text-xl font-black text-white light:text-slate-900">
                {profileData?.name || `@${username}`}
              </h2>
              {profileData?.isVerified && (
                <CheckCircle2 className="h-5 w-5 text-sky-400 fill-sky-400/20" />
              )}
            </div>
            <p className="text-xs font-semibold text-orange-400 mt-0.5">
              @{username}
            </p>

            <p className="mt-1 text-xs text-slate-400 light:text-slate-500">
              {online
                ? "Active Now"
                : lastActiveAt
                ? `Last active ${formatTimeAgo(lastActiveAt)}`
                : "Offline"}
            </p>
          </div>

          {/* Navigation Tabs */}
          <div className="flex rounded-2xl border border-white/10 light:border-slate-200 bg-white/[0.03] light:bg-slate-100 p-1">
            <button
              onClick={() => setActiveTab("about")}
              className={`flex-1 rounded-xl py-2 text-xs font-bold transition ${
                activeTab === "about"
                  ? "bg-gradient-to-r from-[#FF7A18] to-[#FF9A00] text-white shadow-md"
                  : "text-slate-400 hover:text-white light:text-slate-600"
              }`}
            >
              Overview & About
            </button>
            <button
              onClick={() => setActiveTab("media")}
              className={`flex-1 rounded-xl py-2 text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                activeTab === "media"
                  ? "bg-gradient-to-r from-[#FF7A18] to-[#FF9A00] text-white shadow-md"
                  : "text-slate-400 hover:text-white light:text-slate-600"
              }`}
            >
              Shared Files ({sharedMedia.length})
            </button>
          </div>

          {/* Tab 1: Overview & About */}
          {activeTab === "about" && (
            <div className="space-y-4 animate-fadeIn">
              {/* Bio Card */}
              <div className="rounded-2xl border border-white/10 light:border-slate-200 bg-white/[0.03] light:bg-slate-50 p-4">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  About
                </p>
                <p className="text-xs leading-relaxed text-slate-200 light:text-slate-800">
                  {profileData?.description || "Hey there! I am using InPlayer."}
                </p>
              </div>

              {/* Channel Stats (If Creator) */}
              {profileData && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-white/10 light:border-slate-200 bg-white/[0.03] light:bg-slate-50 p-3 text-center">
                    <div className="flex items-center justify-center gap-1.5 text-amber-400 mb-1">
                      <Users size={16} />
                      <span className="text-xs font-bold">Subscribers</span>
                    </div>
                    <p className="text-base font-black text-white light:text-slate-900">
                      {formatViews(profileData.subscriberCount || 0)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 light:border-slate-200 bg-white/[0.03] light:bg-slate-50 p-3 text-center">
                    <div className="flex items-center justify-center gap-1.5 text-sky-400 mb-1">
                      <Video size={16} />
                      <span className="text-xs font-bold">Total Views</span>
                    </div>
                    <p className="text-base font-black text-white light:text-slate-900">
                      {formatViews(profileData.totalViews || 0)}
                    </p>
                  </div>
                </div>
              )}

              {/* View Full Profile Link */}
              <a
                href={`/u/${encodeURIComponent(username)}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between rounded-2xl border border-orange-500/30 bg-orange-500/10 px-4 py-3 text-xs font-bold text-orange-300 hover:bg-orange-500/20 transition"
              >
                <span>View Full Public Channel Profile</span>
                <ExternalLink size={14} />
              </a>
            </div>
          )}

          {/* Tab 2: Shared Media & Docs */}
          {activeTab === "media" && (
            <div className="animate-fadeIn">
              {sharedMedia.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed border-white/10 rounded-2xl">
                  <ImageIcon size={32} className="text-slate-500 mb-2 opacity-50" />
                  <p className="text-xs text-slate-400">
                    No photos, videos, or documents shared in this chat yet.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {sharedMedia.map((item) => (
                    <div
                      key={item.id}
                      className="group relative aspect-square overflow-hidden rounded-xl border border-white/10 bg-black/40"
                    >
                      {item.type === "image" ? (
                        <img
                          src={item.url}
                          alt="Media attachment"
                          className="h-full w-full object-cover transition group-hover:scale-105"
                        />
                      ) : item.type === "video" ? (
                        <video
                          src={item.url}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full flex-col items-center justify-center p-2 text-center bg-slate-800">
                          <FileText size={20} className="text-orange-400 mb-1" />
                          <span className="text-[10px] line-clamp-1 font-mono text-slate-300">
                            {item.name || "Document"}
                          </span>
                        </div>
                      )}
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition"
                      >
                        <ExternalLink size={16} className="text-white" />
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Quick Chat Actions */}
          <div className="space-y-2 pt-2 border-t border-white/10 light:border-slate-200">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              Conversation Settings
            </p>

            <button
              onClick={onToggleMute}
              className="flex w-full items-center justify-between rounded-2xl border border-white/10 light:border-slate-200 bg-white/[0.03] light:bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-200 light:text-slate-800 transition hover:bg-white/10"
            >
              <div className="flex items-center gap-2.5">
                {muted ? (
                  <Bell className="text-emerald-400" size={16} />
                ) : (
                  <BellOff className="text-slate-400" size={16} />
                )}
                <span>{muted ? "Unmute Notifications" : "Mute Notifications"}</span>
              </div>
              <span className="text-[10px] text-slate-400">
                {muted ? "Muted" : "Active"}
              </span>
            </button>

            <button
              onClick={onToggleDisappearing}
              className="flex w-full items-center justify-between rounded-2xl border border-white/10 light:border-slate-200 bg-white/[0.03] light:bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-200 light:text-slate-800 transition hover:bg-white/10"
            >
              <div className="flex items-center gap-2.5">
                <Timer size={16} className="text-amber-400" />
                <span>Disappearing Messages</span>
              </div>
              <span className="text-[10px] font-bold text-orange-400">
                {disappearingEnabled ? disappearingLabel || "On" : "Off"}
              </span>
            </button>

            <button
              onClick={onToggleBlock}
              className="flex w-full items-center gap-2.5 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-xs font-bold text-red-400 transition hover:bg-red-500/20"
            >
              <Ban size={16} />
              <span>{blocked ? "Unblock Contact" : "Block Contact"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
