"use client";

import CreatePopup from "./CreatePopup";
import AIStudioModal from "./AIStudioModal";
import { useEffect, useRef, useState } from "react";
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
} from "lucide-react";

interface Notification {
  notificationId: string;
  type: "like" | "comment" | "subscribe" | "message" | "message_request" | "admin_announcement";
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

  useEffect(() => {
    if (!signedIn) return;

    async function loadNotifications() {
      try {
        const session = await fetchAuthSession();
        const idToken = session.tokens?.idToken?.toString();

        const res = await fetch("/api/notifications", {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        const data = await res.json();
        const list: Notification[] = data.notifications || [];

        setNotifications(list);
        setUnreadCount(list.filter((n) => !n.read).length);
      } catch (err) {
        console.error("Failed to load notifications:", err);
      }
    }

    loadNotifications();
  }, [signedIn]);

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
          onClick={() => setNotifOpen(!notifOpen)}
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
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500" />
          )}
        </button>

        <div
          className={`
            absolute
            right-0
            mt-3
            w-[300px]
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
          <div className="border-b border-white/10 light:border-black/10 px-5 py-4">
            <h3 className="text-sm font-black text-white light:text-slate-900">Notifications</h3>
          </div>

          <div className="max-h-80 overflow-y-auto p-4">
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
              <div className="space-y-2">
                {notifications.map((n) => {
                  const isMessageType = n.type === "message" || n.type === "message_request";
                  const isAnnouncement = n.type === "admin_announcement";
                  const hasIcon = isMessageType || isAnnouncement;
                  const content = (
                    <>
                      <div className="flex items-start gap-2">
                        {isAnnouncement ? (
                          <Megaphone size={14} className="mt-0.5 flex-shrink-0 text-orange-400" />
                        ) : (
                          isMessageType &&
                          (n.type === "message_request" ? (
                            <MessageSquarePlus size={14} className="mt-0.5 flex-shrink-0 text-orange-400" />
                          ) : (
                            <MessageSquare size={14} className="mt-0.5 flex-shrink-0 text-orange-400" />
                          ))
                        )}
                        <p className="text-sm text-white light:text-slate-900">{n.message}</p>
                      </div>
                      <p className={hasIcon ? "mt-0.5 pl-[22px] text-xs text-slate-500" : "text-xs text-slate-500"}>
                        {formatTimeAgo(n.createdAt)}
                      </p>
                    </>
                  );

                  const className = `rounded-xl px-3 py-2.5 ${
                    n.read
                      ? "bg-white/5 light:bg-black/5"
                      : "bg-orange-500/10 border border-orange-400/20"
                  }`;

                  // Only the new message-related types navigate anywhere
                  // — like/comment/subscribe notifications keep their
                  // existing (purely display) behavior untouched.
                  if (isMessageType && n.conversationId) {
                    return (
                      <button
                        key={n.notificationId}
                        onClick={() => {
                          setNotifOpen(false);
                          router.push(`/messages/${n.conversationId}`);
                        }}
                        className={`block w-full text-left transition hover:brightness-110 ${className}`}
                      >
                        {content}
                      </button>
                    );
                  }

                  return (
                    <div key={n.notificationId} className={className}>
                      {content}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <AIStudioModal open={aiOpen} onClose={() => setAiOpen(false)} />
    </div>
  );
}
