"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Heart, IndianRupee, Store, ShoppingBag, ShoppingCart, Check, X } from "lucide-react";
import { useAuthModal } from "@/app/components/auth/AuthProvider";
import { authedFetch } from "@/app/lib/apiFetch";
import ShopNavLinks from "@/app/components/hammart/ShopNavLinks";
import BackButton from "@/app/components/BackButton";
import type { HammartProduct } from "@/app/lib/hammartProducts";

interface WishlistLineItem {
  productId: string;
  addedAt: string;
  product: HammartProduct | null;
  unavailable: boolean;
}

export default function WishlistPage() {
  const { user, authLoading } = useAuthModal();
  const [items, setItems] = useState<WishlistLineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableMissing, setTableMissing] = useState(false);
  const [busyProductId, setBusyProductId] = useState<string | null>(null);
  const [addingProductId, setAddingProductId] = useState<string | null>(null);
  const [addedProductIds, setAddedProductIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const markNotLoading = () => setLoading(false);
    if (!user?.userId) {
      markNotLoading();
      return;
    }
    (async () => {
      try {
        const res = await authedFetch("/api/hammart/wishlist");
        const data = await res.json().catch(() => ({}));
        setItems(data.items || []);
        setTableMissing(Boolean(data.tableMissing));
      } catch (err) {
        console.error("Failed to load wishlist:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.userId]);

  const removeItem = async (productId: string) => {
    setBusyProductId(productId);
    try {
      await authedFetch(`/api/hammart/wishlist/${productId}`, { method: "DELETE" });
      setItems((prev) => prev.filter((it) => it.productId !== productId));
    } catch (err) {
      console.error("Failed to remove wishlist item:", err);
    } finally {
      setBusyProductId(null);
    }
  };

  const addToCart = async (e: React.MouseEvent, productId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setAddingProductId(productId);
    try {
      const res = await authedFetch("/api/hammart/cart", { method: "POST", body: JSON.stringify({ productId, quantity: 1 }) });
      if (res.ok) {
        setAddedProductIds((prev) => new Set(prev).add(productId));
        setTimeout(() => {
          setAddedProductIds((prev) => {
            const next = new Set(prev);
            next.delete(productId);
            return next;
          });
        }, 1800);
      }
    } catch (err) {
      console.error("Failed to add to cart:", err);
    } finally {
      setAddingProductId(null);
    }
  };

  if (authLoading || (loading && user?.userId)) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 size={24} className="animate-spin text-slate-400" />
      </div>
    );
  }

  if (!user) {
    return <div className="mx-auto max-w-md px-6 py-16 text-center text-sm text-slate-400 light:text-slate-600">Sign in to see your wishlist.</div>;
  }

  if (tableMissing) {
    return (
      <div className="mx-auto max-w-md px-6 py-16 text-center text-sm text-slate-400 light:text-slate-600">
        Wishlists aren&apos;t set up yet. Please check back shortly.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 text-white light:text-slate-900">
      <BackButton />
      <div className="flex items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-xl font-black text-white light:text-slate-900">
          <Heart size={20} className="text-orange-400" /> Your Wishlist
        </h1>
        <ShopNavLinks />
      </div>

      {items.length === 0 ? (
        <div className="mt-10 flex flex-col items-center gap-2 text-center text-sm text-slate-500">
          <Heart size={26} className="text-slate-600" />
          Nothing saved yet.
          <Link href="/shop" className="mt-2 text-xs font-bold text-orange-400 underline">
            Browse HamMart
          </Link>
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {items.map((it) =>
            it.unavailable || !it.product ? (
              <div
                key={it.productId}
                className="overflow-hidden rounded-2xl border border-white/10 light:border-slate-300 bg-white/[0.02] light:bg-white opacity-70"
              >
                <div className="flex aspect-[4/3] w-full items-center justify-center bg-black/20 light:bg-slate-100 text-slate-500">
                  <ShoppingBag size={22} />
                </div>
                <div className="p-2.5">
                  <p className="text-xs font-semibold text-slate-500">No longer available</p>
                  <button
                    type="button"
                    onClick={() => removeItem(it.productId)}
                    disabled={busyProductId === it.productId}
                    className="mt-1.5 flex items-center gap-1 text-[10px] font-bold text-red-400 hover:text-red-300 disabled:opacity-50"
                  >
                    <X size={11} /> Remove
                  </button>
                </div>
              </div>
            ) : (
              <Link
                key={it.productId}
                href={`/shop/product/${it.productId}`}
                className="group overflow-hidden rounded-2xl border border-white/10 light:border-slate-300 bg-white/[0.03] light:bg-white transition-all hover:border-orange-400/50 hover:shadow-lg light:hover:shadow-md hover:-translate-y-0.5"
              >
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-black/20 light:bg-slate-100">
                  {it.product.imageUrl || (it.product.imageUrls && it.product.imageUrls.length > 0) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={it.product.imageUrl || (it.product.imageUrls ? it.product.imageUrls[0] : "")}
                      alt={it.product.title}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-slate-500">
                      <ShoppingBag size={22} />
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      removeItem(it.productId);
                    }}
                    disabled={busyProductId === it.productId}
                    title="Remove from wishlist"
                    className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-red-400 shadow-lg transition hover:bg-black/80 disabled:opacity-70"
                  >
                    <Heart size={13} className="fill-red-400" />
                  </button>

                  <button
                    type="button"
                    onClick={(e) => addToCart(e, it.productId)}
                    disabled={addingProductId === it.productId}
                    title="Add to cart"
                    className="absolute bottom-1.5 right-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-orange-500 text-white shadow-lg transition hover:bg-orange-600 disabled:opacity-70"
                  >
                    {addingProductId === it.productId ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : addedProductIds.has(it.productId) ? (
                      <Check size={14} />
                    ) : (
                      <ShoppingCart size={14} />
                    )}
                  </button>
                </div>

                <div className="p-2.5">
                  <p className="truncate text-xs font-bold text-white light:text-slate-900">{it.product.title}</p>
                  <p className="mt-1 flex items-center gap-0.5 text-xs font-black text-orange-400 light:text-orange-600">
                    <IndianRupee size={12} /> {it.product.priceInr.toLocaleString("en-IN")}
                  </p>
                  <p className="mt-1 flex items-center gap-1 truncate text-[10px] font-semibold text-slate-400 light:text-slate-600">
                    <Store size={10} className="flex-shrink-0 text-orange-400" /> {it.product.vendorId}
                  </p>
                </div>
              </Link>
            )
          )}
        </div>
      )}
    </div>
  );
}
