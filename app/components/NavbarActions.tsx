"use client";

import CreatePopup from "./CreatePopup";
import AIStudioModal from "./AIStudioModal";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchAuthSession } from "aws-amplify/auth";
import { useAuthModal } from "./auth/AuthProvider";
import { formatTimeAgo } from "@/app/lib/formatters";
import {
  Bell,
  Plus,
  Video,
  Radio,
  Mic2,
  Sparkles,
  MessageSquare,
  MessageSquarePlus,
  Megaphone,
  Heart,
  MessageCircle,
  UserPlus,
  ShieldAlert,
} from "lucide-react";

interface Notification {
  notificationId: string;
  type:
    | "like"
    | "comment"
    | "comment_reply"
    | "subscribe"
    | "share"
    | "message"
    | "message_request"
    | "admin_announcement"
    | "live_stream"
    | "video_upload"
    | "ai_flag"
    | "copyright";
  message: string;
  read: boolean;
  createdAt: string;
  videoId?: string;
  conversationId?: string;
}

export default function NavbarActions() {
  const router = useRouter();
  const { signedIn } = useAuthModal();
  const [open, setOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [refreshNonce, setRefreshNonce] = useState(0);

  const refreshNotifications = useCallback(() => {
    setRefreshNonce((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!signedIn) return;
    let canceled = false;

    async function fetchNotifications() {
      try {
        const session = await fetchAuthSession();
        const idToken = session.tokens?.idToken?.toString();
        if (!idToken || canceled) return;

        const res = await fetch("/api/notifications", {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        if (!res.ok || canceled) return;
        const data = await res.json();
        const list: Notification[] = data.notifications || [];

        if (!canceled) {
          setNotifications(list);
          setUnreadCount(list.filter((n) => !n.read).length);
        }
      } catch (err) {
        console.error("Failed to load notifications:", err);
      }
    }

    void fetchNotifications();

    // 30-second live polling so bell updates automatically
    const interval = setInterval(() => {
      void fetchNotifications();
    }, 30000);

    // Refresh immediately when user returns to window/tab
    const handleFocus = () => {
      void fetchNotifications();
    };
    window.addEventListener("focus", handleFocus);

    return () => {
      canceled = true;
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, [signedIn, refreshNonce]);

  // Mark everything as read the moment the panel is opened
  useEffect(() => {
    if (!notifOpen || !signedIn || unreadCount === 0) return;

    async function markRead() {
      try {
        const session = await fetchAuthSession();
        const idToken = session.tokens?.idToken?.toString();

        await fetch("/api/notifications", {
          method: "PATCH",
          headers: { Authorization: `Bearer ${idToken}` },
        });

        setUnreadCount(0);
      } catch (err) {
        console.error("Failed to mark notifications as read:", err);
      }
    }

    markRead();
  }, [notifOpen, signedIn, unreadCount]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        popupRef.current &&
        !popupRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }

      if (
        notifRef.current &&
        !notifRef.current.contains(e.target as Node)
      ) {
        setNotifOpen(false);
      }
    }

    if (open || notifOpen) {
      document.addEventListener("mousedown", handleClick);
    }

    return () =>
      document.removeEventListener("mousedown", handleClick);
  }, [open, notifOpen]);

  const items = [
    {
      icon: <Video size={20} />,
      title: "Upload Video",
      subtitle: "Movies • Shorts • Series",
      color: "from-red-500 to-orange-500",
      onClick: () => {
        setOpen(false);
        router.push("/upload");
      },
    },
    {
      icon: <Radio size={20} />,
      title: "Go Live",
      subtitle: "Streaming & Events",
      color: "from-orange-500 to-amber-400",
      onClick: () => {
        setOpen(false);
        router.push("/live");
      },
    },
    {
      icon: <Mic2 size={20} />,
      title: "Podcast",
      subtitle: "Voice & Audio Shows",
      color: "from-cyan-500 to-sky-400",
      onClick: () => {
        setOpen(false);
        try {
          sessionStorage.setItem("inplayer-upload-preset", "podcast");
        } catch {
          /* ignore */
        }
        router.push("/upload");
      },
    },
    {
      icon: <Sparkles size={20} />,
      title: "AI Studio",
      subtitle: "Generate with AI",
      color: "from-violet-500 to-fuchsia-500",
      onClick: () => {
        setOpen(false);
        setAiOpen(true);
      },
    },
  ];

  return (
    <div className="relative flex items-center gap-3">

      {/* Create */}

      <button
  onClick={() => {
    setOpen(!open);
  }}
  className="
    hidden lg:flex
    items-center
    gap-2
    rounded-full
    bg-gradient-to-r
    from-orange-500
    via-amber-400
    to-yellow-400
    px-5
    py-3
    text-sm
    font-bold
    text-slate-900
    shadow-xl
    transition-all
    duration-300
    hover:-translate-y-1
    hover:scale-105
  "
>
        
        <Plus size={18} />
        Create
      </button>

      {/* Popup */}

      <CreatePopup
  open={open}
  popupRef={popupRef}
  items={items}
/>

      {/* Notifications */}

      <div ref={notifRef} className="relative">
        <button
          onClick={() => {
            const next = !notifOpen;
            setNotifOpen(next);
            if (next) {
              refreshNotifications();
            }
          }}
          className="
            relative
            flex
            h-10
            w-10
            items-center
            justify-center
            rounded-full
            border
            border-white/20
            light:border-black/15
            bg-white/10
            light:bg-black/5
            backdrop-blur-2xl
            text-white
            light:text-slate-900
            transition-all
            duration-300
            hover:-translate-y-1
            hover:border-orange-400
            hover:bg-orange-500/10
          "
        >
          <Bell size={17} />

          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-md">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>

        <div
          className={`
            absolute
            right-0
            mt-3
            w-[320px]
            overflow-hidden
            rounded-3xl
            border
            border-white/10
            light:border-black/10
            bg-[#08111F]/95
            light:bg-[#F5EEDC]/95
            backdrop-blur-3xl
            shadow-[0_30px_80px_rgba(0,0,0,.55)]
            light:shadow-[0_30px_80px_rgba(0,0,0,.12)]
            transition-all
            duration-300
            origin-top-right
            z-[70]
            ${
              notifOpen
                ? "opacity-100 scale-100 translate-y-0 pointer-events-auto"
                : "opacity-0 scale-95 -translate-y-2 pointer-events-none"
            }
          `}
        >
          <div className="flex items-center justify-between border-b border-white/10 light:border-black/10 px-5 py-4">
            <h3 className="text-sm font-black text-white light:text-slate-900">Notifications</h3>
            {unreadCount > 0 && (
              <span className="rounded-full bg-orange-500/20 px-2 py-0.5 text-[10px] font-bold text-orange-400 border border-orange-500/30">
                {unreadCount} new
              </span>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto p-3">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Bell size={28} className="mb-3 text-slate-500" />
                <p className="text-sm font-semibold text-white light:text-slate-900">
                  You&apos;re all caught up
                </p>
                <p className="mt-1 text-xs text-slate-400 light:text-slate-600">
                  New notifications will show up here.
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {notifications.map((n) => {
                  const isMessageType = n.type === "message" || n.type === "message_request";

                  const renderIcon = () => {
                    switch (n.type) {
                      case "video_upload":
                        return <Video size={14} className="mt-0.5 flex-shrink-0 text-orange-400" />;
                      case "live_stream":
                        return <Radio size={14} className="mt-0.5 flex-shrink-0 text-red-500 animate-pulse" />;
                      case "like":
                        return <Heart size={14} className="mt-0.5 flex-shrink-0 text-rose-400" />;
                      case "comment":
                      case "comment_reply":
                        return <MessageCircle size={14} className="mt-0.5 flex-shrink-0 text-amber-400" />;
                      case "subscribe":
                        return <UserPlus size={14} className="mt-0.5 flex-shrink-0 text-emerald-400" />;
                      case "message_request":
                        return <MessageSquarePlus size={14} className="mt-0.5 flex-shrink-0 text-orange-400" />;
                      case "message":
                        return <MessageSquare size={14} className="mt-0.5 flex-shrink-0 text-orange-400" />;
                      case "admin_announcement":
                        return <Megaphone size={14} className="mt-0.5 flex-shrink-0 text-sky-400" />;
                      case "ai_flag":
                      case "copyright":
                        return <ShieldAlert size={14} className="mt-0.5 flex-shrink-0 text-amber-500" />;
                      default:
                        return <Bell size={14} className="mt-0.5 flex-shrink-0 text-orange-400" />;
                    }
                  };

                  const content = (
                    <>
                      <div className="flex items-start gap-2">
                        {renderIcon()}
                        <p className="text-xs sm:text-sm text-white light:text-slate-900 leading-snug">{n.message}</p>
                      </div>
                      <p className="mt-1 pl-[22px] text-[11px] text-slate-500">
                        {formatTimeAgo(n.createdAt)}
                      </p>
                    </>
                  );

                  const className = `block w-full text-left transition hover:brightness-110 rounded-xl px-3 py-2.5 ${
                    n.read
                      ? "bg-white/5 light:bg-black/5"
                      : "bg-orange-500/10 border border-orange-400/20"
                  }`;

                  return (
                    <button
                      key={n.notificationId}
                      onClick={() => {
                        setNotifOpen(false);
                        if (isMessageType && n.conversationId) {
                          router.push(`/messages/${n.conversationId}`);
                        } else if (n.type === "live_stream" && n.videoId) {
                          router.push(`/live/${n.videoId}`);
                        } else if (n.videoId) {
                          router.push(`/watch/${n.videoId}`);
                        } else if (n.type === "subscribe") {
                          router.push("/studio");
                        }
                      }}
                      className={className}
                    >
                      {content}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="border-t border-white/10 light:border-black/10 p-2 text-center bg-black/20">
            <button
              onClick={() => {
                setNotifOpen(false);
                router.push("/notifications");
              }}
              className="w-full py-1.5 text-xs font-bold text-orange-400 hover:text-orange-300 transition"
            >
              View all notifications →
            </button>
          </div>
        </div>
      </div>

      <AIStudioModal open={aiOpen} onClose={() => setAiOpen(false)} />
    </div>
  );
}
