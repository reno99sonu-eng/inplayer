"use client";

import { useState } from "react";
import { useAuthModal } from "@/app/components/auth/AuthProvider";
import DeleteAccountCard from "@/app/components/settings/sections/DeleteAccountCard";
import { LogIn, Mail, Smartphone, Globe, CheckCircle2 } from "lucide-react";

export default function DeleteAccountClientSection() {
  const { user, authLoading, openSignIn } = useAuthModal();
  const [copied, setCopied] = useState(false);

  const copyEmail = () => {
    navigator.clipboard?.writeText("support@inplayer.in");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mt-8 space-y-6">
      {/* Interactive In-Browser Deletion */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 sm:p-6 light:border-slate-200 light:bg-slate-50">
        <h3 className="flex items-center gap-2 text-base font-bold text-white light:text-slate-900">
          <Globe size={18} className="text-orange-400" /> Method 1: Delete Directly on Web
        </h3>
        <p className="mt-2 text-sm text-slate-300 light:text-slate-700">
          If you are logged into your InPlayer account in this browser, you can immediately initiate self-serve account deletion below.
        </p>

        {authLoading ? (
          <div className="mt-4 flex items-center gap-2 text-sm text-slate-400">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-orange-400 border-t-transparent" />
            Checking sign-in status...
          </div>
        ) : user ? (
          <div className="mt-4">
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-300 light:text-emerald-700">
              Signed in as <strong>{user.email || user.username}</strong> ({user.handle ? `@${user.handle}` : "No handle"})
            </div>
            <DeleteAccountCard />
          </div>
        ) : (
          <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <button
              type="button"
              onClick={openSignIn}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-2.5 text-sm font-bold text-slate-950 transition hover:brightness-105"
            >
              <LogIn size={16} /> Sign In to Delete Account
            </button>
            <span className="text-xs text-slate-400 light:text-slate-600">
              Sign in with your email or Google account to perform instant self-serve deletion.
            </span>
          </div>
        )}
      </div>

      {/* Mobile App Deletion Method */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 sm:p-6 light:border-slate-200 light:bg-slate-50">
        <h3 className="flex items-center gap-2 text-base font-bold text-white light:text-slate-900">
          <Smartphone size={18} className="text-orange-400" /> Method 2: Delete via InPlayer Mobile App (Android / iOS)
        </h3>
        <p className="mt-2 text-sm text-slate-300 light:text-slate-700">
          You can delete your account directly inside the InPlayer Android or iOS mobile application:
        </p>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-slate-300 light:text-slate-700">
          <li>Open the <strong>InPlayer</strong> app and ensure you are logged in.</li>
          <li>Tap your profile avatar or the <strong>Profile</strong> tab in the bottom navigation bar.</li>
          <li>Tap the <strong>Settings (Gear)</strong> icon in the top corner.</li>
          <li>Select <strong>Privacy Settings</strong> (or <strong>Account &amp; Privacy</strong>).</li>
          <li>Scroll to the <strong>Danger Zone</strong> section at the bottom.</li>
          <li>Tap <strong>Delete Account</strong> and confirm in the dialog prompt.</li>
        </ol>
      </div>

      {/* Email / Manual Request */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 sm:p-6 light:border-slate-200 light:bg-slate-50">
        <h3 className="flex items-center gap-2 text-base font-bold text-white light:text-slate-900">
          <Mail size={18} className="text-orange-400" /> Method 3: Request Deletion via Email (Unauthenticated / Lost Access)
        </h3>
        <p className="mt-2 text-sm text-slate-300 light:text-slate-700">
          If you no longer have access to the mobile app or cannot log in through the web portal, you may submit an unauthenticated deletion request via our verified support channel:
        </p>
        <div className="mt-4 rounded-xl border border-white/10 bg-black/30 p-4 light:bg-black/5">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs uppercase font-bold text-slate-400">Recipient Email</span>
              <p className="text-sm font-bold text-orange-400">support@inplayer.in</p>
            </div>
            <button
              type="button"
              onClick={copyEmail}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-300 hover:text-white light:border-slate-300 light:text-slate-700"
            >
              {copied ? <CheckCircle2 size={13} className="text-emerald-400" /> : null}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <div className="mt-3 border-t border-white/5 pt-3 light:border-black/5 text-xs text-slate-300 light:text-slate-600 space-y-1">
            <p><strong>Subject:</strong> Account Deletion Request - [Your Registered Email or Username]</p>
            <p><strong>Required Information:</strong> Send the email from the <strong>exact email address</strong> associated with your InPlayer account. Mention your username / channel handle.</p>
            <p><strong>Identity Verification Protocol:</strong> To protect users against unauthorized or fraudulent erasure of accounts and creator channels, our support team will send a verification challenge to your registered email before final deletion.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
