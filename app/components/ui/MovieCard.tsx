    x`x`"use client";

import Image from "next/image";

type MovieCardProps = {
  image: string;
  title: string;
  subtitle?: string;
};

export default function MovieCard({
  image,
  title,
  subtitle,
}: MovieCardProps) {
  return (
    <div
      className="
        group
        cursor-pointer
        overflow-hidden
        rounded-[24px]
        bg-white
        shadow-lg
        transition-all
        duration-500
        hover:-translate-y-2
        hover:shadow-2xl
      "
    >
      <div className="relative aspect-[2/3] overflow-hidden">

        <Image
          src={image}
          alt={title}
          fill
          className="
            object-cover
            transition-transform
            duration-700
            group-hover:scale-110
          "
        />

        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-80" />

      </div>

      <div className="p-5">

        <h3 className="text-lg font-bold text-slate-900">
          {title}
        </h3>

        {subtitle && (
          <p className="mt-1 text-sm text-slate-500">
            {subtitle}
          </p>
        )}

      </div>

    </div>
  );
}