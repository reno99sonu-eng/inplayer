"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Heart, ShoppingCart, Package } from "lucide-react";
import { useAuthModal } from "@/app/components/auth/AuthProvider";
import { authedFetch } from "@/app/lib/apiFetch";

// Small, shared "My Orders / Wishlist / Cart" icon row for the Hammart
// customer-facing pages — real counts, not decorative badges: fetched
// from the same cart/wishlist endpoints those pages themselves use.
// Renders nothing when signed out (nothing to show yet).
export default function ShopNavLinks() {
  const { signedIn } = useAuthModal();
  const [cartCount, setCartCount] = useState(0);
  const [wishlistCount, setWishlistCount] = useState(0);

  useEffect(() => {
    const reset = () => {
      setCartCount(0);
      setWishlistCount(0);
    };
    if (!signedIn) {
      reset();
      return;
    }
    const fetchCounts = async () => {
      try {
        const [cartRes, wishlistRes] = await Promise.all([
          authedFetch("/api/hammart/cart"),
          authedFetch("/api/hammart/wishlist"),
        ]);
        const cartData = await cartRes.json().catch(() => ({}));
        const wishlistData = await wishlistRes.json().catch(() => ({}));
        setCartCount((cartData.items || []).length);
        setWishlistCount((wishlistData.items || []).length);
      } catch (err) {
        console.error("Failed to load cart/wishlist counts:", err);
      }
    };

    fetchCounts();

    const handleUpdate = () => fetchCounts();
    window.addEventListener("hammart-cart-updated", handleUpdate);
    return () => window.removeEventListener("hammart-cart-updated", handleUpdate);
  }, [signedIn]);

  if (!signedIn) return null;

  return (
    <div className="flex items-center gap-2">
      <Link
        href="/shop/orders"
        title="My Orders"
        className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 light:border-slate-300 bg-white/5 light:bg-white text-slate-300 light:text-slate-700 light:shadow-sm transition hover:border-orange-400/50 hover:text-orange-300 light:hover:text-orange-600"
      >
        <Package size={16} />
      </Link>
      <Link
        href="/shop/wishlist"
        title="Wishlist"
        className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 light:border-slate-300 bg-white/5 light:bg-white text-slate-300 light:text-slate-700 light:shadow-sm transition hover:border-orange-400/50 hover:text-orange-300 light:hover:text-orange-600"
      >
        <Heart size={16} />
        {wishlistCount > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-orange-500 px-1 text-[9px] font-bold text-white">
            {wishlistCount}
          </span>
        )}
      </Link>
      <Link
        href="/shop/cart"
        title="Cart"
        className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 light:border-slate-300 bg-white/5 light:bg-white text-slate-300 light:text-slate-700 light:shadow-sm transition hover:border-orange-400/50 hover:text-orange-300 light:hover:text-orange-600"
      >
        <ShoppingCart size={16} />
        {cartCount > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-orange-500 px-1 text-[9px] font-bold text-white">
            {cartCount}
          </span>
        )}
      </Link>
    </div>
  );
}
