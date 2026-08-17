"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { fetchAuthSession } from "aws-amplify/auth";
import {
  ArrowLeft,
  Send,
  MoreVertical,
  Ban,
  BellOff,
  Bell,
  Timer,
  Check,
  CheckCheck,
  X,
  Loader2,
  Mic,
  Palette,
  Paperclip,
  Smile,
} from "lucide-react";
import { useAuthModal } from "@/app/components/auth/AuthProvider";
import { formatTimeAgo } from "@/app/lib/formatters";
import { otherParticipant } from "@/app/lib/conversationId";
import ReportButton from "@/app/components/ReportButton";
import MessageActionsMenu from "@/app/components/MessageActionsMenu";
import VoiceRecorder from "@/app/components/chat/VoiceRecorder";
import VoiceMessageBubble from "@/app/components/chat/VoiceMessageBubble";
import UserProfileDrawer from "@/app/components/chat/UserProfileDrawer";
import EmojiPicker from "@/app/components/chat/EmojiPicker";
import { CHAT_THEMES } from "@/app/components/chat/ChatThemes";
import { compressImageToDocument } from "@/app/lib/imageCompress";

interface ConversationDetail {
  conversationId: string;
  otherUserId: string;
  otherUsername: string | null;
  otherAvatarUrl: string | null;
  requestStatus: "pending" | "accepted";
  initiatedBy: string;
  blocked?: boolean;
  blockedByOther?: boolean;
  muted?: boolean;
  disappearingEnabled?: boolean;
  disappearingSeconds?: number | null;
  chatTheme?: string;
}

interface MessageItem {
  conversationId: string;
  messageId: string;
  senderId: string;
  text: string;
  createdAt: string;
  deletedForEveryone?: boolean;
  audioUrl?: string;
  audioDurationSec?: number;
  imageUrl?: string;
}

const DISAPPEARING_OPTIONS = [
  { seconds: 3600, label: "1 hour" },
  { seconds: 86400, label: "1 day" },
  { seconds: 604800, label: "1 week" },
];

