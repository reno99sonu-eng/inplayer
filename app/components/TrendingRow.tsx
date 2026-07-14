import Image from "next/image";
import { trending } from "../data/trending";

export default function TrendingRow() {
  return (
    <section className="bg-[#050811] py-16">
      <div className="mx-auto max-w-7xl px-8">

        {/* Heading */}
        <div className="mb-8 flex items-center justify-between">
          <h2 className="text-4xl font-bold text-white">
            Trending Now
          </h2>

          <button className="text-orange-400 transition-colors duration-300 hover:text-orange-300">
            View All →
          </button>
        </div>

        {/* Cards */}
        <div className="flex gap-6 overflow-x-auto pb-4">

          {trending.map((item, index) => (

            <div
              key={index}
              className="group relative min-w-[320px] h-[190px] flex-shrink-0 overflow-hidden rounded-3xl cursor-pointer transition-all duration-700 hover:-translate-y-3 hover:scale-[1.03]"
            >

              <Image
                src={item.thumbnail}
                alt={item.title}
                fill
                className="object-cover transition-transform duration-700 group-hover:scale-110"
              />

              {/* Glow */}

              <div className="absolute inset-0 opacity-0 transition-opacity duration-700 group-hover:opacity-100">

                <div className="absolute -left-16 top-1/2 h-52 w-52 -translate-y-1/2 rounded-full bg-orange-500/20 blur-3xl" />

                <div className="absolute -right-16 top-1/3 h-52 w-52 rounded-full bg-cyan-400/20 blur-3xl" />

              </div>

              {/* Gradient */}

              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />

              {/* Badge */}

              <div className="absolute left-4 top-4">

                <span className="rounded-full bg-orange-500 px-3 py-1 text-xs font-semibold text-white">
                Trending
                </span>

              </div>

              {/* Content */}

              <div className="absolute inset-0 flex flex-col justify-end p-6">

                <div className="mb-3 flex gap-2">

                  <span className="rounded-full bg-red-500 px-2 py-1 text-[10px] text-white">
                    NEW
                  </span>

                  <span className="rounded-full bg-cyan-500 px-2 py-1 text-[10px] text-white">
                    4K
                  </span>

                </div>

                <h3 className="text-2xl font-bold text-white">
                  {item.title}
                </h3>

                <p className="mt-1 text-sm text-gray-300">
                  {item.views} • {item.duration}
                </p>

                <div className="mt-5 flex gap-3 opacity-0 transition duration-500 group-hover:opacity-100">

                  <button className="rounded-full bg-white px-5 py-2 font-semibold text-black transition hover:scale-105">
                    ▶ Play
                  </button>

                  <button className="rounded-full border border-white/30 bg-white/10 px-5 py-2 text-white backdrop-blur-md transition hover:bg-white/20">
                    ❤ My List
                  </button>

                </div>

              </div>

            </div>

          ))}

        </div>

      </div>
    </section>
  );
}