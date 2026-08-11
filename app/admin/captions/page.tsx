"use client";

import { useState } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import { Loader2, Wand2, CheckCircle2, AlertTriangle, ImageIcon, RefreshCw } from "lucide-react";
import { useAuthModal } from "@/app/components/auth/AuthProvider";

// One-time maintenance screen (admin only — the API behind it checks the
// signed-in account's email). Repairs captions on everything already
// published: strips captions off Shorts entirely and rebuilds the clean
// English / हिन्दी / বাংলা set on videos. Safe to run more than once; it
// skips anything already repaired and simply resumes.
//
// The API self-limits each call to a short time budget and reports how many
// videos remain, so this page just keeps calling until it says `done`.

interface RunTotals {
  shortsFixed: number;
  videosFixed: number;
  errors: string[];
}

export default function AdminCaptionsPage() {
  const { signedIn, authLoading, openSignIn } = useAuthModal();

  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("");
  const [totals, setTotals] = useState<RunTotals | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  // Second, independent maintenance job on this same page — fixes the
  // landscape-shaped auto thumbnails already saved on Shorts uploaded
  // before the portrait-thumbnail fix (see app/lib/muxThumbnail.ts and
  // app/api/admin/backfill-short-thumbnails). Completes in one call (no
  // Groq/Mux API work per item, just a DynamoDB update), so this doesn't
  // need the caption repair's loop-until-done polling.
  const [thumbsRunning, setThumbsRunning] = useState(false);
  const [thumbsResult, setThumbsResult] = useState<{
    processed: number;
    skippedCustomThumbnail: number;
    errors: string[];
  } | null>(null);
  const [thumbsFailed, setThumbsFailed] = useState<string | null>(null);

  // Third, independent maintenance job — rescues uploads stuck at
  // status:"processing" from before middleware.ts exempted /api/webhooks
  // from the India-only geo-check. Mux and Razorpay's own servers aren't in
  // India, so the Mux webhook that flips a video to "ready" was silently
  // getting rewritten to /geo-blocked for some deliveries instead of
  // reaching app/api/webhooks/mux — leaving those uploads invisible on the
  // homepage, /videos, /shorts, and channel pages (all of which require
  // status:"ready") even though the file itself finished processing on
  // Mux's side. New uploads are unaffected now that the middleware gap is
  // closed; this repairs whatever got stuck before that fix shipped.
  const [healRunning, setHealRunning] = useState(false);
  const [healResult, setHealResult] = useState<{
    totalStuck: number;
    healedToReady: number;
    healedToError: number;
    stillProcessing: number;
    errors: string[];
  } | null>(null);
  const [healFailed, setHealFailed] = useState<string | null>(null);

  const runSelfHeal = async () => {
    setHealRunning(true);
    setHealFailed(null);
    setHealResult(null);

    try {
      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken?.toString();
      if (!idToken) {
        setHealFailed("Your session expired — please sign in again.");
        return;
      }

      const res = await fetch("/api/admin/self-heal-videos", {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}` },
      });

      if (res.status === 401) {
        setHealFailed("This account isn't authorized to run this repair.");
        return;
      }
      if (!res.ok) {
        setHealFailed(`The repair call failed (HTTP ${res.status}).`);
        return;
      }

      const data = await res.json();
      setHealResult({
        totalStuck: data?.totalStuck || 0,
        healedToReady: data?.healedToReady || 0,
        healedToError: data?.healedToError || 0,
        stillProcessing: data?.stillProcessing || 0,
        errors: Array.isArray(data?.errors) ? data.errors : [],
      });
    } catch (err) {
      setHealFailed(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setHealRunning(false);
    }
  };

  const runThumbnailFix = async () => {
    setThumbsRunning(true);
    setThumbsFailed(null);
    setThumbsResult(null);

    try {
      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken?.toString();
      if (!idToken) {
        setThumbsFailed("Your session expired — please sign in again.");
        return;
      }

      const res = await fetch("/api/admin/backfill-short-thumbnails", {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}` },
      });

      if (res.status === 401) {
        setThumbsFailed("This account isn't authorized to run this repair.");
        return;
      }
      if (!res.ok) {
        setThumbsFailed(`The repair call failed (HTTP ${res.status}).`);
        return;
      }

      const data = await res.json();
      setThumbsResult({
        processed: data?.processed || 0,
        skippedCustomThumbnail: data?.skippedCustomThumbnail || 0,
        errors: Array.isArray(data?.errors) ? data.errors : [],
      });
    } catch (err) {
      setThumbsFailed(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setThumbsRunning(false);
    }
  };

  const run = async () => {
    setRunning(true);
    setFailed(null);
    setTotals(null);
    setStatus("Starting…");

    const acc: RunTotals = { shortsFixed: 0, videosFixed: 0, errors: [] };

    try {
      // Hard cap on loop iterations so a stuck "remaining" count can never
      // spin forever.
      for (let i = 0; i < 60; i++) {
        const session = await fetchAuthSession();
        const idToken = session.tokens?.idToken?.toString();
        if (!idToken) {
          setFailed("Your session expired — please sign in again.");
          break;
        }

        const res = await fetch("/api/admin/recaption", {
          method: "POST",
          headers: { Authorization: `Bearer ${idToken}` },
        });

        if (res.status === 401) {
          setFailed(
            "This account isn't authorized to run the caption repair."
          );
          break;
        }
        if (!res.ok) {
          setFailed(`The repair call failed (HTTP ${res.status}).`);
          break;
        }

        const data = await res.json();

        acc.shortsFixed += data?.shorts?.processed || 0;
        acc.videosFixed += data?.videos?.processed || 0;
        if (Array.isArray(data?.shorts?.errors))
          acc.errors.push(...data.shorts.errors);
        if (Array.isArray(data?.videos?.errors))
          acc.errors.push(...data.videos.errors);
        setTotals({ ...acc, errors: [...acc.errors] });

        if (data?.done) {
          setStatus("Done.");
          break;
        }

        setStatus(
          `Working… ${acc.videosFixed} videos and ${acc.shortsFixed} shorts repaired so far (${data?.remainingVideos ?? "?"} videos left)`
        );
      }
    } catch (err) {
      setFailed(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setRunning(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 size={28} className="animate-spin text-indigo-400" />
      </div>
    );
  }

  if (!signedIn) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
        <h2 className="text-2xl font-black text-white light:text-slate-900">
          Sign in required
        </h2>
        <p className="mt-2 max-w-sm text-sm text-slate-400 light:text-slate-600">
          Sign in with the admin account to repair captions.
        </p>
        <button
          onClick={openSignIn}
          className="mt-6 rounded-2xl bg-gradient-to-r from-[#6366F1] via-[#8B5CF6] to-[#A855F7] px-8 py-3 font-bold text-white shadow-[0_15px_35px_rgba(139,92,246,.3)] transition-all hover:-translate-y-0.5"
        >
          Sign In
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[640px] px-4 py-10 sm:py-14">
      <h1 className="text-2xl sm:text-3xl font-black text-white light:text-slate-900">
        Repair captions
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-slate-400 light:text-slate-600">
        Applies the fixed caption pipeline to everything already published:
        removes captions from Shorts entirely, and rebuilds clean English, हिन्दी, বাংলা, தமிழ், తెలుగు, मराठी, ગુજરાતી, ಕನ್ನಡ, മലയാളം, ਪੰਜਾਬੀ, and ଓଡ଼ିଆ tracks on videos from each one&apos;s existing transcript. You can run this more than once — it skips anything already done.
      </p>

      <button
        onClick={run}
        disabled={running}
        className="mt-7 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#6366F1] via-[#8B5CF6] to-[#A855F7] py-3.5 font-bold text-white shadow-[0_15px_35px_rgba(139,92,246,.3)] transition-all hover:-translate-y-0.5 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {running ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            Repairing…
          </>
        ) : (
          <>
            <Wand2 size={18} />
            Repair all captions
          </>
        )}
      </button>

      {status && (
        <p className="mt-5 text-sm text-slate-300 light:text-slate-700">
          {status}
        </p>
      )}

      {totals && (
        <div className="mt-4 rounded-2xl border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.02] p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-white light:text-slate-900">
            {!running && !failed && (
              <CheckCircle2 size={16} className="text-emerald-400" />
            )}
            <span>
              {totals.videosFixed} videos and {totals.shortsFixed} shorts
              repaired
            </span>
          </div>

          {!running && (
            <p className="mt-2 text-xs text-slate-400 light:text-slate-600">
              Repaired videos may show no captions for a minute or two while
              the new tracks register — that&apos;s expected, they appear on
              their own.
            </p>
          )}

          {totals.errors.length > 0 && (
            <details className="mt-3">
              <summary className="cursor-pointer text-xs font-semibold text-amber-400">
                {totals.errors.length} item(s) reported an issue
              </summary>
              <ul className="mt-2 space-y-1 text-xs text-slate-400 light:text-slate-600">
                {totals.errors.slice(0, 40).map((e, i) => (
                  <li key={i} className="break-words">
                    {e}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      {failed && (
        <div className="mt-4 flex items-start gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300 light:text-red-700">
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
          <span>{failed}</span>
        </div>
      )}

      <div className="mt-10 border-t border-white/10 light:border-black/10 pt-8">
        <h1 className="text-2xl sm:text-3xl font-black text-white light:text-slate-900">
          Fix Shorts thumbnails
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-400 light:text-slate-600">
          Shorts uploaded before this fix have a stretched-looking, wrong-shaped
          (landscape) auto thumbnail saved on them — this is what caused the
          distorted-looking pictures on the homepage Raftaar Shorts row. This
          regenerates a correctly-shaped, sharp portrait thumbnail for every
          existing Short that doesn&apos;t have its own custom thumbnail. New
          Shorts you upload from now on already get the correct shape
          automatically. Safe to run more than once.
        </p>

        <button
          onClick={runThumbnailFix}
          disabled={thumbsRunning}
          className="mt-7 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFB020] py-3.5 font-bold text-slate-950 shadow-[0_15px_35px_rgba(255,154,0,.3)] transition-all hover:-translate-y-0.5 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {thumbsRunning ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Fixing thumbnails…
            </>
          ) : (
            <>
              <ImageIcon size={18} />
              Fix all Shorts thumbnails
            </>
          )}
        </button>

        {thumbsResult && (
          <div className="mt-4 rounded-2xl border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.02] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-white light:text-slate-900">
              {!thumbsRunning && !thumbsFailed && (
                <CheckCircle2 size={16} className="text-emerald-400" />
              )}
              <span>{thumbsResult.processed} Shorts thumbnails fixed</span>
            </div>
            {thumbsResult.skippedCustomThumbnail > 0 && (
              <p className="mt-2 text-xs text-slate-400 light:text-slate-600">
                {thumbsResult.skippedCustomThumbnail} Short(s) already had their
                own custom thumbnail — left untouched.
              </p>
            )}
            {thumbsResult.errors.length > 0 && (
              <details className="mt-3">
                <summary className="cursor-pointer text-xs font-semibold text-amber-400">
                  {thumbsResult.errors.length} item(s) reported an issue
                </summary>
                <ul className="mt-2 space-y-1 text-xs text-slate-400 light:text-slate-600">
                  {thumbsResult.errors.slice(0, 40).map((e, i) => (
                    <li key={i} className="break-words">
                      {e}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}

        {thumbsFailed && (
          <div className="mt-4 flex items-start gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300 light:text-red-700">
            <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
            <span>{thumbsFailed}</span>
          </div>
        )}
      </div>

      <div className="mt-10 border-t border-white/10 light:border-black/10 pt-8">
        <h1 className="text-2xl sm:text-3xl font-black text-white light:text-slate-900">
          Fix stuck uploads
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-400 light:text-slate-600">
          Some uploads got stuck showing &quot;processing&quot; forever and
          never appeared on the homepage, Videos, Shorts, or channel pages —
          a gap in the India-only access check was silently blocking
          Mux&apos;s (and Razorpay&apos;s) callbacks to InPlayer, which is
          now fixed for new uploads. This checks every video still stuck on
          &quot;processing&quot; directly against Mux and marks it ready if
          the file actually finished. Safe to run more than once.
        </p>

        <button
          onClick={runSelfHeal}
          disabled={healRunning}
          className="mt-7 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#10B981] via-[#14B8A6] to-[#0EA5E9] py-3.5 font-bold text-white shadow-[0_15px_35px_rgba(16,185,129,.3)] transition-all hover:-translate-y-0.5 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {healRunning ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Checking stuck uploads…
            </>
          ) : (
            <>
              <RefreshCw size={18} />
              Fix stuck uploads
            </>
          )}
        </button>

        {healResult && (
          <div className="mt-4 rounded-2xl border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.02] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-white light:text-slate-900">
              {!healRunning && !healFailed && (
                <CheckCircle2 size={16} className="text-emerald-400" />
              )}
              <span>
                {healResult.totalStuck === 0
                  ? "Nothing was stuck — every upload is already up to date."
                  : `${healResult.healedToReady} of ${healResult.totalStuck} stuck upload(s) fixed and now live`}
              </span>
            </div>
            {healResult.healedToError > 0 && (
              <p className="mt-2 text-xs text-slate-400 light:text-slate-600">
                {healResult.healedToError} upload(s) genuinely failed on
                Mux&apos;s side (not the geo-check gap) and were marked as
                errored — those will need to be re-uploaded.
              </p>
            )}
            {healResult.stillProcessing > 0 && (
              <p className="mt-2 text-xs text-slate-400 light:text-slate-600">
                {healResult.stillProcessing} upload(s) are still genuinely
                processing on Mux&apos;s side — check again in a few
                minutes.
              </p>
            )}
            {healResult.errors.length > 0 && (
              <details className="mt-3">
                <summary className="cursor-pointer text-xs font-semibold text-amber-400">
                  {healResult.errors.length} item(s) reported an issue
                </summary>
                <ul className="mt-2 space-y-1 text-xs text-slate-400 light:text-slate-600">
                  {healResult.errors.slice(0, 40).map((e, i) => (
                    <li key={i} className="break-words">
                      {e}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}

        {healFailed && (
          <div className="mt-4 flex items-start gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300 light:text-red-700">
            <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
            <span>{healFailed}</span>
          </div>
        )}
      </div>
    </div>
  );
}