export default function ConversationThreadPage() {
  const params = useParams<{ conversationId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { signedIn, authLoading, user, openSignIn } = useAuthModal();

  const withHint = searchParams.get("with");
  const targetUserId = user ? otherParticipant(params.conversationId, user.userId) : null;

  const [conversation, setConversation] = useState<ConversationDetail | null>(null);
  const [conversationLoaded, setConversationLoaded] = useState(false);
  const [otherIsOnline, setOtherIsOnline] = useState(false);
  const [otherLastActiveAt, setOtherLastActiveAt] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [otherLastReadAt, setOtherLastReadAt] = useState<string | null>(null);
  const [otherIsTyping, setOtherIsTyping] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const [profileDrawerOpen, setProfileDrawerOpen] = useState(false);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [imageProcessing, setImageProcessing] = useState(false);
  const [imageSending, setImageSending] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastTypingPingRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function authHeaders() {
    const session = await fetchAuthSession();
    const idToken = session.tokens?.idToken?.toString();
    return { Authorization: `Bearer ${idToken}` };
  }

  async function refetchConversation() {
    try {
      const headers = await authHeaders();
      const res = await fetch(`/api/messages/${params.conversationId}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setConversation(data.conversation);
        setOtherIsOnline(!!data.otherIsOnline);
        setOtherLastActiveAt(data.otherLastActiveAt || null);
      }
    } catch (err) {
      console.error("Failed to load conversation:", err);
    } finally {
      setConversationLoaded(true);
    }
  }

  async function fetchMessages() {
    try {
      const headers = await authHeaders();
      const res = await fetch(`/api/messages/${params.conversationId}/messages`, { headers });
      if (res.ok) {
        const data = await res.json();
        const newMessages = data.messages || [];
        setMessages((prev) => {
          // Play sound if a new message arrived from the other user
          if (prev.length > 0 && newMessages.length > prev.length) {
            const latestMsg = newMessages[newMessages.length - 1];
            if (latestMsg.senderId !== user?.userId) {
              const audio = new Audio("/sounds/pop.mp3");
              audio.play().catch(() => {});
            }
          }
          return newMessages;
        });
        setOtherLastReadAt(data.otherLastReadAt || null);
        setOtherIsTyping(!!data.otherIsTyping);
      }
    } catch (err) {
      console.error("Failed to load messages:", err);
    }
  }

  // Typing indicator ping (app/api/messages/[conversationId]/typing) —
  // throttled to at most once every 2s of active typing so a fast typist
  // doesn't fire a request per keystroke. The route's own TTL (6s) means
  // the indicator naturally clears on the other side shortly after
  // whoever's typing stops or navigates away.
  async function pingTyping() {
    const nowMs = Date.now();
    if (nowMs - lastTypingPingRef.current < 2000) return;
    lastTypingPingRef.current = nowMs;
    try {
      const headers = await authHeaders();
      await fetch(`/api/messages/${params.conversationId}/typing`, {
        method: "POST",
        headers,
      });
    } catch (err) {
      console.error("Failed to send typing ping:", err);
    }
  }

  useEffect(() => {
    if (!signedIn) {
      // setState wrapped in a nested, immediately-invoked function — the
      // `return` right after still has to bail out of this *outer* effect
      // (skipping the polling interval below), so unlike the usual
      // MaintenanceGate-style fix we can't move the `return` itself inside
      // the nested function too. See react-hooks/set-state-in-effect.
      (() => {
        setConversationLoaded(true);
      })();
      return;
    }

    (() => {
      refetchConversation();
      fetchMessages();
    })();

    // Simple polling while the thread is open — no WebSocket
    // infrastructure here, but this keeps the thread genuinely live
    // (real fetches, real new messages) rather than static.
    const interval = setInterval(fetchMessages, 4000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.conversationId, signedIn]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending || !targetUserId || !user) return;

    setSending(true);
    setSendError(null);
    const optimisticId = `optimistic-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { conversationId: params.conversationId, messageId: optimisticId, senderId: user.userId, text: trimmed, createdAt: new Date().toISOString() },
    ]);
    setText("");

    try {
      const headers = await authHeaders();
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ otherUserId: targetUserId, text: trimmed }),
      });
      const data = await res.json();

      if (!res.ok) {
        setMessages((prev) => prev.filter((m) => m.messageId !== optimisticId));
        setSendError(data.error || "Couldn't send that message.");
        setText(trimmed);
        return;
      }

      // Auto-moderation (app/lib/moderation.ts, via app/api/messages) held
      // this one back — it's saved and in the admin review queue, but the
      // recipient never sees it. fetchMessages() below won't include it
      // (the GET filters hidden messages out), which would otherwise make
      // it look like it silently vanished — this makes sure the sender
      // actually finds out what happened instead.
      if (data.flagged) {
        setMessages((prev) => prev.filter((m) => m.messageId !== optimisticId));
        setSendError("This message was flagged for review and wasn't delivered.");
        return;
      }

      await Promise.all([refetchConversation(), fetchMessages()]);
    } catch (err) {
      console.error("Failed to send message:", err);
      setMessages((prev) => prev.filter((m) => m.messageId !== optimisticId));
      setSendError("Something went wrong. Please try again.");
      setText(trimmed);
    } finally {
      setSending(false);
    }
  };

  const handleAction = async (action: string, extra?: Record<string, unknown>) => {
    setActionBusy(true);
    try {
      const headers = await authHeaders();
      const res = await fetch(`/api/messages/${params.conversationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ action, ...extra }),
      });
      if (res.ok) {
        if (action === "decline") {
          router.push("/messages");
          return;
        }
        await refetchConversation();
      }
    } catch (err) {
      console.error(`Failed to ${action}:`, err);
    } finally {
      setActionBusy(false);
    }
  };

  const handleSendVoice = async (audioDataUrl: string, durationSec: number) => {
    if (!targetUserId || !user) return;

    setVoiceMode(false);
    setSendError(null);
    const optimisticId = `optimistic-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        conversationId: params.conversationId,
        messageId: optimisticId,
        senderId: user.userId,
        text: "",
        audioUrl: audioDataUrl,
        audioDurationSec: durationSec,
        createdAt: new Date().toISOString(),
      },
    ]);

    try {
      const headers = await authHeaders();
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({
          otherUserId: targetUserId,
          audioUrl: audioDataUrl,
          audioDurationSec: durationSec,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setMessages((prev) => prev.filter((m) => m.messageId !== optimisticId));
        setSendError(data.error || "Couldn't send that voice note.");
        return;
      }

      await Promise.all([refetchConversation(), fetchMessages()]);
    } catch (err) {
      console.error("Failed to send voice note:", err);
      setMessages((prev) => prev.filter((m) => m.messageId !== optimisticId));
      setSendError("Something went wrong. Please try again.");
    }
  };

  const handleSetTheme = async (themeId: string) => {
    // Optimistic — the wallpaper picker should feel instant, same as every
    // other setting toggle in this menu.
    setConversation((prev) => (prev ? { ...prev, chatTheme: themeId } : prev));
    try {
      const headers = await authHeaders();
      await fetch(`/api/messages/${params.conversationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ action: "set_theme", theme: themeId }),
      });
    } catch (err) {
      console.error("Failed to save chat wallpaper:", err);
    }
  };

  const handlePickImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setImageError("Please choose an image file.");
      return;
    }

    setImageError(null);
    setImageProcessing(true);
    try {
      // Same compressor already used for KYC document photos — progressively
      // tries smaller widths/qualities until it lands under the target byte
      // budget, entirely in-browser via canvas. Same 300KB budget as voice
      // notes (see MAX_IMAGE_DATA_URL_LENGTH in app/api/messages/route.ts).
      const dataUrl = await compressImageToDocument(file, 300_000);
      setPendingImage(dataUrl);
    } catch (err) {
      console.error("Failed to process image:", err);
      setImageError("Couldn't process that photo. Please try another.");
    } finally {
      setImageProcessing(false);
    }
  };

  const handleSendImage = async () => {
    if (!pendingImage || !targetUserId || !user || imageSending) return;

    const imageToSend = pendingImage;
    const caption = text.trim();
    setImageSending(true);
    setSendError(null);
    const optimisticId = `optimistic-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        conversationId: params.conversationId,
        messageId: optimisticId,
        senderId: user.userId,
        text: caption,
        imageUrl: imageToSend,
        createdAt: new Date().toISOString(),
      },
    ]);
    setPendingImage(null);
    setText("");

    try {
      const headers = await authHeaders();
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ otherUserId: targetUserId, text: caption, imageUrl: imageToSend }),
      });
      const data = await res.json();

      if (!res.ok) {
        setMessages((prev) => prev.filter((m) => m.messageId !== optimisticId));
        setSendError(data.error || "Couldn't send that photo.");
        return;
      }

      await Promise.all([refetchConversation(), fetchMessages()]);
    } catch (err) {
      console.error("Failed to send photo:", err);
      setMessages((prev) => prev.filter((m) => m.messageId !== optimisticId));
      setSendError("Something went wrong. Please try again.");
    } finally {
      setImageSending(false);
    }
  };

  if (authLoading || !conversationLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#06101D] light:bg-[#FAF5E9]">
        <Loader2 size={28} className="animate-spin text-orange-400" />
      </div>
    );
  }

  if (!signedIn) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#06101D] light:bg-[#FAF5E9] px-6 text-center text-white light:text-slate-900">
        <h2 className="text-2xl font-black">Sign in to view this conversation</h2>
        <button
          onClick={openSignIn}
          className="mt-6 rounded-2xl bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] px-8 py-3 font-bold text-white shadow-[0_15px_35px_rgba(255,153,0,.3)] transition-all hover:-translate-y-0.5"
        >
          Sign In
        </button>
      </div>
    );
  }

  if (!targetUserId) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#06101D] light:bg-[#FAF5E9] px-6 text-center text-white light:text-slate-900">
        <p className="font-semibold">That conversation link isn&apos;t valid.</p>
        <Link href="/messages" className="mt-4 text-sm font-semibold text-orange-400">
          Back to Messages
        </Link>
      </div>
    );
  }

  const displayUsername = conversation?.otherUsername || withHint || "…";
  const displayAvatar = conversation?.otherAvatarUrl || "/avatars/avatar.png";
  const isPendingIncoming =
    conversation?.requestStatus === "pending" && conversation?.initiatedBy !== user?.userId;
  const isBlocked = !!(conversation?.blocked || conversation?.blockedByOther);
  const theme = CHAT_THEMES[conversation?.chatTheme || "default"] || CHAT_THEMES.default;

  // Extract the background color class from the theme's containerClass so we can place it on a dedicated layer.
  // containerClass usually looks like "bg-[#0B141A] text-white"
  const bgClassMatch = theme.containerClass.match(/bg-\[#?[a-zA-Z0-9]+\]|bg-\w+-\d+/);
  const bgColorClass = bgClassMatch ? bgClassMatch[0] : "bg-black";
  const textColorClass = theme.containerClass.replace(bgColorClass, "").trim();

  return (
    <div className={`relative flex flex-col overflow-hidden w-full h-[calc(100dvh-48px)] lg:h-[calc(100dvh-64px)] -mb-20 lg:-mb-0 pb-20 lg:pb-0 ${textColorClass} bg-transparent`}>
      {/* 1. Base Background Color (Lowest Layer) */}
      <div className={`absolute inset-0 z-0 pointer-events-none ${bgColorClass}`} />

      {/* 2. High-res Photo Wallpaper (Middle Layer) */}
      <div
        aria-hidden="true"
        className="absolute inset-0 z-0 pointer-events-none"
        style={{
          backgroundImage: theme.backgroundImageUrl ? `url(${theme.backgroundImageUrl})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
          opacity: 0.15,
        }}
      />

      {/* 3. SVG Texture Pattern (Top Background Layer) */}
      <div
        aria-hidden="true"
        className="absolute inset-0 z-0 pointer-events-none"
        style={{ 
          backgroundImage: theme.texturePattern,
          backgroundRepeat: "repeat",
          opacity: 0.4
        }}
      />

      {/* --- CHAT CONTENT (z-10 relative so it sits on top of all backgrounds) --- */}
      <div className="relative z-10 flex flex-col h-full w-full">
        <div className="flex items-center gap-3 border-b border-white/10 light:border-black/10 px-4 py-3 bg-inherit">
        <button
          onClick={() => router.back()}
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-white/10 light:border-black/10 bg-white/5 light:bg-black/5 transition hover:bg-white/15 light:hover:bg-black/10"
        >
          <ArrowLeft size={20} />
        </button>

        <button
          onClick={() => setProfileDrawerOpen(true)}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <div className="relative flex-shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element -- avatar may be a data URL. */}
            <img src={displayAvatar} alt={displayUsername} className="h-10 w-10 rounded-full object-cover" />
            {otherIsOnline && (
              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-[#06101D] light:border-[#FAF5E9] bg-emerald-400" />
            )}
          </div>
          <div className="min-w-0">
            <span className="block truncate font-bold">@{displayUsername}</span>
            <span className="block truncate text-[11px] text-slate-400 light:text-slate-600">
              {otherIsTyping
                ? "typing..."
                : otherIsOnline
                ? "Online"
                : otherLastActiveAt
                ? `Last seen ${formatTimeAgo(otherLastActiveAt)}`
                : ""}
            </span>
          </div>
        </button>

        <div className="relative flex-shrink-0">
          <button
            onClick={() => setSettingsOpen((v) => !v)}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 light:border-black/10 bg-white/5 light:bg-black/5 transition hover:bg-white/15 light:hover:bg-black/10"
          >
            <MoreVertical size={18} />
          </button>

          {settingsOpen && (
            <>
              {/* Invisible overlay to catch outside clicks and close the menu */}
              <div
                className="fixed inset-0 z-10"
                onClick={() => setSettingsOpen(false)}
              />
              <div className="absolute right-0 z-20 mt-2 w-64 overflow-hidden rounded-2xl border border-white/10 light:border-black/10 bg-[#0B1524] light:bg-white shadow-[0_20px_50px_rgba(0,0,0,.4)]">
                <button
                onClick={() => handleAction(conversation?.muted ? "unmute" : "mute")}
                disabled={actionBusy}
                className="flex w-full items-center gap-2.5 px-4 py-3 text-left text-sm font-semibold text-slate-200 light:text-slate-800 transition hover:bg-white/5 light:hover:bg-black/5 disabled:opacity-50"
              >
                {conversation?.muted ? <Bell size={15} /> : <BellOff size={15} />}
                {conversation?.muted ? "Unmute notifications" : "Mute notifications"}
              </button>

              <div className="border-t border-white/10 light:border-black/10 px-4 py-3">
                <p className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-200 light:text-slate-800">
                  <Palette size={15} /> Chat wallpaper
                </p>
                <div className="flex flex-wrap gap-2">
                  {Object.values(CHAT_THEMES).map((t) => (
                    <button
                      key={t.id}
                      onClick={() => handleSetTheme(t.id)}
                      title={t.name}
                      className={`h-7 w-7 rounded-full border-2 ${t.previewBg} ${
                        (conversation?.chatTheme || "default") === t.id
                          ? "ring-2 ring-orange-400 ring-offset-2 ring-offset-[#0B1524]"
                          : ""
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div className="border-t border-white/10 light:border-black/10 px-4 py-3">
                <p className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-200 light:text-slate-800">
                  <Timer size={15} /> Disappearing messages
                </p>
                {conversation?.disappearingEnabled ? (
                  <button
                    onClick={() => handleAction("toggle_disappearing")}
                    disabled={actionBusy}
                    className="text-xs font-semibold text-orange-400 disabled:opacity-50"
                  >
                    On ({DISAPPEARING_OPTIONS.find((o) => o.seconds === conversation.disappearingSeconds)?.label || "1 day"}) — turn off
                  </button>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {DISAPPEARING_OPTIONS.map((opt) => (
                      <button
                        key={opt.seconds}
                        onClick={() => handleAction("toggle_disappearing", { seconds: opt.seconds })}
                        disabled={actionBusy}
                        className="rounded-full border border-white/10 light:border-black/10 px-2.5 py-1 text-[11px] font-semibold text-slate-300 light:text-slate-700 transition hover:border-orange-400/40 disabled:opacity-50"
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={() => handleAction(conversation?.blocked ? "unblock" : "block")}
                disabled={actionBusy}
                className="flex w-full items-center gap-2.5 border-t border-white/10 light:border-black/10 px-4 py-3 text-left text-sm font-semibold text-red-400 transition hover:bg-red-500/10 disabled:opacity-50"
              >
                <Ban size={15} />
                {conversation?.blocked ? "Unblock" : "Block"} @{displayUsername}
              </button>
            </div>
            </>
          )}
        </div>
      </div>

      {isPendingIncoming && (
        <div className="flex items-center justify-between gap-3 border-b border-orange-400/20 bg-orange-500/[0.06] px-5 py-3">
          <p className="text-xs text-slate-300 light:text-slate-700">
            @{displayUsername} wants to message you. Accept to start chatting freely.
          </p>
          <div className="flex flex-shrink-0 gap-1.5">
            <button
              onClick={() => handleAction("accept")}
              disabled={actionBusy}
              className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-3 py-1.5 text-xs font-bold text-emerald-400 transition hover:bg-emerald-500/25 disabled:opacity-50"
            >
              <Check size={13} /> Accept
            </button>
            <button
              onClick={() => handleAction("decline")}
              disabled={actionBusy}
              className="flex items-center gap-1 rounded-full bg-red-500/15 px-3 py-1.5 text-xs font-bold text-red-400 transition hover:bg-red-500/25 disabled:opacity-50"
            >
              <X size={13} /> Decline
            </button>
          </div>
        </div>
      )}

      <div className="mx-auto w-full max-w-4xl flex-1 min-h-0 space-y-1.5 overflow-y-auto px-3 sm:px-4 py-3">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center py-16 text-center">
            <p className="text-sm text-inherit opacity-60">
              This is the start of your conversation with @{displayUsername}.
            </p>
          </div>
        ) : (
          messages.map((m, index) => {
            const mine = m.senderId === user?.userId;
            const previous = messages[index - 1];

const showAvatar =
  !mine &&
  (!previous || previous.senderId !== m.senderId);
            return (
              <div
  key={m.messageId}
  className={`flex items-end gap-2 ${
    mine ? "justify-end" : "justify-start"
  }`}
>
  {!mine &&
    (showAvatar ? (
      <img
        src={displayAvatar}
        alt={displayUsername}
        className="h-8 w-8 flex-shrink-0 rounded-full object-cover"
      />
    ) : (
      <div className="w-8 flex-shrink-0" />
    ))}

  <div className={`flex max-w-[75%] sm:max-w-[65%] items-end gap-1.5 ${mine ? "flex-row-reverse" : ""}`}>
    <div
      className={`rounded-2xl px-3 py-1.5 text-[15px] sm:text-sm leading-[1.3] ${
        m.deletedForEveryone
          ? "border border-dashed border-white/15 light:border-black/15 text-slate-500 light:text-slate-600 italic"
          : mine
          ? theme.bubbleMine
          : theme.bubbleOther
      }`}
    >
      {!m.deletedForEveryone && m.audioUrl ? (
        <VoiceMessageBubble audioUrl={m.audioUrl} mine={mine} />
      ) : !m.deletedForEveryone && m.imageUrl ? (
        <div>
          <button
            type="button"
            onClick={() => setLightboxUrl(m.imageUrl ?? null)}
            className="block overflow-hidden rounded-xl"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- chat photo attachments are compressed base64 data URLs (see app/lib/imageCompress.ts), same as avatars/voice notes — next/image can't optimize a data URL without the `unoptimized` prop. */}
            <img
              src={m.imageUrl}
              alt="Photo attachment"
              className="max-h-64 w-full max-w-[220px] object-cover"
            />
          </button>
          {m.text && <p className="mt-1.5 whitespace-pre-wrap break-words">{m.text}</p>}
        </div>
      ) : (
        <p className="whitespace-pre-wrap break-words">{m.text}</p>
      )}

      <p
        className={`mt-0.5 flex items-center gap-1 text-[10px] ${
          m.deletedForEveryone
            ? "text-slate-500 light:text-slate-600"
            : mine
            ? "text-white/70"
            : "light:text-slate-600 text-slate-500"
        }`}
      >
        {formatTimeAgo(m.createdAt)}
        {mine && !m.deletedForEveryone && (
          <>
            {m.messageId.startsWith("optimistic-") ? (
              // Sent, not yet confirmed persisted by the server.
              <Check size={11} className="text-white/70" />
            ) : otherLastReadAt && m.createdAt <= otherLastReadAt ? (
              // Read — the other participant has polled the thread since
              // this message's timestamp (see the messages GET route).
              <CheckCheck size={12} className="text-sky-300" />
            ) : (
              // Delivered — saved to the server, not yet read.
              <CheckCheck size={12} className="text-white/70" />
            )}
          </>
        )}
      </p>
    </div>

    {!m.messageId.startsWith("optimistic-") && !m.deletedForEveryone && (
      <div className="mb-1 flex flex-shrink-0 items-center gap-2">
        {!mine && (
          <ReportButton
            target={{ targetType: "message", conversationId: m.conversationId, messageId: m.messageId }}
            className="text-slate-500 transition hover:text-red-400"
          />
        )}
        <MessageActionsMenu
          conversationId={m.conversationId}
          messageId={m.messageId}
          mine={mine}
          onDeleted={(mode) => {
            if (mode === "delete_for_everyone") {
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.messageId === m.messageId ? { ...msg, deletedForEveryone: true } : msg
                )
              );
            } else {
              setMessages((prev) => prev.filter((msg) => msg.messageId !== m.messageId));
            }
          }}
        />
      </div>
    )}
  </div>
</div>
            );
          })
        )}
        {otherIsTyping && (
          <div className="flex items-end gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- avatar may be a data URL. */}
            <img src={displayAvatar} alt={displayUsername} className="h-8 w-8 flex-shrink-0 rounded-full object-cover" />
            <div className="flex items-center gap-1 rounded-2xl border border-white/10 light:border-black/10 bg-white/[0.04] light:bg-slate-100 px-4 py-3">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-white/10 light:border-black/10 bg-inherit px-2 sm:px-4 py-2 sm:py-3 z-10">
        {isBlocked ? (
          <p className="rounded-2xl border border-white/10 light:border-black/10 bg-white/[0.02] light:bg-black/[0.02] px-4 py-3 text-center text-xs text-slate-400 light:text-slate-600">
            {conversation?.blocked
              ? "You've blocked this user — unblock them to send a message."
              : "You can't message this user."}
          </p>
        ) : pendingImage ? (
          <div className="mx-auto flex w-full max-w-4xl items-center gap-2.5">
            <div className="relative flex-shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element -- local preview of a not-yet-sent compressed data URL. */}
              <img
                src={pendingImage}
                alt="Attachment preview"
                className="h-12 w-12 rounded-xl border border-white/10 object-cover"
              />
              <button
                onClick={() => setPendingImage(null)}
                title="Remove photo"
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white"
              >
                <X size={12} />
              </button>
            </div>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendImage();
                }
              }}
              placeholder="Add a caption..."
              className="min-w-0 flex-1 rounded-full border border-white/10 light:border-slate-300 bg-white/[0.03] light:bg-white px-4 py-2.5 text-sm text-white light:text-slate-900 placeholder:text-slate-500 caret-orange-500 shadow-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-300/30"
            />
            <button
              onClick={handleSendImage}
              disabled={imageSending}
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] text-white transition hover:-translate-y-0.5 disabled:opacity-50"
            >
              {imageSending ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
            </button>
          </div>
        ) : voiceMode ? (
          <div className="mx-auto flex w-full max-w-4xl items-center gap-2.5">
            <VoiceRecorder onSend={handleSendVoice} onCancel={() => setVoiceMode(false)} />
          </div>
        ) : (
          <div className="mx-auto flex w-full max-w-4xl items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePickImage}
            />

            <div className="relative flex-shrink-0">
              <button
                onClick={() => setEmojiPickerOpen((v) => !v)}
                title="Emoji"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 light:border-black/10 bg-white/5 light:bg-black/5 text-slate-300 light:text-slate-600 transition hover:bg-white/15 light:hover:bg-black/10"
              >
                <Smile size={19} />
              </button>
              {emojiPickerOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setEmojiPickerOpen(false)}
                  />
                  <div className="absolute bottom-full left-0 z-20 mb-2">
                    <EmojiPicker
                      onSelect={(emoji) => {
                        setText((prev) => prev + emoji);
                        pingTyping();
                      }}
                    />
                  </div>
                </>
              )}
            </div>

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={imageProcessing}
              title="Attach a photo"
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-white/10 light:border-black/10 bg-white/5 light:bg-black/5 text-slate-300 light:text-slate-600 transition hover:bg-white/15 light:hover:bg-black/10 disabled:opacity-50"
            >
              {imageProcessing ? <Loader2 size={19} className="animate-spin" /> : <Paperclip size={19} />}
            </button>

            <input
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                if (e.target.value.trim()) pingTyping();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              onFocus={() => setEmojiPickerOpen(false)}
              placeholder="Message..."
              className="min-w-0 flex-1 rounded-full border border-white/10 light:border-slate-300 bg-white/[0.03] light:bg-white px-4 py-2.5 text-sm text-white light:text-slate-900 placeholder:text-slate-500 caret-orange-500 shadow-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-300/30"
            />
            {text.trim() ? (
              <button
                onClick={handleSend}
                disabled={sending}
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] text-white transition hover:-translate-y-0.5 disabled:opacity-50"
              >
                {sending ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
              </button>
            ) : (
              <button
                onClick={() => setVoiceMode(true)}
                title="Record a voice message"
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] text-white transition hover:-translate-y-0.5"
              >
                <Mic size={17} />
              </button>
            )}
          </div>
        )}
        {imageError && <p className="mt-2 text-center text-xs text-red-400">{imageError}</p>}
        {sendError && <p className="mt-2 text-center text-xs text-red-400">{sendError}</p>}
      </div>

      {lightboxUrl && (
        <div
          className="fixed inset-0 z-[999] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            onClick={() => setLightboxUrl(null)}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
          >
            <X size={20} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element -- full-size lightbox preview of a chat photo attachment (base64 data URL). */}
          <img
            src={lightboxUrl}
            alt="Full-size attachment"
            onClick={(e) => e.stopPropagation()}
            className="max-h-full max-w-full rounded-lg object-contain"
          />
        </div>
      )}

      <UserProfileDrawer
        open={profileDrawerOpen}
        onClose={() => setProfileDrawerOpen(false)}
        username={displayUsername}
        avatarUrl={displayAvatar}
        online={otherIsOnline}
        lastActiveAt={otherLastActiveAt}
        conversationId={params.conversationId}
        muted={conversation?.muted}
        blocked={conversation?.blocked}
        disappearingEnabled={conversation?.disappearingEnabled}
        disappearingLabel={
          DISAPPEARING_OPTIONS.find((o) => o.seconds === conversation?.disappearingSeconds)?.label
        }
        onToggleMute={() => handleAction(conversation?.muted ? "unmute" : "mute")}
        onToggleBlock={() => handleAction(conversation?.blocked ? "unblock" : "block")}
        onToggleDisappearing={() => handleAction("toggle_disappearing")}
      />
      </div>
    </div>
  );
}
