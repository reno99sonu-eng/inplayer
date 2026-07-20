"use client";

import { useEffect, useState } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import { Trash2 } from "lucide-react";
import { useAuthModal } from "./auth/AuthProvider";
import { formatTimeAgo } from "@/app/lib/formatters";

interface Comment {
  videoId: string;
  commentId: string;
  userId: string;
  userName: string;
  text: string;
  createdAt: string;
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

      setComments((prev) => [data.comment, ...prev]);
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
    <div
      className="
        mt-5 rounded-3xl border border-white/[0.08] light:border-black/[0.08]
        bg-gradient-to-br from-white/[0.05] to-white/[0.01] light:from-black/[0.03] light:to-transparent
        p-4 sm:p-5 backdrop-blur-xl
        shadow-[0_25px_70px_-25px_rgba(0,0,0,.4)]
      "
    >
      <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-white light:text-slate-900">
        <span className="h-4 w-1 rounded-full bg-gradient-to-b from-orange-400 to-amber-300" />
        {comments.length} {comments.length === 1 ? "Comment" : "Comments"}
      </h2>

      <div className="mb-6 flex gap-3">
        <div className="relative flex-shrink-0">
          <div className="absolute -inset-[2px] rounded-full bg-gradient-to-br from-orange-400 via-amber-300 to-orange-500 opacity-70 blur-[2px]" />
          <div className="relative h-9 w-9 overflow-hidden rounded-full ring-2 ring-[#050816] light:ring-white">
            <img
              src="/avatars/avatar.png"
              alt="You"
              className="h-full w-full object-cover"
            />
          </div>
        </div>

        <div className="group relative flex-1">
          <div
            className="
              pointer-events-none absolute -inset-1 rounded-2xl
              bg-gradient-to-r from-orange-500/15 via-amber-400/10 to-orange-500/15
              opacity-0 blur-xl transition-opacity duration-500
              group-focus-within:opacity-100
            "
          />

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={signedIn ? "Add a comment..." : "Sign in to comment"}
            rows={1}
            onFocus={() => {
              if (!signedIn) openSignIn();
            }}
            className="
              relative w-full resize-none rounded-2xl border
              border-white/10 light:border-black/10
              bg-white/[0.03] light:bg-black/[0.02]
              px-3.5 py-2.5 text-sm text-white light:text-slate-900
              outline-none backdrop-blur-xl
              transition-colors duration-300
              placeholder:text-slate-500
              focus:border-orange-400/50
            "
          />

          {error && <p className="mt-1 text-xs text-red-400">{error}</p>}

          {text.trim() && (
            <div className="mt-2 flex justify-end gap-2">
              <button
                onClick={() => {
                  setText("");
                  setError(null);
                }}
                className="rounded-full px-4 py-1.5 text-xs font-semibold text-slate-400 transition-colors duration-300 hover:bg-white/5 light:hover:bg-black/5"
              >
                Cancel
              </button>
              <button
                onClick={handlePost}
                disabled={posting}
                className="
                  flex items-center gap-1.5 rounded-full
                  bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A]
                  px-4 py-1.5 text-xs font-bold text-white
                  shadow-[0_8px_20px_-6px_rgba(255,153,0,.5)]
                  transition-all duration-300
                  hover:-translate-y-0.5 disabled:opacity-60 disabled:hover:translate-y-0
                "
              >
                {posting ? "Posting..." : "Comment"}
              </button>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-2xl bg-white/5 light:bg-black/5"
            />
          ))}
        </div>
      ) : comments.length === 0 ? (
        <p className="text-sm text-slate-500">
          No comments yet. Be the first to say something.
        </p>
      ) : (
        <div className="space-y-1">
          {comments.map((comment) => (
            <div
              key={comment.commentId}
              className="
                group/comment flex gap-3 rounded-2xl p-2
                transition-colors duration-300
                hover:bg-white/[0.03] light:hover:bg-black/[0.02]
              "
            >
              <div className="relative h-9 w-9 flex-shrink-0 overflow-hidden rounded-full border border-white/10 light:border-black/10">
                <img
                  src="/avatars/avatar.png"
                  alt={comment.userName}
                  className="h-full w-full object-cover"
                />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-white light:text-slate-900">
                    {comment.userName}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatTimeAgo(comment.createdAt)}
                  </p>
                </div>

                <p className="mt-0.5 text-sm text-slate-300 light:text-slate-600">
                  {comment.text}
                </p>
              </div>

              {user?.userId === comment.userId && (
                <button
                  onClick={() => handleDelete(comment.commentId)}
                  className="
                    flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full
                    text-slate-500 opacity-0 transition-all duration-300
                    hover:bg-red-500/10 hover:text-red-400
                    group-hover/comment:opacity-100
                  "
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
