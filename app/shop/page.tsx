"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { Loader2, Store, IndianRupee, ShoppingBag, Users, Check, LayoutGrid } from "lucide-react";
import type { HammartProduct } from "@/app/lib/hammartProducts";

interface VendorItem {
  vendorId: string;
  vendorUserId: string;
  name: string;
  avatarUrl: string;
  productCount: number;
}

export default function ShopPage() {
  const [products, setProducts] = useState<HammartProduct[]>([]);
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);
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

  // Extract unique sellers/vendors from the products list for the left slim sidebar
  const vendorsList = useMemo(() => {
    const map = new Map<string, VendorItem>();

    products.forEach((p) => {
      const vId = p.vendorId || p.vendorUserId || "seller";
      const existing = map.get(vId);
      if (existing) {
        existing.productCount += 1;
      } else {
        map.set(vId, {
          vendorId: vId,
          vendorUserId: p.vendorUserId,
          name: vId,
          avatarUrl: `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(vId)}`,
          productCount: 1,
        });
      }
    });

    return Array.from(map.values());
  }, [products]);

  // Filter products by selected seller
  const filteredProducts = useMemo(() => {
    if (!selectedVendorId) return products;
    return products.filter((p) => p.vendorId === selectedVendorId || p.vendorUserId === selectedVendorId);
  }, [products, selectedVendorId]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 text-white">
      {/* Header Banner */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-black text-white light:text-slate-900 flex items-center justify-center gap-2">
          <Store className="text-orange-400" size={28} /> HamMart
        </h1>
        <p className="mt-2 max-w-lg mx-auto text-sm text-slate-400 light:text-slate-600">
          Buy directly from verified InPlayer creators and sellers with instant UPI checkout.
        </p>
        <Link
          href="/shop/vendor"
          className="mt-4 inline-block rounded-2xl border border-orange-400/30 bg-orange-500/10 px-5 py-2 text-xs font-bold text-orange-300 light:text-orange-700 transition hover:bg-orange-500/20"
        >
          Become a Seller / Open Storefront →
        </Link>
      </div>

      {loading ? (
        <div className="mt-16 flex justify-center">
          <Loader2 size={24} className="animate-spin text-slate-400" />
        </div>
      ) : tableMissing ? (
        <p className="mt-16 text-center text-sm text-slate-500">Hammart isn&apos;t set up yet. Please check back shortly.</p>
      ) : (
        <div className="flex flex-col md:flex-row gap-6">
          {/* Left Slim Vendor Sidebar Navbar */}
          <div className="w-full md:w-64 flex-shrink-0">
            <div className="sticky top-20 rounded-3xl border border-white/10 bg-white/[0.02] p-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Users size={14} className="text-orange-400" /> Sellers & Vendors
                </span>
                <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-bold text-slate-400">
                  {vendorsList.length}
                </span>
              </div>

              {/* All Sellers Reset Button */}
              <button
                onClick={() => setSelectedVendorId(null)}
                className={`w-full flex items-center justify-between rounded-xl px-3 py-2.5 text-xs font-bold transition mb-2 ${
                  selectedVendorId === null
                    ? "border border-orange-400/50 bg-orange-500/15 text-orange-300"
                    : "border border-transparent text-slate-300 hover:bg-white/5"
                }`}
              >
                <span className="flex items-center gap-2">
                  <LayoutGrid size={15} /> All Products
                </span>
                <span className="text-[10px] font-bold opacity-75">{products.length}</span>
              </button>

              {/* Sellers List */}
              <div className="space-y-1 max-h-[60vh] overflow-y-auto pr-1">
                {vendorsList.map((vendor) => (
                  <button
                    key={vendor.vendorId}
                    onClick={() => setSelectedVendorId(vendor.vendorId)}
                    className={`w-full flex items-center justify-between rounded-xl px-3 py-2.5 text-xs transition ${
                      selectedVendorId === vendor.vendorId
                        ? "border border-orange-400/50 bg-orange-500/20 text-orange-300 font-bold shadow-md"
                        : "border border-transparent text-slate-300 hover:bg-white/5"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={vendor.avatarUrl}
                        alt={vendor.name}
                        className="h-6 w-6 flex-shrink-0 rounded-full border border-white/20 bg-white/10"
                      />
                      <span className="truncate">{vendor.name}</span>
                    </div>
                    <span className="rounded-md bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-400 font-bold">
                      {vendor.productCount}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Main Products Display Area (Right Screen) */}
          <div className="flex-1 min-w-0">
            {selectedVendorId && (
              <div className="mb-4 flex items-center justify-between rounded-2xl border border-orange-400/20 bg-orange-500/[0.06] px-4 py-2.5">
                <p className="text-xs text-slate-200">
                  Showing listings by <span className="font-bold text-orange-400">@{selectedVendorId}</span>
                </p>
                <button
                  onClick={() => setSelectedVendorId(null)}
                  className="text-xs font-semibold text-orange-400 underline hover:text-orange-300"
                >
                  Clear Filter
                </button>
              </div>
            )}

            {filteredProducts.length === 0 ? (
              <div className="mt-12 flex flex-col items-center gap-2 text-center py-12">
                <ShoppingBag size={32} className="text-slate-600" />
                <p className="text-sm text-slate-500">
                  {selectedVendorId ? `No active listings found for @${selectedVendorId}.` : "No listings yet — be the first to sell here."}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {filteredProducts.map((p) => (
                  <Link
                    key={p.productId}
                    href={`/shop/product/${p.productId}`}
                    className="group overflow-hidden rounded-2xl border border-white/10 light:border-black/10 bg-white/[0.02] transition hover:border-orange-400/30"
                  >
                    <div className="aspect-square w-full overflow-hidden bg-white/5">
                      {p.imageUrl || (p.imageUrls && p.imageUrls.length > 0) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.imageUrl || (p.imageUrls ? p.imageUrls[0] : "")}
                          alt={p.title}
                          className="h-full w-full object-cover transition group-hover:scale-105"
                        />
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
                      <p className="mt-1 flex items-center gap-1 text-[11px] text-slate-500 truncate">
                        <Store size={11} className="flex-shrink-0" /> {p.vendorId}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

