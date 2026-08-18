import Link from "next/link";
import Image from "next/image";
import { Baby } from "lucide-react";

// The homepage's dedicated Kids shelf — content a creator explicitly tagged
// as Kids in the upload form's Audience picker (see app/lib/contentAccess.ts).
//
// It's a SEPARATE row rather than a filter of the main feed on purpose:
// Kids videos still appear normally in the ordinary feed for everyone, and
// this row just surfaces them together in one obvious place. It's hidden
// entirely in Kids-only mode, where the whole homepage is already nothing
// but this content and a duplicate row would be noise.

export interface KidsRowItem {
  videoId: string;
  title: string;
  creator: string;
  thumbnail: string;
  views: string;
}

export default function KidsRow({ items }: { items: KidsRowItem[] }) {
  if (items.length === 0) return null;

  return (
    <section className="px-3 py-2 sm:px-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300">
          <Baby size={15} />
        </span>
        <h2 className="text-sm font-black text-white light:text-slate-900 sm:text-base">
          Kids
        </h2>
        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-300">
          Family friendly
        </span>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item) => (
          <Link
            key={item.videoId}
            href={`/watch/${item.videoId}`}
            className="group w-[160px] flex-shrink-0 sm:w-[200px]"
          >
            <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-white/10 bg-black/30 light:border-black/10">
              <Image
                src={item.thumbnail}
                alt={item.title}
                fill
                sizes="200px"
                className="object-cover transition-transform duration-300 group-hover:scale-105"
              />
            </div>
            <p className="mt-1.5 line-clamp-2 text-xs font-bold leading-4 text-white light:text-slate-900">
              {item.title}
            </p>
            <p className="mt-0.5 truncate text-[11px] text-slate-400 light:text-slate-600">
              {item.creator} · {item.views}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
