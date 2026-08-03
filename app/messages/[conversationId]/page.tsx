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
  Paperclip,
  Mic,
  Palette,
  FileText,
  Image as ImageIcon,
  Film,
  Download,
  Info,
  Sparkles,
} from "lucide-react";
import { useAuthModal } from "@/app/components/auth/AuthProvider";
import { formatTimeAgo } from "@/app/lib/formatters";
import { otherParticipant } from "@/app/lib/conversationId";
import ReportButton from "@/app/components/ReportButton";
import MessageActionsMenu from "@/app/components/MessageActionsMenu";
import UserProfileDrawer from "@/app/components/chat/UserProfileDrawer";
import VoiceRecorder from "@/app/components/chat/VoiceRecorder";
import VoiceMessageBubble from "@/app/components/chat/VoiceMessageBubble";
import { CHAT_THEMES, type ChatTheme } from "@/app/components/chat/ChatThemes";

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
}

interface MessageItem {
  conversationId: string;
  messageId: string;
  senderId: string;
  text: string;
  createdAt: string;
  deletedForEveryone?: boolean;
}

const DISAPPEARING_OPTIONS = [
  { seconds: 3600, label: "1 hour" },
  { seconds: 86400, label: "1 day" },
  { seconds: 604800, label: "1 week" },
];

