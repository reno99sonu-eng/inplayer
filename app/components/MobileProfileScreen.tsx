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

import Greeting from "./Greeting";

interface MobileProfileScreenProps {
  open: boolean;
  onClose: () => void;
}

export default function MobileProfileScreen({
  open,
  onClose,
}: MobileProfileScreenProps) {
  const router = useRouter();

  const menu = [
    { icon: User, title: "My Profile", href: "/profile" },
    { icon: Heart, title: "Watchlist", href: "/watchlist" },
    { icon: MessageSquare, title: "My Messages", href: "/messages" },
    { icon: Download, title: "Downloads", href: "/downloads" },
    { icon: Settings, title: "Settings", href: "/settings" },
    { icon: HelpCircle, title: "Help & Support", href: "/help" },
  ];

  const handleItemClick = (href: string | null) => {
    if (href) {
      onClose();
      router.push(href);
    }
  };

  return (
    <div
      className={`
        lg:hidden
        fixed
        inset-0
        z-[999]
        bg-[#06101D]
        transition-all
        duration-300
        ${
          open
            ? "opacity-100 translate-y-0 pointer-events-auto"
            : "opacity-0 translate-y-4 pointer-events-none"
        }
      `}
    >
      <div className="flex h-full flex-col overflow-y-auto">
        <div className="flex items-center gap-4 border-b border-white/10 px-5 py-5">
          <button
            onClick={onClose}
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
              text-white
              transition-all
              duration-200
              hover:bg-white/15
            "
          >
            <ArrowLeft size={20} />
          </button>

          <h2 className="text-lg font-black text-white">My Account</h2>
        </div>

        <div className="p-6 text-center">
          <img
            src="/avatars/avatar.png"
            alt="Profile"
            className="mx-auto h-16 w-16 rounded-full ring-2 ring-orange-400/40"
          />

          <div className="mt-3 flex justify-center">
            <Greeting />
          </div>

          <div
            className="
              mt-3
              inline-flex
              items-center
              gap-1.5
              rounded-full
              bg-gradient-to-r
              from-yellow-400
              to-orange-500
              px-3
              py-1
              text-[10px]
              font-semibold
              text-white
            "
          >
            <Crown size={12} />
            Premium
          </div>
        </div>

        <div className="flex-1 border-t border-white/10 p-4">
          {menu.map((item) => {
            const Icon = item.icon;

            return (
              <button
                key={item.title}
                onClick={() => handleItemClick(item.href)}
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
                "
              >
                <Icon size={20} className="text-orange-400" />
                <span className="text-base font-bold text-white">
                  {item.title}
                </span>
              </button>
            );
          })}

          <div className="my-3 border-t border-white/10" />

          <button
            onClick={onClose}
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
    </div>
  );
}
