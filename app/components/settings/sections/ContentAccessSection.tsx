"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Baby, KeyRound, Loader2, Shield, X } from "lucide-react";

import SettingsCard from "../common/SettingsCard";
import SettingsRow from "../common/SettingsRow";
import SettingsToggle from "../common/SettingsToggle";
import { useAuthModal } from "@/app/components/auth/AuthProvider";
import { authedFetch } from "@/app/lib/apiFetch";
import {
  DEFAULT_AUDIENCE_MODE,
  PASSKEY_LENGTH,
  audienceModeLabel,
  modeFromToggles,
  togglesFromMode,
  type AudienceMode,
} from "@/app/lib/contentAccess";

// The real version of what used to be two disabled "Coming soon" rows
// (Restricted Mode / Child Mode) in GeneralSection — they shipped dead
// because hiding mature content needed per-video maturity ratings that
// didn't exist. They do now: see the Audience picker on the upload form and
// the platform-wide filter in app/lib/contentAccess.ts.
//
// Everything here is a thin shell over the server. The mode itself lives in
// an HttpOnly cookie the browser can't write, and every change is
// authorised by a 6-digit passkey hashed against the account — so this
// component can only ever ASK the server to change something, never change
// it locally. That's deliberate: a parental control that a page script (or
// a curious child in devtools) can flip isn't a control.
//
// After any successful change it calls router.refresh(), which re-runs the
// server components that build every feed. That's what makes the switch
// take effect across the whole platform immediately rather than on the next
// hard reload.

type PendingChange =
  | { kind: "mode"; mode: AudienceMode }
  | { kind: "new-passkey" }
  | { kind: "change-passkey" };