function parseMessagePayload(rawText: string) {
  if (rawText.startsWith("[VOICE_NOTE]:")) {
    return { type: "voice", url: rawText.replace("[VOICE_NOTE]:", ""), text: "" };
  }
  if (rawText.startsWith("[ATTACHMENT_IMAGE]:")) {
    return { type: "image", url: rawText.replace("[ATTACHMENT_IMAGE]:", ""), text: "" };
  }
  if (rawText.startsWith("[ATTACHMENT_VIDEO]:")) {
    return { type: "video", url: rawText.replace("[ATTACHMENT_VIDEO]:", ""), text: "" };
  }
  if (rawText.startsWith("[ATTACHMENT_FILE]:")) {
    const parts = rawText.replace("[ATTACHMENT_FILE]:", "").split("|||");
    return { type: "file", url: parts[0], fileName: parts[1] || "Document", text: "" };
  }
  return { type: "text", url: null, text: rawText };
}

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

  // Input states
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  // Attachment & Voice Recording
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState<{
    type: "image" | "video" | "file";
    dataUrl: string;
    name: string;
  } | null>(null);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);

  // Theme & Profile Drawer
  const [selectedThemeId, setSelectedThemeId] = useState<string>("default");
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [showProfileDrawer, setShowProfileDrawer] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastTypingPingRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load wallpaper preference
  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem(`inplayer_chat_theme_${params.conversationId}`);
      if (savedTheme && CHAT_THEMES[savedTheme]) {
        setSelectedThemeId(savedTheme);
      }
    } catch { /* ignore */ }
  }, [params.conversationId]);

  const handleSelectTheme = (themeId: string) => {
    setSelectedThemeId(themeId);
    setShowThemePicker(false);
    setSettingsOpen(false);
    try {
      localStorage.setItem(`inplayer_chat_theme_${params.conversationId}`, themeId);
    } catch { /* ignore */ }
  };

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
        setMessages(data.messages || []);
        setOtherLastReadAt(data.otherLastReadAt || null);
        setOtherIsTyping(!!data.otherIsTyping);
      }
    } catch (err) {
      console.error("Failed to load messages:", err);
    }
  }

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
      setConversationLoaded(true);
      return;
    }
    refetchConversation();
    fetchMessages();

    const interval = setInterval(fetchMessages, 3500);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.conversationId, signedIn]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, otherIsTyping]);

  const handleSend = async (overrideText?: string) => {
    let payloadText = overrideText !== undefined ? overrideText : text.trim();

    if (pendingAttachment) {
      if (pendingAttachment.type === "image") {
        payloadText = `[ATTACHMENT_IMAGE]:${pendingAttachment.dataUrl}`;
      } else if (pendingAttachment.type === "video") {
        payloadText = `[ATTACHMENT_VIDEO]:${pendingAttachment.dataUrl}`;
      } else {
        payloadText = `[ATTACHMENT_FILE]:${pendingAttachment.dataUrl}|||${pendingAttachment.name}`;
      }
    }

    if (!payloadText || sending || !targetUserId || !user) return;

    setSending(true);
    setSendError(null);
    const optimisticId = `optimistic-${Date.now()}`;

    setMessages((prev) => [
      ...prev,
      {
        conversationId: params.conversationId,
        messageId: optimisticId,
        senderId: user.userId,
        text: payloadText,
        createdAt: new Date().toISOString(),
      },
    ]);

    setText("");
    setPendingAttachment(null);
    setShowAttachmentMenu(false);

    try {
      const headers = await authHeaders();
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ otherUserId: targetUserId, text: payloadText }),
      });
      const data = await res.json();

      if (!res.ok) {
        setMessages((prev) => prev.filter((m) => m.messageId !== optimisticId));
        setSendError(data.error || "Couldn't send that message.");
        return;
      }

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
    } finally {
      setSending(false);
    }
  };

  const handleSendVoiceNote = (audioDataUrl: string) => {
    setIsRecordingVoice(false);
    handleSend(`[VOICE_NOTE]:${audioDataUrl}`);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setSendError("Please select a file smaller than 10MB.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      let type: "image" | "video" | "file" = "file";
      if (file.type.startsWith("image/")) type = "image";
      else if (file.type.startsWith("video/")) type = "video";

      setPendingAttachment({ type, dataUrl, name: file.name });
      setShowAttachmentMenu(false);
    };
    reader.readAsDataURL(file);
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

  if (authLoading || !conversationLoaded) {
    return (
      <div className="flex h-[calc(100vh-64px)] items-center justify-center bg-[#060D17]">
        <Loader2 size={28} className="animate-spin text-orange-400" />
      </div>
    );
  }

  if (!signedIn) {
    return (
      <div className="flex h-[calc(100vh-64px)] flex-col items-center justify-center bg-[#060D17] px-6 text-center text-white">
        <h2 className="text-2xl font-black">Sign in to view this conversation</h2>
        <button
          onClick={openSignIn}
          className="mt-6 rounded-2xl bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] px-8 py-3 font-bold text-slate-950 shadow-lg hover:-translate-y-0.5 transition"
        >
          Sign In
        </button>
      </div>
    );
  }

  if (!targetUserId) {
    return (
      <div className="flex h-[calc(100vh-64px)] flex-col items-center justify-center bg-[#060D17] px-6 text-center text-white">
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

  const activeTheme = CHAT_THEMES[selectedThemeId] || CHAT_THEMES.default;

  // Extract shared media files for UserProfileDrawer
  const sharedMediaItems = messages
    .map((m) => {
      const parsed = parseMessagePayload(m.text);
      if (parsed.type !== "text" && parsed.url) {
        return {
          id: m.messageId,
          type: parsed.type as "image" | "video" | "file" | "voice",
          url: parsed.url,
          name: parsed.fileName,
          createdAt: m.createdAt,
        };
      }
      return null;
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  return (
    <div className={`fixed inset-x-0 bottom-0 top-[64px] z-20 flex flex-col overflow-hidden ${activeTheme.containerClass} text-white transition-colors duration-500`}>
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        className="hidden"
        accept="image/*,video/*,.pdf,.doc,.docx,.txt,.zip"
      />

      {/* Top Header Bar */}
      <div className="flex-shrink-0 z-30 flex items-center gap-3 border-b border-white/10 bg-[#060D17]/95 backdrop-blur-md px-4 py-2.5 shadow-md">
        <button
          onClick={() => router.push("/messages")}
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 transition hover:bg-white/15"
        >
          <ArrowLeft size={18} />
        </button>

        {/* User Info Header Button -> Opens Profile Drawer */}
        <button
          onClick={() => setShowProfileDrawer(true)}
          className="flex min-w-0 flex-1 items-center gap-3 text-left transition opacity-90 hover:opacity-100"
        >
          <div className="relative flex-shrink-0">
            <img
              src={displayAvatar}
              alt={displayUsername}
              className="h-10 w-10 rounded-full object-cover border border-white/10 shadow"
            />
            {otherIsOnline && (
              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-[#060D17] bg-emerald-400" />
            )}
          </div>
          <div className="min-w-0">
            <span className="block truncate font-bold text-sm">@{displayUsername}</span>
            <span className="block truncate text-[11px] text-slate-400">
              {otherIsTyping ? (
                <span className="font-semibold text-emerald-400 animate-pulse">typing...</span>
              ) : otherIsOnline ? (
                <span className="text-emerald-400 font-semibold">Online</span>
              ) : otherLastActiveAt ? (
                `Last seen ${formatTimeAgo(otherLastActiveAt)}`
              ) : (
                "Tap to view contact info"
              )}
            </span>
          </div>
        </button>

        {/* Action Controls */}
        <div className="relative flex items-center gap-1.5 flex-shrink-0">
          {/* Wallpaper Theme Quick Button */}
          <button
            onClick={() => setShowThemePicker((v) => !v)}
            title="Change Chat Wallpaper"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 transition hover:bg-white/15 text-orange-400"
          >
            <Palette size={18} />
          </button>

          {/* Settings Dropdown */}
          <button
            onClick={() => setSettingsOpen((v) => !v)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 transition hover:bg-white/15"
          >
            <MoreVertical size={18} />
          </button>

          {/* Settings Dropdown Menu */}
          {settingsOpen && (
            <div className="absolute right-0 top-11 z-40 w-64 overflow-hidden rounded-2xl border border-white/10 bg-[#0B1524] shadow-[0_20px_50px_rgba(0,0,0,.6)] transition-all">
              <button
                onClick={() => {
                  setSettingsOpen(false);
                  setShowProfileDrawer(true);
                }}
                className="flex w-full items-center gap-2.5 px-4 py-3 text-left text-xs font-semibold text-slate-200 transition hover:bg-white/5"
              >
                <Info size={15} className="text-orange-400" />
                Contact Profile Info
              </button>

              <button
                onClick={() => {
                  setSettingsOpen(false);
                  setShowThemePicker(true);
                }}
                className="flex w-full items-center gap-2.5 border-t border-white/10 px-4 py-3 text-left text-xs font-semibold text-slate-200 transition hover:bg-white/5"
              >
                <Palette size={15} className="text-amber-400" />
                Change Chat Wallpaper Theme
              </button>

              <button
                onClick={() => handleAction(conversation?.muted ? "unmute" : "mute")}
                disabled={actionBusy}
                className="flex w-full items-center gap-2.5 border-t border-white/10 px-4 py-3 text-left text-xs font-semibold text-slate-200 transition hover:bg-white/5 disabled:opacity-50"
              >
                {conversation?.muted ? <Bell size={15} /> : <BellOff size={15} />}
                {conversation?.muted ? "Unmute Notifications" : "Mute Notifications"}
              </button>

              <div className="border-t border-white/10 px-4 py-3">
                <p className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-slate-200">
                  <Timer size={15} /> Disappearing Messages
                </p>
                {conversation?.disappearingEnabled ? (
                  <button
                    onClick={() => handleAction("toggle_disappearing")}
                    disabled={actionBusy}
                    className="text-[11px] font-semibold text-orange-400 disabled:opacity-50"
                  >
                    On ({DISAPPEARING_OPTIONS.find((o) => o.seconds === conversation.disappearingSeconds)?.label || "1 day"}) — Turn Off
                  </button>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {DISAPPEARING_OPTIONS.map((opt) => (
                      <button
                        key={opt.seconds}
                        onClick={() => handleAction("toggle_disappearing", { seconds: opt.seconds })}
                        disabled={actionBusy}
                        className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-semibold text-slate-300 transition hover:border-orange-400/40 disabled:opacity-50"
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
                className="flex w-full items-center gap-2.5 border-t border-white/10 px-4 py-3 text-left text-xs font-semibold text-red-400 transition hover:bg-red-500/10 disabled:opacity-50"
              >
                <Ban size={15} />
                {conversation?.blocked ? "Unblock" : "Block"} @{displayUsername}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Wallpaper Theme Picker Modal */}
      {showThemePicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="w-full max-w-sm rounded-3xl border border-white/15 bg-[#0B1626] p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Palette size={18} className="text-orange-400" />
                Select Premium Theme Wallpaper
              </h3>
              <button
                onClick={() => setShowThemePicker(false)}
                className="rounded-full p-1 text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {Object.values(CHAT_THEMES).map((theme) => (
                <button
                  key={theme.id}
                  onClick={() => handleSelectTheme(theme.id)}
                  className={`flex flex-col items-center gap-2 rounded-2xl border p-3 transition ${
                    selectedThemeId === theme.id
                      ? "border-orange-400 bg-orange-500/15 ring-2 ring-orange-400/40"
                      : "border-white/10 bg-white/[0.03] hover:bg-white/10"
                  }`}
                >
                  <div className={`h-12 w-full rounded-xl ${theme.previewBg} border`} />
                  <span className="text-xs font-semibold text-slate-200 text-center">
                    {theme.name}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Message Request Banner */}
      {isPendingIncoming && (
        <div className="flex-shrink-0 flex items-center justify-between gap-3 border-b border-orange-400/20 bg-orange-500/[0.08] px-5 py-2">
          <p className="text-xs text-slate-300">
            @{displayUsername} wants to message you. Accept to start chatting.
          </p>
          <div className="flex flex-shrink-0 gap-1.5">
            <button
              onClick={() => handleAction("accept")}
              disabled={actionBusy}
              className="flex items-center gap-1 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-400 hover:bg-emerald-500/30 transition"
            >
              <Check size={13} /> Accept
            </button>
            <button
              onClick={() => handleAction("decline")}
              disabled={actionBusy}
              className="flex items-center gap-1 rounded-full bg-red-500/20 px-3 py-1 text-xs font-bold text-red-400 hover:bg-red-500/30 transition"
            >
              <X size={13} /> Decline
            </button>
          </div>
        </div>
      )}

      {/* Scrollable Messages Area */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-2.5 max-w-3xl mx-auto w-full">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center py-12 text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-orange-500/10 border border-orange-400/20">
              <img
                src={displayAvatar}
                alt={displayUsername}
                className="h-12 w-12 rounded-full object-cover"
              />
            </div>
            <p className="text-sm font-bold text-slate-200">
              This is the start of your encrypted chat with @{displayUsername}.
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Say hello or send a voice note to start talking!
            </p>
          </div>
        ) : (
          messages.map((m, index) => {
            const mine = m.senderId === user?.userId;
            const previous = messages[index - 1];
            const showAvatar = !mine && (!previous || previous.senderId !== m.senderId);
            const parsed = parseMessagePayload(m.text);

            return (
              <div
                key={m.messageId}
                className={`flex items-end gap-2 transition-all duration-200 ${
                  mine ? "justify-end" : "justify-start"
                }`}
              >
                {!mine &&
                  (showAvatar ? (
                    <button onClick={() => setShowProfileDrawer(true)}>
                      <img
                        src={displayAvatar}
                        alt={displayUsername}
                        className="h-7 w-7 flex-shrink-0 rounded-full object-cover border border-white/10 hover:opacity-80 transition"
                      />
                    </button>
                  ) : (
                    <div className="w-7 flex-shrink-0" />
                  ))}

                <div className={`flex max-w-[82%] sm:max-w-[72%] items-end gap-1.5 ${mine ? "flex-row-reverse" : ""}`}>
                  <div
                    className={`group relative rounded-2xl px-3.5 py-2 text-xs sm:text-sm shadow-md transition-all ${
                      m.deletedForEveryone
                        ? "border border-dashed border-white/15 text-slate-500 italic"
                        : mine
                        ? activeTheme.bubbleMine
                        : activeTheme.bubbleOther
                    }`}
                  >
                    {/* Render Content Payload */}
                    {m.deletedForEveryone ? (
                      <p className="text-xs italic">This message was deleted.</p>
                    ) : parsed.type === "voice" ? (
                      <VoiceMessageBubble audioUrl={parsed.url!} mine={mine} />
                    ) : parsed.type === "image" ? (
                      <div className="space-y-1">
                        <img
                          src={parsed.url!}
                          alt="Attachment"
                          className="max-h-56 w-full rounded-xl object-cover"
                        />
                      </div>
                    ) : parsed.type === "video" ? (
                      <div className="space-y-1">
                        <video
                          src={parsed.url!}
                          controls
                          className="max-h-56 w-full rounded-xl"
                        />
                      </div>
                    ) : parsed.type === "file" ? (
                      <a
                        href={parsed.url!}
                        download={parsed.fileName}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-black/20 p-2 text-xs hover:bg-black/30 transition"
                      >
                        <FileText size={20} className="text-orange-400 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold truncate">{parsed.fileName}</p>
                          <span className="text-[10px] text-slate-400">Download Attachment</span>
                        </div>
                        <Download size={15} className="text-slate-300" />
                      </a>
                    ) : (
                      <p className="whitespace-pre-wrap break-words leading-relaxed">{parsed.text}</p>
                    )}

                    {/* Time & Delivery Status Ticks */}
                    <div className="mt-1 flex items-center justify-end gap-1 text-[10px] opacity-80">
                      <span>{formatTimeAgo(m.createdAt)}</span>
                      {mine && !m.deletedForEveryone && (
                        <span title={otherLastReadAt && m.createdAt <= otherLastReadAt ? "Seen by recipient" : "Delivered"}>
                          {m.messageId.startsWith("optimistic-") ? (
                            <Check size={12} className="text-slate-400" />
                          ) : otherLastReadAt && m.createdAt <= otherLastReadAt ? (
                            <CheckCheck size={13} className="text-sky-400 drop-shadow-[0_0_6px_rgba(56,189,248,0.8)] font-bold" />
                          ) : (
                            <CheckCheck size={13} className="text-slate-300" />
                          )}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions Menu */}
                  {!m.messageId.startsWith("optimistic-") && !m.deletedForEveryone && (
                    <div className="mb-1 flex flex-shrink-0 items-center gap-1">
                      {!mine && (
                        <ReportButton
                          target={{ targetType: "message", conversationId: m.conversationId, messageId: m.messageId }}
                          className="text-slate-500 hover:text-red-400 transition"
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

        {/* Typing Indicator Card */}
        {otherIsTyping && (
          <div className="flex items-end gap-2 animate-fadeIn">
            <img
              src={displayAvatar}
              alt={displayUsername}
              className="h-7 w-7 flex-shrink-0 rounded-full object-cover border border-white/10"
            />
            <div className="flex items-center gap-1.5 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-3.5 py-2 shadow-sm">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-400 [animation-delay:-0.3s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-400 [animation-delay:-0.15s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-400" />
              <span className="ml-1 text-[11px] font-bold text-emerald-400">@{displayUsername} is typing...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Pinned Bottom Interactive Input Bar */}
      <div className="flex-shrink-0 z-30 border-t border-white/10 bg-[#060D17]/95 backdrop-blur-md px-3 py-2.5 shadow-2xl max-w-3xl mx-auto w-full">
        {isBlocked ? (
          <p className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-2.5 text-center text-xs text-slate-400">
            {conversation?.blocked
              ? "You've blocked this user — unblock them to send a message."
              : "You can't message this user."}
          </p>
        ) : isRecordingVoice ? (
          /* Live Voice Recorder Bar */
          <VoiceRecorder
            onSend={handleSendVoiceNote}
            onCancel={() => setIsRecordingVoice(false)}
          />
        ) : (
          <div className="flex flex-col gap-2">
            {/* Attachment Preview Card */}
            {pendingAttachment && (
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-orange-500/30 bg-orange-500/10 p-2 text-xs text-white">
                <div className="flex items-center gap-2 min-w-0">
                  {pendingAttachment.type === "image" ? (
                    <ImageIcon size={16} className="text-orange-400 flex-shrink-0" />
                  ) : pendingAttachment.type === "video" ? (
                    <Film size={16} className="text-orange-400 flex-shrink-0" />
                  ) : (
                    <FileText size={16} className="text-orange-400 flex-shrink-0" />
                  )}
                  <span className="truncate font-semibold">{pendingAttachment.name}</span>
                </div>
                <button
                  onClick={() => setPendingAttachment(null)}
                  className="rounded-full p-1 text-slate-400 hover:text-white"
                >
                  <X size={15} />
                </button>
              </div>
            )}

            <div className="relative flex items-center gap-2">
              {/* Attachment Plus / Paperclip Button */}
              <div className="relative">
                <button
                  onClick={() => setShowAttachmentMenu((v) => !v)}
                  title="Attach Media or Document"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-300 hover:text-white transition hover:scale-105"
                >
                  <Paperclip size={18} />
                </button>

                {/* Attachment Menu Popover */}
                {showAttachmentMenu && (
                  <div className="absolute bottom-11 left-0 z-40 flex flex-col gap-1 w-44 rounded-2xl border border-white/10 bg-[#0B1524] p-2 shadow-2xl animate-fadeIn">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10 transition"
                    >
                      <ImageIcon size={16} className="text-sky-400" />
                      Photos & Videos
                    </button>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10 transition"
                    >
                      <FileText size={16} className="text-amber-400" />
                      Documents
                    </button>
                  </div>
                )}
              </div>

              {/* Text Input Box */}
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
                placeholder="Message..."
                className="min-w-0 flex-1 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs sm:text-sm text-white placeholder:text-slate-500 caret-orange-500 shadow-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-400/30"
              />

              {/* Dynamic Mic vs Send Button */}
              {!text.trim() && !pendingAttachment ? (
                /* Mic Option for Voice Messages */
                <button
                  onClick={() => setIsRecordingVoice(true)}
                  title="Record Voice Note"
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-orange-500 text-white shadow-lg transition hover:scale-105"
                >
                  <Mic size={17} />
                </button>
              ) : (
                /* Send Button */
                <button
                  onClick={() => handleSend()}
                  disabled={sending}
                  title="Send Message"
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] text-slate-950 shadow-lg transition hover:scale-105 disabled:opacity-50"
                >
                  {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                </button>
              )}
            </div>
          </div>
        )}
        {sendError && <p className="mt-1 text-center text-xs text-red-400">{sendError}</p>}
      </div>

      {/* WhatsApp-Style Contact Profile Drawer */}
      <UserProfileDrawer
        open={showProfileDrawer}
        onClose={() => setShowProfileDrawer(false)}
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
        onToggleDisappearing={() => handleAction("toggle_disappearing", { seconds: 86400 })}
        sharedMedia={sharedMediaItems}
      />
    </div>
  );
}
