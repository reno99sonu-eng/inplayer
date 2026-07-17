"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Search,
  Pin,
  CheckCheck,
} from "lucide-react";

export default function MessagesPage() {
  const router = useRouter();

  const messages = [
    {
      id: "1",
      sender: "InPlayer Support",
      preview: "Welcome to InPlayer Premium!",
      time: "2m",
      avatar: "/avatars/avatar.png",
      unread: true,
      pinned: true,
      online: true,
    },
    {
      id: "2",
      sender: "Pixel Studio",
      preview: "Your collaboration request has been accepted.",
      time: "1h",
      avatar: "/avatars/avatar.png",
      unread: false,
      pinned: false,
      online: true,
    },
    {
      id: "3",
      sender: "Nature Vision",
      preview: "New documentary uploaded today.",
      time: "Yesterday",
      avatar: "/avatars/avatar.png",
      unread: false,
      pinned: false,
      online: false,
    },
  ];

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
            transition
            hover:bg-white/15
          "
        >
          <ArrowLeft size={20} />
        </button>

        <div>
          <h1 className="text-lg font-black">
            Messages
          </h1>

          <p className="text-sm text-slate-400">
            {messages.length} conversations
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-5 py-6">

        <div className="relative mb-6">
          <Search
            size={18}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
          />

          <input
            placeholder="Search conversations..."
            className="
              w-full
              rounded-2xl
              border
              border-white/10
              bg-white/[0.03]
              py-3
              pl-11
              pr-4
              outline-none
              transition
              focus:border-orange-400/40
            "
          />
        </div>

        <div className="space-y-3">
          {messages.map((m) => (
            <button
              key={m.id}
              className="
                flex
                w-full
                items-center
                gap-4
                rounded-3xl
                border
                border-white/10
                bg-white/[0.03]
                p-4
                text-left
                transition
                hover:bg-white/[0.05]
              "
            >
              <div className="relative">
                <Image
                  src={m.avatar}
                  alt={m.sender}
                  width={54}
                  height={54}
                  className="rounded-full"
                />

                {m.online && (
                  <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-[#06101D] bg-green-500" />
                )}
              </div>

              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="font-bold">
                    {m.sender}
                  </h2>

                  {m.pinned && (
                    <Pin
                      size={14}
                      className="text-orange-400"
                    />
                  )}
                </div>

                <p className="mt-1 text-sm text-slate-400">
                  {m.preview}
                </p>
              </div>

              <div className="text-right">
                <p className="text-xs text-slate-500">
                  {m.time}
                </p>

                {m.unread ? (
                  <div className="mt-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-bold">
                    1
                  </div>
                ) : (
                  <CheckCheck
                    size={16}
                    className="mt-2 text-slate-500"
                  />
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}