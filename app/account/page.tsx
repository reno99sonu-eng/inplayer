"use client";

import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  User,
  Heart,
  MessageSquare,
  Download,
  Settings,
  HelpCircle,
  LogOut,
  Crown,
} from "lucide-react";

import Greeting from "../components/Greeting";
import { useAuthModal } from "../components/auth/AuthProvider";

export default function AccountPage() {
  const router = useRouter();

  const {
    user,
    signedIn,
    authLoading,
    signOut,
    openSignIn,
  } = useAuthModal();

  if (authLoading) {
    return null;
  }

  const menu = [
    { icon: User, title: "My Profile", href: "/profile" },
    { icon: Heart, title: "Watchlist", href: "/watchlist" },
    { icon: MessageSquare, title: "My Messages", href: "/messages" },
    { icon: Download, title: "Downloads", href: "/downloads" },
    { icon: Settings, title: "Settings", href: "/settings" },
    { icon: HelpCircle, title: "Help & Support", href: "/help" },
  ];

  return (
    <div className="lg:hidden min-h-screen bg-[#06101D] text-white">
      <div className="flex items-center gap-4 border-b border-white/10 px-5 py-5">
        <button
          onClick={() => router.back()}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 transition-all duration-200 hover:bg-white/15"
        >
          <ArrowLeft size={20} />
        </button>

        <h2 className="text-lg font-black text-white">
          My Account
        </h2>
      </div>

      <div className="p-6 text-center">
        <img
          src="/avatars/avatar.png"
          alt="Profile"
          className="mx-auto h-16 w-16 rounded-full ring-2 ring-orange-400/40"
        />

        <div className="mt-3 flex justify-center">
          <Greeting name={user?.name} />
        </div>

        <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 px-3 py-1 text-[10px] font-semibold text-white">
          <Crown size={12} />
          Premium
        </div>
      </div>

      <div className="border-t border-white/10 p-4">
        {menu.map((item) => {
          const Icon = item.icon;

          return (
            <button
              key={item.title}
              onClick={() => router.push(item.href)}
              className="flex w-full items-center gap-4 rounded-2xl px-4 py-3.5 text-left transition-all duration-200 hover:bg-white/5"
            >
              <Icon size={20} className="text-orange-400" />
              <span className="text-base font-bold text-white">
                {item.title}
              </span>
            </button>
          );
        })}

        <div className="my-3 border-t border-white/10" />

        {signedIn ? (
          <button
            onClick={async () => {
              await signOut();
              router.push("/");
            }}
            className="flex w-full items-center gap-4 rounded-2xl px-4 py-3.5 text-left text-red-500 transition-all duration-200 hover:bg-red-500/10"
          >
            <LogOut size={20} />
            Sign Out
          </button>
        ) : (
          <button
            onClick={openSignIn}
            className="flex w-full items-center gap-4 rounded-2xl px-4 py-3.5 text-left text-orange-400 transition-all duration-200 hover:bg-white/5"
          >
            <User size={20} />
            Sign In
          </button>
        )}
      </div>
    </div>
  );
}