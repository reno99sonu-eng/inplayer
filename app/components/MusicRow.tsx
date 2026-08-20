import Link from "next/link";
import Image from "next/image";
import { Music2, Play } from "lucide-react";

// The homepage's dedicated Music shelf — audio-only uploads
// (contentType: "music", see app/lib/contentTypes.ts).
//
// Same principle as KidsRow: a SEPARATE row, not a filter of the main feed.
// Music still appears inline in the ordinary feed alongside videos — it is
// longform, so every `contentType !== "short"` filter already includes it —
// and this row just gathers it in one obvious place. Both, deliberately.
//
// Square artwork rather than 16:9. A cover image is mandatory for music
// (Mux can't render a frame from audio), and album art is square
// everywhere people already recognise it, so cropping it into a widescreen
// card would look wrong next to the real thing.

export interface MusicRowItem {
  videoId: string;
  title: string;
  creator: string;
  thumbnail: string;
  views: string;
}

export default function MusicRow({ items }: { items: MusicRowItem[] }) {
  if (items.length === 0) return null;

  return (
    <section className="px-3 py-2 sm:px-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-500/15 text-violet-300">
          <Music2 size={15} />
        </span>
        <h2 className="text-sm font-black text-white light:text-slate-900 sm:text-base">
          Music
        </h2>
        <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-300">
          Listen now
        </span>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item) => (
          <Link
            key={item.videoId}
            href={`/watch/${item.videoId}`}
            className="group w-[132px] flex-shrink-0 sm:w-[156px]"
          >
            <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-white/10 bg-black/30 light:border-black/10">
              <Image
                src={item.thumbnail}
                alt={item.title}
                fill
                sizes="156px"
                className="object-cover transition-transform duration-300 group-hover:scale-105"
              />
              {/* Play affordance — a square card with no timeline badge
                  reads as a photo otherwise. */}
              <span className="absolute inset-0 flex items-center justify-center bg-black/25 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-slate-900 shadow-lg">
                  <Play size={18} className="ml-0.5 fill-current" />
                </span>
              </span>
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
