"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchAuthSession } from "aws-amplify/auth";
import { Trash2, Crown, BadgeCheck, Smile, Image as ImageIcon, FileImage } from "lucide-react";
import { useAuthModal } from "./auth/AuthProvider";
import { formatTimeAgo } from "@/app/lib/formatters";
import ReportButton from "@/app/components/ReportButton";

interface Comment {
  videoId: string;
  commentId: string;
  userId: string;
  userName: string;
  userUsername?: string; // present only when the commenter has a username set — see app/lib/resolveUsernames
  userAvatarUrl?: string;
  text: string;
  createdAt: string;
  // Real, server-checked: does this commenter have an active paid
  // membership with this video's creator right now? See app/api/comments
  // (GET) and app/lib/memberships.ts.
  isMember?: boolean;
  isVerified?: boolean;
}

interface CommentSectionProps {
  videoId: string;
}

export default function CommentSection({ videoId }: CommentSectionProps) {
  const { signedIn, user, openSignIn } = useAuthModal();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/comments?videoId=${videoId}`);
        const data = await res.json();
        setComments(data.comments || []);
      } catch (err) {
        console.error("Failed to load comments:", err);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [videoId]);

  const handlePost = async () => {
    if (!signedIn) {
      openSignIn();
      return;
    }

    if (!text.trim()) return;

    setPosting(true);
    setError(null);
    setNotice(null);

    try {
      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken?.toString();

      const res = await fetch("/api/comments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ videoId, text: text.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Couldn't post your comment.");
        return;
      }

      // Auto-moderation (app/lib/moderation.ts, via app/api/comments) held
      // this one back — it's real, saved, and in the admin review queue,
      // but not shown to anyone (including its own author) until cleared.
      if (data.flagged) {
        setNotice("Your comment was flagged for review and isn't visible to others yet.");
      } else {
        setComments((prev) => [data.comment, ...prev]);
      }
      setText("");
    } catch (err) {
      console.error("Failed to post comment:", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setPosting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    try {
      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken?.toString();

      const res = await fetch(
        `/api/comments?videoId=${videoId}&commentId=${commentId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${idToken}` },
        }
      );

      if (res.ok) {
        setComments((prev) => prev.filter((c) => c.commentId !== commentId));
      }
    } catch (err) {
      console.error("Failed to delete comment:", err);
    }
  };

  return (
    <div className="mt-6">
      <h2 className="mb-4 text-sm font-bold text-white light:text-slate-900">
        {comments.length} {comments.length === 1 ? "Comment" : "Comments"}
      </h2>

      <div className="mb-6 flex gap-3">
        <div className="relative h-9 w-9 flex-shrink-0 overflow-hidden rounded-full border border-white/10 light:border-black/10">
          <img
            src={user?.avatarUrl || "/avatars/avatar.png"}
            alt="You"
            className="h-full w-full object-cover"
          />
        </div>

        <div className="flex-1">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={signedIn ? "Write a comment..." : "Sign in to comment"}
            rows={1}
            onFocus={() => {
              if (!signedIn) openSignIn();
            }}
            className="w-full resize-none rounded-xl border border-white/10 light:border-black/10 bg-white/5 light:bg-black/5 px-4 py-3 text-sm text-white light:text-slate-900 outline-none focus:border-orange-400/50"
          />

          {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
          {notice && <p className="mt-1 text-xs text-amber-400">{notice}</p>}

          <div className="mt-2 flex items-center justify-between">
            <div className="flex items-center gap-1 text-slate-400 light:text-slate-500">
              <button 
                className="rounded-full p-2 hover:bg-white/10 light:hover:bg-black/10 transition"
                title="Insert an emoji"
                disabled={!signedIn}
              >
                <Smile size={18} />
              </button>
              <button 
                className="rounded-full p-2 hover:bg-white/10 light:hover:bg-black/10 transition"
                title="Attach a photo or video"
                disabled={!signedIn}
              >
                <ImageIcon size={18} />
              </button>
              <button 
                className="rounded-full p-2 hover:bg-white/10 light:hover:bg-black/10 transition"
                title="Post a GIF"
                disabled={!signedIn}
              >
                <FileImage size={18} />
              </button>
            </div>
            
            {text.trim() && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setText("");
                    setError(null);
                  }}
                  className="rounded-full px-4 py-1.5 text-xs font-semibold text-slate-400 hover:bg-white/5 light:hover:bg-black/5"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePost}
                  disabled={posting}
                  className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] px-4 py-1.5 text-xs font-bold text-white disabled:opacity-60 transition hover:shadow-lg hover:shadow-orange-500/20"
                >
                  {posting ? "Posting..." : "Comment"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-xl bg-white/5 light:bg-black/5"
            />
          ))}
        </div>
      ) : comments.length === 0 ? (
        <p className="text-sm text-slate-500">
          No comments yet. Be the first to say something.
        </p>
      ) : (
        <div className="space-y-5">
          {comments.map((comment) => (
            <div key={comment.commentId} className="flex gap-3">
              {comment.userUsername ? (
                <Link
                  href={`/u/${encodeURIComponent(comment.userUsername)}`}
                  className="relative h-9 w-9 flex-shrink-0 overflow-hidden rounded-full border border-white/10 light:border-black/10"
                >
                  <img
                    src={comment.userAvatarUrl || "/avatars/avatar.png"}
                    alt={comment.userName}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover"
                  />
                </Link>
              ) : (
                <div className="relative h-9 w-9 flex-shrink-0 overflow-hidden rounded-full border border-white/10 light:border-black/10">
                  <img
                    src={comment.userAvatarUrl || "/avatars/avatar.png"}
                    alt={comment.userName}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover"
                  />
                </div>
              )}

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {comment.userUsername ? (
                    <Link
                      href={`/u/${encodeURIComponent(comment.userUsername)}`}
                      className="text-sm font-semibold text-white light:text-slate-900 hover:underline"
                    >
                      {comment.userName}
                    </Link>
                  ) : (
                    <p className="text-sm font-semibold text-white light:text-slate-900">
                      {comment.userName}
                    </p>
                  )}
                  {comment.isVerified && (
                    <span title="Verified User" className="text-blue-500">
                      <BadgeCheck size={14} className="fill-blue-500 text-white light:text-slate-100" />
                    </span>
                  )}
                  {comment.isMember && (
                    <span
                      title="Paid member of this channel"
                      aria-label="Paid member of this channel"
                      className="flex items-center gap-0.5 rounded-full border border-amber-400/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-300"
                    >
                      <Crown size={10} /> Member
                    </span>
                  )}
                  <p className="text-xs text-slate-500">
                    {formatTimeAgo(comment.createdAt)}
                  </p>
                </div>

                <p className="mt-0.5 text-sm text-slate-300 light:text-slate-600">
                  {comment.text}
                </p>
              </div>

              <div className="flex flex-shrink-0 items-center gap-3">
                {user?.userId !== comment.userId && (
                  <ReportButton
                    target={{ targetType: "comment", videoId, commentId: comment.commentId }}
                  />
                )}
                {user?.userId === comment.userId && (
                  <button
                    onClick={() => handleDelete(comment.commentId)}
                    className="text-slate-500 transition hover:text-red-400"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
