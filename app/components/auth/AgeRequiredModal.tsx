"use client";

import { useState } from "react";
import { fetchAuthSession } from "aws-amplify/auth";

export default function AgeRequiredModal({ onComplete }: { onComplete: () => Promise<void> }) {
  const [age, setAge] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const parsedAge = Number(age);
    if (!Number.isInteger(parsedAge) || parsedAge < 13 || parsedAge > 120) {
      setError("Enter an age from 13 to 120 to continue.");
      return;
    }
    setSaving(true); setError(null);
    try {
      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken?.toString();
      const response = await fetch("/api/profile/settings", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` }, body: JSON.stringify({ action: "complete_account", age: parsedAge }) });
      const data = await response.json();
      if (!response.ok) { setError(data.error || "Couldn't save your age."); return; }
      await onComplete();
    } catch { setError("Couldn't save your age. Check your connection and try again."); } finally { setSaving(false); }
  };

  return <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md"><div className="w-full max-w-md rounded-3xl border border-orange-400/20 bg-[#08111F] p-6 shadow-2xl light:bg-[#F5EEDC]"><p className="text-[10px] font-black uppercase tracking-[.25em] text-orange-300 light:text-orange-700">One last detail</p><h2 className="mt-3 text-2xl font-black text-white light:text-slate-900">Confirm your age</h2><p className="mt-2 text-sm leading-6 text-slate-400 light:text-slate-600">InPlayer needs your age to provide an age-appropriate experience. You must be 13 or older.</p><input autoFocus type="number" min="13" max="120" value={age} onChange={(event) => setAge(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void save(); }} placeholder="Your age" className="mt-5 w-full rounded-2xl border border-white/10 bg-white/[.04] px-4 py-3 text-white outline-none focus:border-orange-400/50 light:border-black/10 light:text-slate-900" />{error && <p className="mt-3 text-xs text-red-300 light:text-red-700">{error}</p>}<button type="button" onClick={() => void save()} disabled={saving} className="mt-5 w-full rounded-2xl bg-gradient-to-r from-orange-500 via-amber-400 to-yellow-300 py-3 font-bold text-slate-900 disabled:opacity-60">{saving ? "Saving..." : "Continue"}</button></div></div>;
}