export default function ContentAccessSection() {
  const router = useRouter();
  const { signedIn, openSignIn } = useAuthModal();

  const [mode, setMode] = useState<AudienceMode>(DEFAULT_AUDIENCE_MODE);
  const [hasPasskey, setHasPasskey] = useState(false);
  const [loading, setLoading] = useState(true);

  const [pending, setPending] = useState<PendingChange | null>(null);
  const [passkey, setPasskey] = useState("");
  const [confirmPasskey, setConfirmPasskey] = useState("");
  const [currentPasskey, setCurrentPasskey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Remembers which toggle the person was reaching for when they had to
  // stop and create a passkey first, so that click isn't silently lost —
  // the mode is applied automatically once the passkey saves.
  const [nextModeAfterCreate, setNextModeAfterCreate] = useState<AudienceMode | null>(null);

  const refreshState = useCallback(async () => {
    try {
      // Plain fetch, not authedFetch: this endpoint answers for signed-out
      // visitors too (they still have a mode — the safe default).
      const res = signedIn
        ? await authedFetch("/api/content-access")
        : await fetch("/api/content-access");
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setMode(data.mode || DEFAULT_AUDIENCE_MODE);
        setHasPasskey(Boolean(data.hasPasskey));
      }
    } catch (err) {
      console.error("Couldn't load content access settings:", err);
    } finally {
      setLoading(false);
    }
  }, [signedIn]);

  useEffect(() => {
    void refreshState();
  }, [refreshState]);

  const closeDialog = () => {
    setPending(null);
    setPasskey("");
    setConfirmPasskey("");
    setCurrentPasskey("");
    setError(null);
  };

  const requestMode = (next: AudienceMode) => {
    if (!signedIn) {
      openSignIn();
      return;
    }
    setError(null);
    // No passkey on the account yet — creating one IS the first step, and
    // the mode change is applied straight after it succeeds.
    setPending(hasPasskey ? { kind: "mode", mode: next } : { kind: "new-passkey" });
    setPasskey("");
    setConfirmPasskey("");
    setCurrentPasskey("");
    setNextModeAfterCreate(hasPasskey ? null : next);
  };

  const applyMode = async (next: AudienceMode, code: string) => {
    const res = await authedFetch("/api/content-access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set_mode", mode: next, passkey: code }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || "Couldn't update content settings.");
    setMode(next);
    // Re-run every server component so feeds re-filter immediately.
    router.refresh();
  };

  const submit = async () => {
    if (busy || !pending) return;
    setError(null);
    setBusy(true);
    try {
      if (pending.kind === "mode") {
        await applyMode(pending.mode, passkey);
      } else {
        if (passkey !== confirmPasskey) {
          throw new Error("Those two passkeys don't match.");
        }
        const res = await authedFetch("/api/content-access", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "set_passkey",
            passkey,
            ...(pending.kind === "change-passkey" && { currentPasskey }),
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || "Couldn't save that passkey.");
        setHasPasskey(true);

        // Finish the toggle they originally clicked, now that a passkey
        // exists to authorise it.
        if (pending.kind === "new-passkey" && nextModeAfterCreate) {
          await applyMode(nextModeAfterCreate, passkey);
          setNextModeAfterCreate(null);
        }
      }
      closeDialog();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const { showAdult, kidsOnly } = togglesFromMode(mode);

  const digitsOnly = (raw: string) => raw.replace(/\D/g, "").slice(0, PASSKEY_LENGTH);

  const dialogTitle =
    pending?.kind === "mode"
      ? "Enter your passkey"
      : pending?.kind === "change-passkey"
        ? "Change your passkey"
        : "Create a passkey";

  return (
    <SettingsCard
      icon={<Shield size={24} />}
      title="Content access"
      description="Control which content is shown across InPlayer, locked with a 6-digit passkey."
    >
      <div className="space-y-2">
        <SettingsRow
          icon={<Shield size={20} />}
          title="Show 18+ content"
          description={
            loading
              ? "Checking…"
              : showAdult
                ? "18+ videos are visible everywhere on InPlayer."
                : "18+ videos are hidden from every feed, search result and direct link."
          }
          active={showAdult}
        >
          <SettingsToggle
            checked={showAdult}
            disabled={loading || busy}
            onChange={(checked) => requestMode(modeFromToggles(checked, false))}
          />
        </SettingsRow>

        <SettingsRow
          icon={<Baby size={20} />}
          title="Kids content only"
          description={
            loading
              ? "Checking…"
              : kidsOnly
                ? "Only videos a creator marked as Kids can be seen or played."
                : "Turn on to limit InPlayer to Kids content and nothing else."
          }
          active={kidsOnly}
        >
          <SettingsToggle
            checked={kidsOnly}
            disabled={loading || busy}
            onChange={(checked) => requestMode(modeFromToggles(false, checked))}
          />
        </SettingsRow>

        <SettingsRow
          icon={<KeyRound size={20} />}
          title={hasPasskey ? "Change passkey" : "Create passkey"}
          description={
            hasPasskey
              ? "Required to change either setting above."
              : "You'll be asked to set one the first time you change a setting above."
          }
          value={loading ? undefined : audienceModeLabel(mode)}
          onClick={() => {
            if (!signedIn) {
              openSignIn();
              return;
            }
            setNextModeAfterCreate(null);
            setPending(hasPasskey ? { kind: "change-passkey" } : { kind: "new-passkey" });
            setPasskey("");
            setConfirmPasskey("");
            setCurrentPasskey("");
            setError(null);
          }}
        />

        {!signedIn && !loading && (
          <p className="px-5 pb-1 text-xs text-slate-500">
            Sign in to change these — signed-out viewing always hides 18+ content.
          </p>
        )}
      </div>

      {pending && (
        <div className="fixed inset-0 z-[520] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#0A1322] p-5 light:border-black/10 light:bg-white">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-black text-white light:text-slate-900">
                  {dialogTitle}
                </h3>
                <p className="mt-1 text-xs leading-5 text-slate-400 light:text-slate-600">
                  {pending.kind === "mode"
                    ? "Enter your 6-digit passkey to change what content is shown."
                    : "Pick 6 digits. You'll need them any time this setting is changed, on any device."}
                </p>
              </div>
              <button
                type="button"
                onClick={closeDialog}
                aria-label="Close"
                className="rounded-full p-1 text-slate-400 transition hover:bg-white/10 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-4 space-y-2.5">
              {pending.kind === "change-passkey" && (
                <input
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  value={currentPasskey}
                  onChange={(e) => setCurrentPasskey(digitsOnly(e.target.value))}
                  placeholder="Current passkey"
                  className="w-full rounded-xl border border-white/10 bg-[#07111F] px-3 py-2.5 text-center text-lg tracking-[.5em] text-white outline-none focus:border-orange-400/50 light:border-black/10 light:bg-black/[0.03] light:text-slate-900"
                />
              )}

              <input
                type="password"
                inputMode="numeric"
                autoComplete="off"
                autoFocus
                value={passkey}
                onChange={(e) => setPasskey(digitsOnly(e.target.value))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void submit();
                  }
                }}
                placeholder={pending.kind === "mode" ? "Passkey" : "New passkey"}
                className="w-full rounded-xl border border-white/10 bg-[#07111F] px-3 py-2.5 text-center text-lg tracking-[.5em] text-white outline-none focus:border-orange-400/50 light:border-black/10 light:bg-black/[0.03] light:text-slate-900"
              />

              {pending.kind !== "mode" && (
                <input
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  value={confirmPasskey}
                  onChange={(e) => setConfirmPasskey(digitsOnly(e.target.value))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void submit();
                    }
                  }}
                  placeholder="Confirm passkey"
                  className="w-full rounded-xl border border-white/10 bg-[#07111F] px-3 py-2.5 text-center text-lg tracking-[.5em] text-white outline-none focus:border-orange-400/50 light:border-black/10 light:bg-black/[0.03] light:text-slate-900"
                />
              )}
            </div>

            {error && <p className="mt-2.5 text-xs text-red-300">{error}</p>}

            <button
              type="button"
              onClick={submit}
              disabled={busy || passkey.length !== PASSKEY_LENGTH}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] py-2.5 text-sm font-bold text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
            >
              {busy && <Loader2 size={15} className="animate-spin" />}
              {pending.kind === "mode" ? "Unlock" : "Save passkey"}
            </button>
          </div>
        </div>
      )}
    </SettingsCard>
  );
}
