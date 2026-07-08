"use client";

export default function TopCreators() {
  return (
    <section className="mx-auto mt-28 max-w-[1600px] px-4 md:px-8">

      <div className="mb-12">

        <span className="rounded-full bg-orange-100 px-4 py-2 text-sm font-semibold text-orange-600">
          TOP CREATORS
        </span>

        <h2 className="mt-6 text-4xl font-black text-slate-900 md:text-5xl">
          Meet India's Biggest Creators
        </h2>

        <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
          Watch exclusive videos from top creators,
          stream live events, discover podcasts,
          and explore premium entertainment.
        </p>

      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">

        {[1,2,3,4].map((item)=>(
          <div
            key={item}
            className="
              rounded-[28px]
              bg-white
              p-6
              shadow-lg
              transition-all
              duration-300
              hover:-translate-y-2
              hover:shadow-2xl
            "
          >

            <div className="h-64 rounded-2xl bg-slate-200" />

            <h3 className="mt-5 text-xl font-bold">
              Creator {item}
            </h3>

            <p className="mt-2 text-slate-500">
              Premium Creator
            </p>

          </div>
        ))}

      </div>

    </section>
  );
}