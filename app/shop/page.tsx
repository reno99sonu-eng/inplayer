"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Store, IndianRupee, ShoppingBag } from "lucide-react";
import type { HammartProduct } from "@/app/lib/hammartProducts";

// Real Hammart storefront — every listing here is a real, live,
// vendor-published product from app/api/hammart/products (GET), not
// placeholder content. Buying is real too (direct UPI to the vendor) —
// see app/shop/product/[productId]/page.tsx.
export default function ShopPage() {
  const [products, setProducts] = useState<HammartProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableMissing, setTableMissing] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/hammart/products");
        const data = await res.json().catch(() => ({}));
        setProducts(data.products || []);
        setTableMissing(Boolean(data.tableMissing));
      } catch (err) {
        console.error("Failed to load Hammart listings:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="text-center">
        <h1 className="text-3xl font-black text-white light:text-slate-900">HamMart</h1>
        <p className="mt-3 max-w-lg mx-auto text-sm text-slate-400 light:text-slate-600">
          Real products, sold directly by InPlayer creators and vendors — you pay them
          directly over UPI at checkout.
        </p>
        <Link
          href="/shop/vendor"
          className="mt-5 inline-block rounded-2xl border border-orange-400/30 bg-orange-500/10 px-5 py-2.5 text-sm font-bold text-orange-300 light:text-orange-700 transition hover:bg-orange-500/20"
        >
          Want to sell here? Set up your vendor account →
        </Link>
      </div>

      {loading ? (
        <div className="mt-16 flex justify-center">
          <Loader2 size={24} className="animate-spin text-slate-400" />
        </div>
      ) : tableMissing ? (
        <p className="mt-16 text-center text-sm text-slate-500">Hammart isn&apos;t set up yet. Please check back shortly.</p>
      ) : products.length === 0 ? (
        <div className="mt-16 flex flex-col items-center gap-2 text-center">
          <ShoppingBag size={28} className="text-slate-600" />
          <p className="text-sm text-slate-500">No listings yet — be the first to sell here.</p>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((p) => (
            <Link
              key={p.productId}
              href={`/shop/product/${p.productId}`}
              className="group overflow-hidden rounded-2xl border border-white/10 light:border-black/10 bg-white/[0.02] transition hover:border-orange-400/30"
            >
              <div className="aspect-square w-full overflow-hidden bg-white/5">
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.imageUrl} alt={p.title} className="h-full w-full object-cover transition group-hover:scale-105" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-slate-600">
                    <ShoppingBag size={28} />
                  </div>
                )}
              </div>
              <div className="p-3">
                <p className="truncate text-sm font-semibold text-white light:text-slate-900">{p.title}</p>
                <p className="mt-1 flex items-center gap-1 text-sm font-bold text-orange-300 light:text-orange-700">
                  <IndianRupee size={13} /> {p.priceInr.toLocaleString("en-IN")}
                </p>
                <p className="mt-1 flex items-center gap-1 text-[11px] text-slate-500">
                  <Store size={11} /> {p.vendorId}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
