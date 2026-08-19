"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Baby, Loader2, ShieldAlert, X } from "lucide-react";

import { useAuthModal } from "@/app/components/auth/AuthProvider";
import { authedFetch } from "@/app/lib/apiFetch";
import {
  DEFAULT_AUDIENCE_MODE,
  PASSKEY_LENGTH,
  modeFromToggles,
  modeRequiresPasskey,
  togglesFromMode,
  type AudienceMode,
} from "@/app/lib/contentAccess";

// The two audience switches, living in the hamburger drawer.
//
// They used to be a card on the Settings page. Reno moved them here because
// this is a "right now, for this person holding the phone" decision — you
// hand a child the device and want Kids mode on before they've finished
// asking, not four taps deep in Settings.
//
// The two switches are two faces of ONE server-side mode (contentAccess.ts),
// never two independent booleans, so "18+ on AND kids only" is not a state
// that can exist:
//
//   18+ ON      → "all"     everything, kids content included
//   18+ OFF     → "family"  everything except 18+   (the default)
//   Kids ON     → "kids"    ONLY videos tagged Kids, nothing else
//   Kids OFF    → "family"
//
// PASSKEY RULE: only turning 18+ ON asks for one, because that is the only
// direction that reveals something previously hidden. Kids — on or off —
// never asks. Both of its directions show strictly less than "all", so a
// code there would protect nothing and just get in the way. See
// modeRequiresPasskey() for the same rule enforced server-side; this
// component asking is a courtesy, the route refusing is the actual lock.
//
// The mode itself lives in an HttpOnly cookie the browser cannot write, so
// nothing here can flip it locally — every change is a request the server
// is free to reject.

