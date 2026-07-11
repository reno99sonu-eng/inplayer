"use client";

import { ReactNode } from "react";

type Item = {
  icon: ReactNode;
  title: string;
  subtitle: string;
  color: string;
};

interface CreatePopupProps {
  open: boolean;
  popupRef: React.RefObject<HTMLDivElement | null>;
  items: Item[];
  mobile?: boolean;
}

export default function CreatePopup({
  open,
  popupRef,
  items,
  mobile = false,
}: CreatePopupProps) {
  return (
    <div
      ref={popupRef}
      className={`
        absolute
        z-50
        ${mobile ? "right-0 top-14 w-[250px]" : "right-0 top-16 w-[320px]"}
        overflow-hidden
        rounded-3xl
        border
        border-orange-400/20
        bg-[#08111F]/95
        backdrop-blur-3xl
        shadow-[0_30px_80px_rgba(0,0,0,.55)]
        transition-all
        duration-300
        ${
          open
            ? "translate-y-0 opacity-100 pointer-events-auto"
            : "-translate-y-4 opacity-0 pointer-events-none"
        }
      `}
    >
      <div className="border-b border-white/10 p-4">
        <h3 className="text-lg font-black text-white">
          Create
        </h3>

        <p className="mt-1 text-sm text-slate-400">
          Start creating on InPlayer
        </p>
      </div>

      <div className={mobile ? "p-2" : "p-3"}>
        {items.map((item) => (
          <button
            key={item.title}
            type="button"
            className={`
                group
                mb-2
                flex
                w-full
                items-center
                gap-4
                rounded-2xl
                border
                border-transparent
                ${mobile ? "p-3" : "p-4"}
                text-left
                transition-all
                duration-300
                hover:border-orange-400/20
                hover:bg-white/5
                hover:translate-x-1
                hover:shadow-[0_0_30px_rgba(249,115,22,.18)]
              `}
          >
            <div
              className={`
                flex
                ${mobile ? "h-10 w-10" : "h-12 w-12"}
                items-center
                justify-center
                rounded-2xl
                bg-gradient-to-br
                ${item.color}
                text-white
                shadow-lg
                transition-all
                duration-300
                group-hover:scale-110
                group-hover:rotate-6
              `}
            >
              {item.icon}
            </div>

            <div>
              <div className="font-semibold text-white">
                {item.title}
              </div>

              <div className="text-xs text-slate-400">
                {item.subtitle}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}