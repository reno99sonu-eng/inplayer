"use client";

import { useState } from "react";
import MuxPlayer from "@mux/mux-player-react";
import { fetchAuthSession } from "aws-amplify/auth";
import { Radio, Copy, Check, Eye, EyeOff, Loader2, Info } from "lucide-react";
import { useAuthModal } from "@/app/components/auth/AuthProvider";

interface LiveCreds {
  streamKey: string;
  playbackId: string | null;
  rtmpUrl: string;
  isTest?: boolean;
}

function CopyField({
  label,
  value,
  secret = false,
}: {
  label: string;
  value: string;
  secret?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [revealed, setRevealed] = useState(!secret);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — user can still select the text */
    }
  };

  const shown = revealed ? value : "•".repeat(Math.min(value.length, 32));

  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400 light:text-slate-600">
        {label}
      </label>
      <div className="flex items-center gap-2 rounded-2xl border border-white/10 light:border-black/10 bg-[#07111F] light:bg-black/[0.03] px-4 py-3">
        <code className="min-w-0 flex-1 truncate text-sm text-white light:text-slate-900">
          {shown}
        </code>
        {secret && (
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            aria-label={revealed ? "Hide" : "Reveal"}
            className="flex-shrink-0 text-slate-400 transition hover:text-white light:hover:text-slate-900"
          >
            {revealed ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
        <button
          type="button"
          onClick={copy}
          aria-label="Copy"
          className="flex-shrink-0 text-slate-400 transition hover:text-orange-400"
        >
          {copied ? (
            <Check size={16} className="text-emerald-400" />
          ) : (
            <Copy size={16} />
          )}
        </button>
      </div>
    </div>
  );
}

export default function LivePage() {
  const { signedIn, authLoading, openSignIn } = useAuthModal();
  const [creds, setCreds] = useState<LiveCreds | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startLive = async () => {
    setLoading(true);
    setError(null);

    try {
      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken?.toString();

      const res = await fetch("/api/live/create", {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}` },
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Couldn't start a live stream.");
        return;
      }

      setCreds(data);
    } catch (err) {
      console.error("Failed to start live stream:", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 size={28} className="animate-spin text-orange-400" />
      </div>
    );
  }

  if (!signedIn) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
        <h2 className="text-2xl font-black text-white light:text-slate-900">
          Sign in to go live
        </h2>
        <p className="mt-2 max-w-sm text-sm text-slate-400 light:text-slate-600">
          You need an InPlayer account to start a live stream.
        </p>
        <button
          onClick={openSignIn}
          className="mt-6 rounded-2xl bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] px-8 py-3 font-bold text-white shadow-[0_15px_35px_rgba(255,153,0,.3)] transition-all hover:-translate-y-0.5"
        >
          Sign In
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[820px] px-4 py-8 sm:py-12">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-amber-400 text-white">
          <Radio size={22} />
        </span>
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white light:text-slate-900">
            Go Live
          </h1>
          <p className="text-sm text-slate-400 light:text-slate-600">
            Stream to InPlayer from OBS, Streamlabs, or any RTMP encoder.
          </p>
        </div>
      </div>

      {!creds ? (
        <div className="mt-8 rounded-[28px] border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.03] p-8 text-center">
          <p className="mx-auto max-w-md text-sm leading-6 text-slate-300 light:text-slate-700">
            Start a live stream to get your private stream key and RTMP URL.
            Paste them into your streaming software, start broadcasting, and
            your live video appears below and to your viewers.
          </p>
          <button
            onClick={startLive}
            disabled={loading}
            className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] px-8 py-3.5 font-bold text-white shadow-[0_15px_35px_rgba(255,153,0,.3)] transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Starting…
              </>
            ) : (
              <>
                <Radio size={18} />
                Start Live Stream
              </>
            )}
          </button>

          {error && (
            <p className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300 light:text-red-700">
              {error}
            </p>
          )}
        </div>
      ) : (
        <div className="mt-8 space-y-6">
          {creds.isTest && (
            <div className="flex items-start gap-2 rounded-2xl border border-amber-400/30 bg-amber-500/10 p-3 text-xs leading-5 text-amber-200 light:text-amber-800">
              <Info size={15} className="mt-0.5 flex-shrink-0" />
              <span>
                Your Mux account is on the free plan, so this is a{" "}
                <strong>test stream</strong> — watermarked and limited to
                about 5 minutes. Add a payment method to your Mux account to
                unlock full live streaming.
              </span>
            </div>
          )}

          {/* Live preview */}
          <div className="overflow-hidden rounded-3xl border border-white/10 light:border-black/10 bg-black">
            {creds.playbackId ? (
              <MuxPlayer
                streamType="live"
                playbackId={creds.playbackId}
                accentColor="#EA580C"
                style={{ width: "100%", aspectRatio: "16 / 9" }}
              />
            ) : (
              <div className="flex aspect-video items-center justify-center text-sm text-slate-400">
                Preview unavailable
              </div>
            )}
          </div>

          {/* Credentials */}
          <div className="space-y-4 rounded-3xl border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.03] p-5 sm:p-6">
            <CopyField label="Server / RTMP URL" value={creds.rtmpUrl} />
            <CopyField label="Stream Key" value={creds.streamKey} secret />

            <div className="flex items-start gap-2 rounded-2xl border border-orange-400/20 bg-orange-500/10 p-3 text-xs leading-5 text-orange-200 light:text-orange-800">
              <Info size={15} className="mt-0.5 flex-shrink-0" />
              <span>
                In OBS: Settings → Stream → Service &ldquo;Custom&rdquo;, paste
                the Server and Stream Key above, then Start Streaming. It can
                take a few seconds for the live preview to appear here.
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
