"use client";

import { useRouter } from "next/navigation";
import { ReactNode, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Camera,
  Loader2,
  AtSign,
  Check,
  X,
  Globe,
  Lock,
  UserCheck,
  Link2,
  Plus,
  Image as ImageIcon,
  Trash2,
  Sparkles,
} from "lucide-react";
import { fetchAuthSession, updateUserAttributes } from "aws-amplify/auth";
import { useAuthModal, UsernamePrivacy } from "@/app/components/auth/AuthProvider";
import { compressImage, compressImageToBanner, compressDataUrlToBanner } from "@/app/lib/imageCompress";
import { isValidUsernameFormat } from "@/app/lib/username";

const SOCIAL_PLATFORMS = [
  { key: "instagram", label: "Instagram", placeholder: "instagram.com/yourname" },
  { key: "x", label: "X (Twitter)", placeholder: "x.com/yourname" },
  { key: "facebook", label: "Facebook", placeholder: "facebook.com/yourname" },
] as const;

const PRIVACY_OPTIONS: { value: UsernamePrivacy; label: string; desc: string; icon: ReactNode }[] = [
  { value: "public", label: "Public", desc: "Anyone can view your full profile", icon: <Globe size={15} /> },
  { value: "connections", label: "Connections", desc: "Only people you're mutually In-Family with", icon: <UserCheck size={15} /> },
  { value: "private", label: "Private", desc: "Only you can see your full profile", icon: <Lock size={15} /> },
];

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
  const [age, setAge] = useState(user?.age?.toString() || "");
  const [savingAge, setSavingAge] = useState(false);
  const [ageMessage, setAgeMessage] = useState<string | null>(null);
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

  // ---- Cover photo (channel banner) ----
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [coverError, setCoverError] = useState<string | null>(null);

  const handleCoverClick = () => {
    coverInputRef.current?.click();
  };

  const saveCoverPhoto = async (coverPhotoUrl: string | null) => {
    const session = await fetchAuthSession();
    const idToken = session.tokens?.idToken?.toString();

    const res = await fetch("/api/profile/cover", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ coverPhotoUrl }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Couldn't save your cover photo.");

    await refreshUser();
  };

  const handleCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setCoverError("Please choose an image file.");
      return;
    }

    setCoverError(null);
    setUploadingCover(true);

    try {
      const compressed = await compressImageToBanner(file);
      await saveCoverPhoto(compressed);
    } catch (err) {
      console.error("Cover photo upload failed:", err);
      setCoverError(err instanceof Error ? err.message : "Something went wrong uploading your cover photo.");
    } finally {
      setUploadingCover(false);
      if (coverInputRef.current) coverInputRef.current.value = "";
    }
  };

  const handleRemoveCover = async () => {
    setCoverError(null);
    setUploadingCover(true);
    try {
      await saveCoverPhoto(null);
    } catch (err) {
      console.error("Failed to remove cover photo:", err);
      setCoverError(err instanceof Error ? err.message : "Couldn't remove your cover photo.");
    } finally {
      setUploadingCover(false);
    }
  };

  const [generatingCover, setGeneratingCover] = useState(false);

  const handleGenerateCover = async () => {
    setCoverError(null);
    setGeneratingCover(true);

    try {
      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken?.toString();

      const res = await fetch("/api/profile/cover/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ name: user?.name, handle: user?.handle }),
      });

      const data = await res.json();
      if (!res.ok) {
        setCoverError(data.error || "Couldn't generate a cover photo. Please try again.");
        return;
      }

      // Same crop/compress budget as an uploaded photo — the AI image
      // comes back full-size, so it still needs to fit alongside the
      // avatar on the same DynamoDB item before it's saved.
      const compressed = await compressDataUrlToBanner(data.dataUrl);
      await saveCoverPhoto(compressed);
    } catch (err) {
      console.error("AI cover photo generation failed:", err);
      setCoverError(err instanceof Error ? err.message : "Something went wrong generating your cover photo.");
    } finally {
      setGeneratingCover(false);
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

  const handleSaveAge = async () => {
    setSavingAge(true);
    setAgeMessage(null);
    try {
      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken?.toString();
      const res = await fetch("/api/profile/settings", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` }, body: JSON.stringify({ action: "complete_account", age: Number(age) }) });
      const data = await res.json();
      if (!res.ok) { setAgeMessage(data.error || "Couldn't save your age."); return; }
      await refreshUser();
      setAgeMessage("Age saved.");
    } catch { setAgeMessage("Couldn't save your age."); } finally { setSavingAge(false); }
  };

  // ---- Username (handle) ----
  const [usernameDraft, setUsernameDraft] = useState("");
  const [usernameCheck, setUsernameCheck] = useState<{
    status: "idle" | "checking" | "available" | "unavailable" | "invalid";
    reason?: string;
    suggestions?: string[];
  }>({ status: "idle" });
  const [savingUsername, setSavingUsername] = useState(false);
  const [usernameSaved, setUsernameSaved] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);

  // Seed the draft once the real handle loads (avoids a flash of an empty
  // field before useAuthModal's user object is populated).
  useEffect(() => {
    if (user?.handle) setUsernameDraft(user.handle);
  }, [user?.handle]);

  // Live availability check, debounced — mirrors the "checking as you
  // type, with alternatives if taken" flow the user asked for.
  useEffect(() => {
    const trimmed = usernameDraft.trim();

    if (!trimmed || trimmed === user?.handle) {
      setUsernameCheck({ status: "idle" });
      return;
    }
    if (!isValidUsernameFormat(trimmed)) {
      setUsernameCheck({
        status: "invalid",
        reason: "3-20 characters, starting with a letter — letters, numbers, and underscores only.",
      });
      return;
    }

    let cancelled = false;
    setUsernameCheck({ status: "checking" });

    const timer = setTimeout(async () => {
      try {
        const session = await fetchAuthSession();
        const idToken = session.tokens?.idToken?.toString();
        const res = await fetch(`/api/username/check?username=${encodeURIComponent(trimmed)}`, {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        const data = await res.json();
        if (cancelled) return;
        setUsernameCheck({
          status: data.available ? "available" : "unavailable",
          reason: data.reason,
          suggestions: data.suggestions,
        });
      } catch (err) {
        console.error("Username check failed:", err);
        if (!cancelled) setUsernameCheck({ status: "idle" });
      }
    }, 500);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [usernameDraft, user?.handle]);

  const handleSaveUsername = async () => {
    const trimmed = usernameDraft.trim();
    if (!trimmed || usernameCheck.status !== "available") return;

    setSavingUsername(true);
    setUsernameError(null);

    try {
      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken?.toString();
      const res = await fetch("/api/username", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ username: trimmed }),
      });
      const data = await res.json();

      if (!res.ok) {
        setUsernameError(data.error || "Couldn't save your username.");
        return;
      }

      await refreshUser();
      setUsernameCheck({ status: "idle" });
      setUsernameSaved(true);
      setTimeout(() => setUsernameSaved(false), 2000);
    } catch (err) {
      console.error("Failed to save username:", err);
      setUsernameError("Something went wrong. Please try again.");
    } finally {
      setSavingUsername(false);
    }
  };

  // ---- Privacy ----
  const [savingPrivacy, setSavingPrivacy] = useState(false);

  const handlePrivacyChange = async (value: UsernamePrivacy) => {
    if (value === user?.usernamePrivacy || savingPrivacy) return;

    setSavingPrivacy(true);
    try {
      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken?.toString();
      await fetch("/api/profile/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ action: "update_privacy", usernamePrivacy: value }),
      });
      await refreshUser();
    } catch (err) {
      console.error("Failed to update privacy:", err);
    } finally {
      setSavingPrivacy(false);
    }
  };

  // ---- Social links (two sections: fixed platforms + freeform "other") ----
  const [socialDraft, setSocialDraft] = useState<Record<string, string>>({});
  const [otherLinksDraft, setOtherLinksDraft] = useState<{ label: string; url: string }[]>([]);
  const [savingLinks, setSavingLinks] = useState(false);
  const [linksSaved, setLinksSaved] = useState(false);
  const [linksError, setLinksError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.socialLinks) {
      setSocialDraft(user.socialLinks.social || {});
      setOtherLinksDraft(user.socialLinks.other || []);
    }
  }, [user?.socialLinks]);

  const updateOtherLink = (index: number, field: "label" | "url", value: string) => {
    setOtherLinksDraft((prev) =>
      prev.map((entry, i) => (i === index ? { ...entry, [field]: value } : entry))
    );
  };
  const addOtherLink = () => {
    if (otherLinksDraft.length >= 5) return;
    setOtherLinksDraft((prev) => [...prev, { label: "", url: "" }]);
  };
  const removeOtherLink = (index: number) => {
    setOtherLinksDraft((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveLinks = async () => {
    setSavingLinks(true);
    setLinksError(null);
    try {
      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken?.toString();
      const res = await fetch("/api/profile/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({
          action: "update_social_links",
          social: socialDraft,
          other: otherLinksDraft.filter((l) => l.label.trim() || l.url.trim()),
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setLinksError(data.error || "Couldn't save your links.");
        return;
      }

      await refreshUser();
      setLinksSaved(true);
      setTimeout(() => setLinksSaved(false), 2000);
    } catch (err) {
      console.error("Failed to save links:", err);
      setLinksError("Something went wrong. Please try again.");
    } finally {
      setSavingLinks(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#06101D] light:bg-[#FAF5E9]">
        <Loader2 size={28} className="animate-spin text-orange-400" />
      </div>
    );
  }

  if (!signedIn) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#06101D] light:bg-[#FAF5E9] px-6 text-center text-white light:text-slate-900">
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
    <div className="min-h-screen bg-[#06101D] light:bg-[#FAF5E9] text-white light:text-slate-900">
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
        {/* Cover photo (channel banner) — shown behind your name/avatar on
            your public channel page (app/u/[username]). Falls back to a
            plain gradient there until one is set, same as this preview. */}
        <div>
          <label className="mb-2 block text-xs font-bold uppercase tracking-[0.2em] text-orange-300/80 light:text-orange-600/90">
            Cover Photo
          </label>
          <div className="relative h-32 w-full overflow-hidden rounded-2xl border border-white/10 light:border-black/10 sm:h-40">
            {user?.coverPhotoUrl ? (
              <img
                src={user.coverPhotoUrl}
                alt="Cover"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="h-full w-full bg-[radial-gradient(circle_at_20%_20%,rgba(249,115,22,.35),transparent_32%),radial-gradient(circle_at_80%_5%,rgba(251,191,36,.2),transparent_25%),linear-gradient(120deg,#10182d,#030712)]" />
            )}

            {(uploadingCover || generatingCover) && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60">
                <Loader2 size={22} className="animate-spin text-white" />
                {generatingCover && <p className="text-xs font-semibold text-white">Generating with AI…</p>}
              </div>
            )}

            <div className="absolute bottom-2.5 right-2.5 flex flex-wrap justify-end gap-2">
              {user?.coverPhotoUrl && (
                <button
                  onClick={handleRemoveCover}
                  disabled={uploadingCover || generatingCover}
                  title="Remove cover photo"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/60 text-white backdrop-blur-md transition hover:bg-red-500/70 disabled:opacity-60"
                >
                  <Trash2 size={15} />
                </button>
              )}
              <button
                onClick={handleGenerateCover}
                disabled={uploadingCover || generatingCover}
                className="flex items-center gap-1.5 rounded-full border border-orange-400/30 bg-gradient-to-r from-orange-500/80 to-amber-400/80 px-3.5 py-2 text-xs font-bold text-white backdrop-blur-md transition hover:from-orange-500 hover:to-amber-400 disabled:opacity-60"
              >
                <Sparkles size={14} /> Generate with AI
              </button>
              <button
                onClick={handleCoverClick}
                disabled={uploadingCover || generatingCover}
                className="flex items-center gap-1.5 rounded-full border border-white/15 bg-black/60 px-3.5 py-2 text-xs font-bold text-white backdrop-blur-md transition hover:bg-black/75 disabled:opacity-60"
              >
                <ImageIcon size={14} /> {user?.coverPhotoUrl ? "Change" : "Upload"} cover photo
              </button>
            </div>

            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleCoverChange}
            />
          </div>
          {coverError && (
            <p className="mt-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300 light:text-red-700">
              {coverError}
            </p>
          )}
        </div>

        <div className="mt-8 flex flex-col items-center">
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
                light:bg-[#FAF5E9]
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
            <p className="rounded-2xl border border-white/10 light:border-black/10 bg-white/[0.02] light:bg-black/[0.02] px-4 py-3 text-slate-400 light:text-slate-600">
              {user?.email}
            </p>
          </div>

          <div className="rounded-2xl border border-orange-400/20 bg-orange-500/[0.04] p-4">
            <label className="block text-xs font-bold uppercase tracking-[0.2em] text-orange-300/80 light:text-orange-600/90">Age</label>
            <p className="mt-1 text-xs text-slate-400 light:text-slate-600">Required to keep InPlayer age-appropriate. You must be 13 or older.</p>
            <div className="mt-3 flex gap-2"><input type="number" min="13" max="120" value={age} onChange={(event) => setAge(event.target.value)} placeholder="Your age" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-white outline-none focus:border-orange-400/50 light:border-black/10 light:text-slate-900" /><button type="button" onClick={handleSaveAge} disabled={savingAge} className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">{savingAge ? "Saving..." : "Save age"}</button></div>
            {ageMessage && <p className="mt-2 text-xs text-orange-200 light:text-orange-700">{ageMessage}</p>}
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

        {/* Username */}
        <div className="mt-8 rounded-2xl border border-white/10 light:border-black/10 bg-white/[0.02] light:bg-black/[0.02] p-5">
          <h2 className="flex items-center gap-2 text-sm font-black text-white light:text-slate-900">
            <AtSign size={16} className="text-orange-400" />
            Username
          </h2>
          <p className="mt-1 text-xs text-slate-400 light:text-slate-600">
            Your handle — how people find and message you across InPlayer.
          </p>

          <div className="mt-4">
            <div className="relative">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                @
              </span>
              <input
                value={usernameDraft}
                onChange={(e) => setUsernameDraft(e.target.value.replace(/\s/g, ""))}
                placeholder="yourname"
                className="w-full rounded-2xl border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.02] py-3 pl-8 pr-4 text-white light:text-slate-900 caret-orange-400 outline-none transition focus:border-orange-400/50"
              />
            </div>

            <div className="mt-2 min-h-[18px] text-xs">
              {usernameCheck.status === "checking" && (
                <span className="flex items-center gap-1.5 text-slate-500">
                  <Loader2 size={12} className="animate-spin" /> Checking availability...
                </span>
              )}
              {usernameCheck.status === "available" && (
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <Check size={12} /> @{usernameDraft.trim()} is available
                </span>
              )}
              {(usernameCheck.status === "unavailable" || usernameCheck.status === "invalid") && (
                <div>
                  <span className="flex items-center gap-1.5 text-red-400">
                    <X size={12} /> {usernameCheck.reason || "That username isn't available."}
                  </span>
                  {!!usernameCheck.suggestions?.length && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {usernameCheck.suggestions.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setUsernameDraft(s)}
                          className="rounded-full border border-orange-400/30 bg-orange-500/10 px-2.5 py-1 text-[11px] font-semibold text-orange-300 light:text-orange-700 transition hover:bg-orange-500/20"
                        >
                          @{s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {user?.handle && usernameCheck.status === "idle" && usernameDraft.trim() === user.handle && (
                <span className="text-slate-500">This is your current username.</span>
              )}
            </div>

            {usernameError && (
              <p className="mt-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300 light:text-red-700">
                {usernameError}
              </p>
            )}

            <button
              onClick={handleSaveUsername}
              disabled={savingUsername || usernameCheck.status !== "available"}
              className="mt-3 w-full rounded-2xl bg-gradient-to-r from-orange-500 to-amber-400 py-3 text-sm font-bold text-white transition hover:scale-[1.01] disabled:opacity-40 disabled:hover:scale-100"
            >
              {savingUsername ? "Saving..." : usernameSaved ? "Saved ✓" : "Save Username"}
            </button>
          </div>

          {/* Privacy */}
          <div className="mt-6 border-t border-white/10 light:border-black/10 pt-5">
            <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-slate-400 light:text-slate-600">
              Who can see your full profile
            </h3>
            <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-3">
              {PRIVACY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handlePrivacyChange(opt.value)}
                  disabled={savingPrivacy}
                  className={`flex flex-col items-start gap-1 rounded-2xl border px-3.5 py-3 text-left transition-all disabled:opacity-60 ${
                    (user?.usernamePrivacy || "public") === opt.value
                      ? "border-orange-400/50 bg-orange-500/10 text-orange-300 light:text-orange-700"
                      : "border-white/10 light:border-black/10 text-slate-400 light:text-slate-600 hover:border-white/20 light:hover:border-black/20"
                  }`}
                >
                  <span className="flex items-center gap-1.5 text-sm font-bold">
                    {opt.icon} {opt.label}
                  </span>
                  <span className="text-[11px] font-normal leading-snug opacity-80">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Social links — two dedicated sections: fixed platforms, then
            freeform "other" links. Shown on this user's public channel
            (app/u/[username]) once they've set a username. */}
        <div className="mt-6 rounded-2xl border border-white/10 light:border-black/10 bg-white/[0.02] light:bg-black/[0.02] p-5">
          <h2 className="flex items-center gap-2 text-sm font-black text-white light:text-slate-900">
            <Link2 size={16} className="text-orange-400" />
            Links
          </h2>
          <p className="mt-1 text-xs text-slate-400 light:text-slate-600">
            Shown on your public channel when someone opens your profile.
          </p>

          <div className="mt-4">
            <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-slate-400 light:text-slate-600">
              Social media
            </h3>
            <div className="mt-2.5 space-y-2.5">
              {SOCIAL_PLATFORMS.map((platform) => (
                <div key={platform.key} className="flex items-center gap-2.5">
                  <span className="w-[84px] flex-shrink-0 text-xs font-semibold text-slate-400 light:text-slate-600">
                    {platform.label}
                  </span>
                  <input
                    value={socialDraft[platform.key] || ""}
                    onChange={(e) =>
                      setSocialDraft((prev) => ({ ...prev, [platform.key]: e.target.value }))
                    }
                    placeholder={platform.placeholder}
                    className="min-w-0 flex-1 rounded-xl border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.02] px-3.5 py-2.5 text-sm text-white light:text-slate-900 caret-orange-400 outline-none transition focus:border-orange-400/50"
                  />
                </div>
              ))}
            </div>
          </div>

          {linksError && (
            <p className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300 light:text-red-700">
              {linksError}
            </p>
          )}

          <button
            onClick={handleSaveLinks}
            disabled={savingLinks}
            className="mt-4 w-full rounded-2xl border border-orange-400/30 bg-orange-500/10 py-3 text-sm font-bold text-orange-300 light:text-orange-700 transition hover:bg-orange-500/20 disabled:opacity-60"
          >
            {savingLinks ? "Saving..." : linksSaved ? "Saved ✓" : "Save Links"}
          </button>
        </div>
      </div>
    </div>
  );
}
