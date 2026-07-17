"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Crown, Camera } from "lucide-react";

export default function ProfilePage() {
  const router = useRouter();

  const [profile, setProfile] = useState({
    displayName: "Ram",
    username: "@ram",
    bio: "",
    country: "India",
  });

  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    localStorage.setItem(
      "inplayer-profile",
      JSON.stringify(profile)
    );

    setSaved(true);

    setTimeout(() => {
      setSaved(false);
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-[#06101D] text-white">
      <div className="flex items-center gap-4 border-b border-white/10 px-5 py-5">
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
            bg-white/5
            transition-all
            duration-200
            hover:bg-white/15
          "
        >
          <ArrowLeft size={20} />
        </button>

        <h1 className="text-lg font-black">My Profile</h1>
      </div>

      <div className="mx-auto max-w-2xl px-5 py-8">
        <div className="flex flex-col items-center">
          <div className="relative">
            <img
              src="/avatars/avatar.png"
              alt="Profile"
              className="h-24 w-24 rounded-full object-cover ring-4 ring-orange-400/40"
            />

            <button
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
                text-orange-300
                transition
                hover:bg-orange-500/20
              "
            >
              <Camera size={14} />
            </button>
          </div>

          <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 px-3 py-1 text-[10px] font-semibold text-white">
            <Crown size={12} />
            Premium Member
          </div>
        </div>

        <div className="mt-8 space-y-5">

          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-[0.2em] text-orange-300/80">
              Display Name
            </label>

            <input
              value={profile.displayName}
              onChange={(e) =>
                setProfile({
                  ...profile,
                  displayName: e.target.value,
                })
              }
              className="
                w-full
                rounded-2xl
                border
                border-white/10
                bg-white/[0.03]
                px-4
                py-3
                text-white
                outline-none
                transition
                focus:border-orange-400/50
              "
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-[0.2em] text-orange-300/80">
              Username
            </label>

            <input
              value={profile.username}
              onChange={(e) =>
                setProfile({
                  ...profile,
                  username: e.target.value,
                })
              }
              className="
                w-full
                rounded-2xl
                border
                border-white/10
                bg-white/[0.03]
                px-4
                py-3
                text-white
                outline-none
                transition
                focus:border-orange-400/50
              "
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-[0.2em] text-orange-300/80">
              Bio
            </label>

            <textarea
              rows={3}
              value={profile.bio}
              onChange={(e) =>
                setProfile({
                  ...profile,
                  bio: e.target.value,
                })
              }
              placeholder="Tell everyone about yourself..."
              className="
                w-full
                resize-none
                rounded-2xl
                border
                border-white/10
                bg-white/[0.03]
                px-4
                py-3
                text-white
                outline-none
                transition
                focus:border-orange-400/50
              "
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-[0.2em] text-orange-300/80">
              Country
            </label>

            <input
              value={profile.country}
              onChange={(e) =>
                setProfile({
                  ...profile,
                  country: e.target.value,
                })
              }
              className="
                w-full
                rounded-2xl
                border
                border-white/10
                bg-white/[0.03]
                px-4
                py-3
                text-white
                outline-none
                transition
                focus:border-orange-400/50
              "
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-[0.2em] text-orange-300/80">
              Member Since
            </label>

            <p className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 text-slate-400">
              January 2025
            </p>
          </div>

          <button
            onClick={handleSave}
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
            "
          >
            {saved ? "Saved ✓" : "Save Changes"}
          </button>

          <p className="text-center text-xs text-slate-500">
            Changes are stored locally on this device for now.
          </p>

        </div>
      </div>
    </div>
  );
}