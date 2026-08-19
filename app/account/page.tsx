"use client";

import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  UserCog,
  User,
  MessageCircle,
  Settings,
  HelpCircle,
  LogOut,
} from "lucide-react";

import { useAuthModal } from "../components/auth/AuthProvider";

export default function AccountPage() {
  const router = useRouter();
  const { signedIn, authLoading, user, openSignIn, signOut } = useAuthModal();

  // Downloads is intentionally not linked here — it's an app-only feature
  // (see app/downloads/page.tsx), not offered on the website.
  const menu = [
    { icon: UserCog, title: "Edit Profile", href: "/profile" },
    { icon: User, title: "Your Channel", href: "/my-videos" },
    { icon: MessageCircle, title: "MilonBook", href: "/messages" },
    { icon: Settings, title: "Settings", href: "/settings" },
    { icon: HelpCircle, title: "Help & Support", href: "/help" },
  ];

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  if (authLoading) {
    return (
      <div className="lg:hidden flex min-h-screen items-center justify-center bg-[#06101D] light:bg-[#FAF5E9]" />
    );
  }

  if (!signedIn) {
    return (
      <div className="lg:hidden min-h-screen bg-[#06101D] light:bg-[#FAF5E9] text-white light:text-slate-900">
        <div className="flex items-center gap-4 border-b border-white/10 light:border-black/10 px-5 py-5">
          <button
            onClick={() => router.back()}
            className="
              flex h-10 w-10 items-center justify-center rounded-full
              border border-white/10 light:border-black/10
              bg-white/5 light:bg-black/5
              transition-all duration-200
              hover:bg-white/15 light:hover:bg-black/10
            "
          >
            <ArrowLeft size={20} />
          </button>

          <h2 className="text-lg font-black">My Account</h2>
        </div>

        <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
          <h3 className="text-xl font-black">Sign in to InPlayer</h3>
          <p className="mt-2 text-sm text-slate-400 light:text-slate-600">
          Access your channel, MilonBook, history, and more.
          </p>
          <button
            onClick={openSignIn}
            className="mt-6 rounded-2xl bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] px-8 py-3 font-bold text-white shadow-[0_15px_35px_rgba(255,153,0,.3)] transition-all hover:-translate-y-0.5"
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="lg:hidden min-h-screen bg-[#06101D] light:bg-[#FAF5E9] text-white light:text-slate-900">
      <div className="flex items-center gap-4 border-b border-white/10 light:border-black/10 px-5 py-5">
        <button
          onClick={() => router.back()}
          className="
            flex h-10 w-10 items-center justify-center rounded-full
            border border-white/10 light:border-black/10
            bg-white/5 light:bg-black/5
            transition-all duration-200
            hover:bg-white/15 light:hover:bg-black/10
          "
        >
          <ArrowLeft size={20} />
        </button>

        <h2 className="text-lg font-black">My Account</h2>
      </div>

      <button
        onClick={() => router.push("/profile")}
        className="w-full p-6 text-center transition-colors duration-200 active:bg-white/5 light:active:bg-black/5"
      >
        <img
          src={user?.avatarUrl || "/avatars/avatar.png"}
          alt="Profile"
          className="mx-auto h-16 w-16 rounded-full object-cover ring-2 ring-orange-400/40"
        />

        <h3 className="mt-3 text-lg font-black">{user?.name}</h3>
      </button>

      <div className="border-t border-white/10 light:border-black/10 p-4">
        {menu.map((item) => {
          const Icon = item.icon;

          return (
            <button
              key={item.title}
              onClick={() => router.push(item.href)}
              className="
                flex
                w-full
                items-center
                gap-4
                rounded-2xl
                px-4
                py-3.5
                text-left
                transition-all
                duration-200
                hover:bg-white/5
                light:hover:bg-black/5
              "
            >
              <Icon size={20} className="text-orange-400" />
              <span className="text-base font-bold text-white light:text-slate-900">
                {item.title}
              </span>
            </button>
          );
        })}

        <div className="my-3 border-t border-white/10 light:border-black/10" />

        <button
          onClick={handleSignOut}
          className="
            flex
            w-full
            items-center
            gap-4
            rounded-2xl
            px-4
            py-3.5
            text-left
            text-red-500
            transition-all
            duration-200
            hover:bg-red-500/10
          "
        >
          <LogOut size={20} />
          Sign Out
        </button>
      </div>
    </div>
  );
}