export default function ContentAccessMenu() {
  const router = useRouter();
  const { signedIn, openSignIn } = useAuthModal();

  const [mode, setMode] = useState<AudienceMode>(DEFAULT_AUDIENCE_MODE);
  const [hasPasskey, setHasPasskey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Passkey prompt state. `askingFor` doubles as "is the dialog open".
  const [askingFor, setAskingFor] = useState<AudienceMode | null>(null);
  const [needsNewPasskey, setNeedsNewPasskey] = useState(false);
  const [passkey, setPasskey] = useState("");
  const [confirmPasskey, setConfirmPasskey] = useState("");
  const [dialogError, setDialogError] = useState<string | null>(null);

  // Reads the current mode. Re-runs when the session changes: the endpoint
  // answers signed-out too, but only a signed-in read can tell us whether a
  // passkey exists. `cancelled` keeps a slow response from a torn-down
  // drawer writing into a remounted one.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = signedIn
          ? await authedFetch("/api/content-access")
          : await fetch("/api/content-access");
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.ok) {
          setMode(data.mode || DEFAULT_AUDIENCE_MODE);
          setHasPasskey(Boolean(data.hasPasskey));
        }
      } catch {
        // Leave whatever we had; the safe default is already in state.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [signedIn]);

  const closeDialog = () => {
    setAskingFor(null);
    setNeedsNewPasskey(false);
    setPasskey("");
    setConfirmPasskey("");
    setDialogError(null);
  };

  // Push a mode to the server. Returns true if it stuck.
  const applyMode = async (next: AudienceMode, code?: string) => {
    const body: Record<string, unknown> = { action: "set_mode", mode: next };
    if (code) body.passkey = code;

    // Narrowing modes are accepted signed-out, so only reach for the
    // authenticated fetch when there is actually a session to send.
    // NOTE: `fetch` is called through window here rather than aliased into a
    // variable — an unbound reference throws "Illegal invocation".
    const init: RequestInit = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    };
    const res = signedIn
      ? await authedFetch("/api/content-access", init)
      : await fetch("/api/content-access", init);
    const data = await res.json().catch(() => ({}));

    if (res.status === 409 && data?.needsPasskey) {
      // First time unlocking 18+ on this account — create the code first.
      setNeedsNewPasskey(true);
      setAskingFor(next);
      return false;
    }
    if (!res.ok) throw new Error(data?.error || "Couldn't update content settings.");

    setMode(next);
    // Re-runs every server component, so the feeds re-filter immediately
    // instead of on the next hard reload.
    router.refresh();
    return true;
  };

  const requestMode = async (next: AudienceMode) => {
    if (busy || loading) return;
    setError(null);

    if (modeRequiresPasskey(next)) {
      if (!signedIn) {
        openSignIn();
        return;
      }
      setPasskey("");
      setConfirmPasskey("");
      setDialogError(null);
      // Known from the GET, so the dialog opens straight into "create one"
      // instead of bouncing off a 409 after they have already typed a code.
      setNeedsNewPasskey(!hasPasskey);
      setAskingFor(next);
      return;
    }

    setBusy(true);
    try {
      await applyMode(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const submitDialog = async () => {
    if (busy || !askingFor) return;
    setDialogError(null);
    setBusy(true);
    try {
      if (needsNewPasskey) {
        if (passkey !== confirmPasskey) throw new Error("Those two passkeys don't match.");
        const res = await authedFetch("/api/content-access", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "set_passkey", passkey }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || "Couldn't save that passkey.");
        setHasPasskey(true);
      }
      const done = await applyMode(askingFor, passkey);
      if (done) closeDialog();
    } catch (err) {
      setDialogError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const { showAdult, kidsOnly } = togglesFromMode(mode);
  const digitsOnly = (raw: string) => raw.replace(/\D/g, "").slice(0, PASSKEY_LENGTH);
  const canSubmit =
    passkey.length === PASSKEY_LENGTH &&
    (!needsNewPasskey || confirmPasskey.length === PASSKEY_LENGTH);

  return (
    <>
      <div>
        <p className="mb-1 px-3 text-xs font-bold uppercase tracking-[0.25em] text-orange-300/80 light:text-orange-600/90">
          Content
        </p>

        <div className="space-y-0.5">
          <DrawerToggleRow
            icon={<ShieldAlert size={18} />}
            label="18+ content"
            hint={
              loading
                ? "Checking…"
                : showAdult
                  ? "Showing everything, 18+ included"
                  : "18+ hidden · passkey to unlock"
            }
            checked={showAdult}
            disabled={loading || busy}
            onChange={(checked) => void requestMode(modeFromToggles(checked, false))}
          />

          <DrawerToggleRow
            icon={<Baby size={18} />}
            label="Kids only"
            hint={
              loading
                ? "Checking…"
                : kidsOnly
                  ? "Only Kids videos, everywhere"
                  : "Limit InPlayer to Kids videos"
            }
            checked={kidsOnly}
            disabled={loading || busy}
            onChange={(checked) => void requestMode(modeFromToggles(false, checked))}
          />
        </div>

        {error && <p className="mt-1 px-3 text-[11px] text-red-400 light:text-red-600">{error}</p>}
      </div>

      {/* Portalled to <body> on purpose. The drawer is a transformed element
          (translate-x-*), which makes it the containing block for any fixed
          descendant — a modal rendered inside it would be trapped in the
          340px panel instead of covering the screen. */}
      {/* No SSR guard needed: askingFor is null on the server and on the
          first client render, and only a click can set it — so createPortal
          never runs before the document exists. */}
      {askingFor &&
        createPortal(
          <div className="fixed inset-0 z-[600] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#0A1322] p-5 shadow-2xl light:border-black/10 light:bg-white">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-black text-white light:text-slate-900">
                    {needsNewPasskey ? "Create a passkey" : "Enter your passkey"}
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-slate-400 light:text-slate-600">
                    {needsNewPasskey
                      ? "Pick 6 digits. You'll need them any time 18+ content is switched on, on any device."
                      : "Enter your 6-digit passkey to show 18+ content."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeDialog}
                  aria-label="Close"
                  className="rounded-full p-1 text-slate-400 transition hover:bg-white/10 hover:text-white light:hover:bg-black/10 light:hover:text-slate-900"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="mt-4 space-y-2.5">
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
                      void submitDialog();
                    }
                  }}
                  placeholder={needsNewPasskey ? "New passkey" : "Passkey"}
                  className="w-full rounded-xl border border-white/10 bg-[#07111F] px-3 py-2.5 text-center text-lg tracking-[.5em] text-white outline-none focus:border-orange-400/50 light:border-black/10 light:bg-black/[0.03] light:text-slate-900"
                />

                {needsNewPasskey && (
                  <input
                    type="password"
                    inputMode="numeric"
                    autoComplete="off"
                    value={confirmPasskey}
                    onChange={(e) => setConfirmPasskey(digitsOnly(e.target.value))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void submitDialog();
                      }
                    }}
                    placeholder="Confirm passkey"
                    className="w-full rounded-xl border border-white/10 bg-[#07111F] px-3 py-2.5 text-center text-lg tracking-[.5em] text-white outline-none focus:border-orange-400/50 light:border-black/10 light:bg-black/[0.03] light:text-slate-900"
                  />
                )}
              </div>

              {dialogError && (
                <p className="mt-2.5 text-xs text-red-300 light:text-red-600">{dialogError}</p>
              )}

              <button
                type="button"
                onClick={submitDialog}
                disabled={busy || !canSubmit}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] py-2.5 text-sm font-bold text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
              >
                {busy && <Loader2 size={15} className="animate-spin" />}
                {needsNewPasskey ? "Save & switch on" : "Unlock"}
              </button>

              {/* No "forgot your passkey" link needed any more: switching 18+
                  back OFF is itself unlocked, so nobody can get stranded. */}
              <p className="mt-2 text-center text-[11px] leading-4 text-slate-500">
                Switching 18+ back off never needs the passkey.
              </p>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

// A drawer-sized row: same visual language as the Home / Raftaar buttons
// above it (same px-3 py-2, same hover translate), with the switch on the
// right. Both themes are handled explicitly — the drawer is one of the few
// surfaces that renders on the cream light-mode background.
function DrawerToggleRow({
  icon,
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="
        flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left
        text-slate-200 light:text-slate-700
        transition-all duration-300
        hover:bg-white/5 light:hover:bg-black/5
        hover:text-orange-300 light:hover:text-orange-600
        disabled:cursor-not-allowed disabled:opacity-60
      "
    >
      <span className="flex-shrink-0">{icon}</span>

      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold leading-tight">{label}</span>
        <span className="mt-0.5 block truncate text-[11px] font-medium leading-tight text-slate-500 light:text-slate-500">
          {hint}
        </span>
      </span>

      <span
        aria-hidden
        className={`
          relative flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-all duration-300
          ${
            checked
              ? "bg-gradient-to-r from-orange-500 to-amber-400 shadow-[0_0_14px_rgba(249,115,22,.35)]"
              : "bg-white/15 light:bg-black/15"
          }
        `}
      >
        <span
          className={`
            absolute h-4 w-4 rounded-full bg-white shadow-md transition-all duration-300
            ${checked ? "translate-x-6" : "translate-x-1"}
          `}
        />
      </span>
    </button>
  );
}
