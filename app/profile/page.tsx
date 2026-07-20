"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ArrowLeft, Crown, Camera, Loader2 } from "lucide-react";
import { fetchAuthSession, updateUserAttributes } from "aws-amplify/auth";
import { useAuthModal } from "@/app/components/auth/AuthProvider";
import { compressImage } from "@/app/lib/imageCompress";

export default function ProfilePage() {
  const router = useRouter();
  const { signedIn, authLoading, user, openSignIn, refreshUser } = useAuthModal();

  // A name/avatar change only lives on the user's own profile until this
  // runs — every video, short, and comment they've already posted keeps a
  // denormalized snapshot of their name/avatar (so feeds don't need an
  // extra lookup per item), and that snapshot only gets refreshed here.
  const syncProfileEverywhere = async () => {
    try {
      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken?.toString();

      await fetch("/api/profile/sync", {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}` },
      });
    } catch (err) {
      console.error("Failed to sync profile to existing content:", err);
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(user?.name || "");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }

    setError(null);
    setUploadingAvatar(true);

    try {
      const compressed = await compressImage(file);

      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken?.toString();

      const res = await fetch("/api/profile/avatar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ avatarUrl: compressed }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Couldn't upload your photo. Please try again.");
        return;
      }

      // Refresh the shared auth state so the new avatar shows up
      // everywhere immediately — navbar, comments, everywhere.
      await refreshUser();

      // Also push it onto everything already posted (videos, shorts,
      // comments) — otherwise old posts keep showing the old photo.
      await syncProfileEverywhere();
    } catch (err) {
      console.error("Avatar upload failed:", err);
      setError("Something went wrong uploading your photo.");
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSaveName = async () => {
    if (!name.trim()) {
      setError("Name can't be empty.");
      return;
    }

    setSavingName(true);
    setError(null);

    try {
      await updateUserAttributes({
        userAttributes: { name: name.trim() },
      });

      // Server-side routes read the name from the ID token's claims, not
      // a live Cognito lookup — force a refresh so the token actually
      // carries the new name before we ask the server to sync it out.
      await fetchAuthSession({ forceRefresh: true });

      await refreshUser();
      await syncProfileEverywhere();

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error("Failed to update name:", err);
      setError("Couldn't save your name. Please try again.");
    } finally {
      setSavingName(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#06101D] light:bg-white">
        <Loader2 size={28} className="animate-spin text-orange-400" />
      </div>
    );
  }

  if (!signedIn) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#06101D] light:bg-white px-6 text-center text-white light:text-slate-900">
        <h2 className="text-2xl font-black">Sign in to view your profile</h2>
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
    <div className="min-h-screen bg-[#06101D] light:bg-white text-white light:text-slate-900">
      <div className="flex items-center gap-4 border-b border-white/10 light:border-black/10 px-5 py-5">
        <button
          onClick={() => router.back()}
          className="
            flex
            h-10
            w-10
            items-center
            justify-center
            rounded-full
            border
            border-white/10
            light:border-black/10
            bg-white/5
            light:bg-black/5
            transition-all
            duration-200
            hover:bg-white/15
            light:hover:bg-black/10
          "
        >
          <ArrowLeft size={20} />
        </button>

        <h1 className="text-lg font-black">My Profile</h1>
      </div>

      <div className="mx-auto max-w-2xl px-5 py-8">
        <div className="flex flex-col items-center">
          <div className="relative">
            <div className="relative h-24 w-24 overflow-hidden rounded-full ring-4 ring-orange-400/40">
              <img
                src={user?.avatarUrl || "/avatars/avatar.png"}
                alt="Profile"
                className="h-full w-full object-cover"
              />

              {uploadingAvatar && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                  <Loader2 size={22} className="animate-spin text-white" />
                </div>
              )}
            </div>

            <button
              onClick={handleAvatarClick}
              disabled={uploadingAvatar}
              className="
                absolute
                bottom-0
                right-0
                flex
                h-8
                w-8
                items-center
                justify-center
                rounded-full
                border
                border-white/10
                bg-[#0B1524]
                light:bg-white
                light:border-black/10
                text-orange-300
                light:text-orange-600
                transition
                hover:bg-orange-500/20
                disabled:opacity-60
              "
            >
              <Camera size={14} />
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>

          <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 px-3 py-1 text-[10px] font-semibold text-white">
            <Crown size={12} />
            Premium Member
          </div>
        </div>

        <div className="mt-8 space-y-5">
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-[0.2em] text-orange-300/80 light:text-orange-600/90">
              Display Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="
                w-full
                rounded-2xl
                border
                border-white/10
                light:border-black/10
                bg-white/[0.03]
                light:bg-black/[0.02]
                px-4
                py-3
                text-white
                light:text-slate-900
                caret-orange-400
                outline-none
                transition
                focus:border-orange-400/50
              "
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-[0.2em] text-orange-300/80 light:text-orange-600/90">
              Email
            </label>
            <p className="rounded-2xl border border-white/10 light:border-black/10 bg-white/[0.02] light:bg-black/[0.02] px-4 py-3 text-slate-400 light:text-slate-500">
              {user?.email}
            </p>
          </div>

          {error && (
            <p className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300 light:text-red-700">
              {error}
            </p>
          )}

          <button
            onClick={handleSaveName}
            disabled={savingName}
            className="
              w-full
              rounded-2xl
              bg-gradient-to-r
              from-orange-500
              to-amber-400
              py-3.5
              font-bold
              text-white
              transition
              hover:scale-[1.01]
              disabled:opacity-60
            "
          >
            {savingName ? "Saving..." : saved ? "Saved ✓" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
