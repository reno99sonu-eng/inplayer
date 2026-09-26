"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchAuthSession } from "aws-amplify/auth";
import { useAuthModal } from "@/app/components/auth/AuthProvider";
import { formatTimeAgo } from "@/app/lib/formatters";
import {
  Bell,
  Video,
  Radio,
  Heart,
  MessageCircle,
  UserPlus,
  ShieldAlert,
  MessageSquare,
  MessageSquarePlus,
  Megaphone,
  CheckCheck,
  ArrowLeft,
} from "lucide-react";

interface NotificationItem {
  userId: string;
  notificationId: string;
  type: string;
  message: string;
  videoId?: string;
  conversationId?: string;
  read: boolean;
  createdAt: string;
}

export default function NotificationsPage() {
  const router = useRouter();
  const { signedIn, openSignIn } = useAuthModal();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unread" | "messages">("all");
  const [markingRead, setMarkingRead] = useState(false);

  useEffect(() => {
    if (!signedIn) return;
    let canceled = false;

    async function fetchNotifications() {
      try {
        const session = await fetchAuthSession();
        const idToken = session.tokens?.idToken?.toString();
        if (!idToken || canceled) {
          if (!canceled) setLoading(false);
          return;
        }

        const res = await fetch("/api/notifications", {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        if (!res.ok || canceled) {
          if (!canceled) setLoading(false);
          return;
        }
        const data = await res.json();
        if (!canceled) {
          setNotifications(data.notifications || []);
          setLoading(false);
        }
      } catch (err) {
        console.error("Failed to fetch notifications:", err);
        if (!canceled) setLoading(false);
      }
    }

    void fetchNotifications();

    return () => {
      canceled = true;
    };
  }, [signedIn]);

  const handleMarkAllRead = async () => {
    if (!signedIn || markingRead) return;
    try {
      setMarkingRead(true);
      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken?.toString();
      if (!idToken) return;

      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${idToken}` },
      });

      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (err) {
      console.error("Failed to mark all as read:", err);
    } finally {
      setMarkingRead(false);
    }
  };

  const filtered = notifications.filter((n) => {
    if (filter === "unread") return !n.read;
    if (filter === "messages") {
      return n.type === "message" || n.type === "message_request";
    }
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  const renderIcon = (n: NotificationItem) => {
    switch (n.type) {
      case "video_upload":
        return <Video size={18} className="text-orange-400" />;
      case "live_stream":
        return <Radio size={18} className="text-red-500 animate-pulse" />;
      case "like":
        return <Heart size={18} className="text-rose-400" />;
      case "comment":
      case "comment_reply":
        return <MessageCircle size={18} className="text-amber-400" />;
      case "subscribe":
        return <UserPlus size={18} className="text-emerald-400" />;
      case "message_request":
        return <MessageSquarePlus size={18} className="text-orange-400" />;
      case "message":
        return <MessageSquare size={18} className="text-orange-400" />;
      case "admin_announcement":
        return <Megaphone size={18} className="text-sky-400" />;
      case "ai_flag":
      case "copyright":
        return <ShieldAlert size={18} className="text-amber-500" />;
      default:
        return <Bell size={18} className="text-orange-400" />;
    }
  };

  const handleNotificationClick = (n: NotificationItem) => {
    if (n.type === "message" || n.type === "message_request") {
      if (n.conversationId) router.push(`/messages/${n.conversationId}`);
    } else if (n.type === "live_stream" && n.videoId) {
      router.push(`/live/${n.videoId}`);
    } else if (n.videoId) {
      router.push(`/watch/${n.videoId}`);
    } else if (n.type === "subscribe") {
      router.push("/studio");
    }
  };

  if (!signedIn) {
    return (
      <div className="min-h-screen pt-24 pb-20 px-4 max-w-4xl mx-auto flex flex-col items-center justify-center text-center text-white light:text-slate-900">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-orange-500/10 border border-orange-500/20 text-orange-400 mb-6 shadow-xl">
          <Bell size={36} />
        </div>
        <h1 className="text-2xl sm:text-3xl font-black">Sign in to view notifications</h1>
        <p className="mt-2 text-sm text-slate-400 light:text-slate-600 max-w-md">
          See updates from your favorite creators, video comments, likes, subscriber notifications, and messages.
        </p>
        <button
          onClick={() => openSignIn()}
          className="mt-6 px-8 py-3 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold text-sm shadow-lg hover:scale-105 active:scale-95 transition"
        >
          Sign In
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-20 pb-28 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto text-white light:text-slate-900">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/10 light:border-black/10">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 light:bg-black/5 hover:bg-white/10 light:hover:bg-black/10 transition border border-white/10 light:border-black/10"
            title="Go back"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black tracking-tight">Notifications</h1>
              {unreadCount > 0 && (
                <span className="rounded-full bg-orange-500 px-2.5 py-0.5 text-xs font-black text-white shadow-sm">
                  {unreadCount}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 light:text-slate-600">
              Activity, uploads, interactions, and system alerts
            </p>
          </div>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            disabled={markingRead}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 light:bg-black/5 hover:bg-orange-500/10 text-xs font-bold text-orange-400 hover:text-orange-300 border border-white/10 light:border-black/10 transition self-start sm:self-auto"
          >
            <CheckCheck size={16} />
            <span>{markingRead ? "Marking..." : "Mark all as read"}</span>
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 py-4 border-b border-white/10 light:border-black/10 overflow-x-auto">
        <button
          onClick={() => setFilter("all")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition shrink-0 ${
            filter === "all"
              ? "bg-orange-500 text-white shadow-md shadow-orange-500/20"
              : "bg-white/5 light:bg-black/5 text-slate-400 light:text-slate-600 hover:text-white"
          }`}
        >
          All ({notifications.length})
        </button>
        <button
          onClick={() => setFilter("unread")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition shrink-0 ${
            filter === "unread"
              ? "bg-orange-500 text-white shadow-md shadow-orange-500/20"
              : "bg-white/5 light:bg-black/5 text-slate-400 light:text-slate-600 hover:text-white"
          }`}
        >
          Unread ({unreadCount})
        </button>
        <button
          onClick={() => setFilter("messages")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition shrink-0 ${
            filter === "messages"
              ? "bg-orange-500 text-white shadow-md shadow-orange-500/20"
              : "bg-white/5 light:bg-black/5 text-slate-400 light:text-slate-600 hover:text-white"
          }`}
        >
          Messages
        </button>
      </div>

      {/* Content List */}
      <div className="pt-6">
        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="h-20 rounded-2xl bg-white/[0.03] light:bg-black/[0.03] animate-pulse border border-white/5"
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5 light:bg-black/5 text-slate-500 mb-4">
              <Bell size={28} />
            </div>
            <h3 className="text-base font-bold">No notifications here</h3>
            <p className="mt-1 text-xs text-slate-400 light:text-slate-600 max-w-sm">
              {filter === "unread"
                ? "You've read all your notifications!"
                : "When creators you subscribe to upload or go live, you'll see alerts here."}
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filtered.map((n) => {
              return (
                <div
                  key={n.notificationId}
                  onClick={() => handleNotificationClick(n)}
                  className={`group flex items-start gap-4 p-4 rounded-2xl border transition-all duration-200 cursor-pointer ${
                    n.read
                      ? "bg-white/[0.02] light:bg-black/[0.02] border-white/5 light:border-black/5 hover:bg-white/[0.06] light:hover:bg-black/[0.05]"
                      : "bg-orange-500/[0.08] border-orange-500/20 hover:bg-orange-500/[0.12] shadow-sm"
                  }`}
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/5 light:bg-black/5 border border-white/10 light:border-black/10 group-hover:scale-105 transition">
                    {renderIcon(n)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold leading-snug text-white light:text-slate-900 group-hover:text-orange-400 transition">
                        {n.message}
                      </p>
                      {!n.read && (
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-orange-500 mt-1" />
                      )}
                    </div>
                    <p className="mt-1 text-xs text-slate-400 light:text-slate-500">
                      {formatTimeAgo(n.createdAt)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
