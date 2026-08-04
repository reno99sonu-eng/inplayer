"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { Loader2, Store, IndianRupee, ShoppingBag, Users, LayoutGrid, Search, X, ArrowUpDown } from "lucide-react";
import type { HammartProduct } from "@/app/lib/hammartProducts";

interface VendorItem {
  vendorId: string;
  vendorUserId: string;
  name: string;
  avatarUrl: string;
  productCount: number;
}

const CATEGORIES = [
  "All",
  "Merchandise",
  "Digital Products",
  "Handicrafts",
  "Fashion",
  "Electronics",
  "Home & Living",
  "Other",
];

type SortOption = "featured" | "price_low" | "price_high";

export default function ShopPage() {
  const [products, setProducts] = useState<HammartProduct[]>([]);
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("featured");
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

  // Real-time Filtering & Sorting across search, vendor, category, and price
  const filteredProducts = useMemo(() => {
    let result = [...products];

    if (selectedVendorId) {
      result = result.filter((p) => p.vendorId === selectedVendorId || p.vendorUserId === selectedVendorId);
    }

    if (selectedCategory !== "All") {
      result = result.filter((p) => p.category === selectedCategory);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          p.vendorId.toLowerCase().includes(q)
      );
    }

    if (sortBy === "price_low") {
      result.sort((a, b) => a.priceInr - b.priceInr);
    } else if (sortBy === "price_high") {
      result.sort((a, b) => b.priceInr - a.priceInr);
    }

    return result;
  }, [products, selectedVendorId, selectedCategory, searchQuery, sortBy]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-3 text-white light:text-slate-900">
      {/* Top Edge Compact Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 light:border-slate-300 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <Store className="text-orange-400 flex-shrink-0" size={22} />
          <div>
            <h1 className="text-lg sm:text-xl font-black text-white light:text-slate-900 leading-tight">HamMart</h1>
            <p className="text-[11px] text-slate-400 light:text-slate-700 font-medium">
              Buy directly from verified creators & vendors with instant UPI checkout
            </p>
          </div>
        </div>

        <Link
          href="/shop/vendor"
          className="rounded-xl border border-orange-400/40 bg-orange-500/10 light:bg-amber-100 light:border-amber-300 px-3.5 py-1.5 text-xs font-bold text-orange-300 light:text-amber-900 transition hover:bg-orange-500/20 active:scale-95"
        >
          Become a Seller / Open Storefront →
        </Link>
      </div>

      {/* Top Navbar Style Search Bar & Filters Bar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {/* Search Bar - Exactly matching Navbar style */}
        <div className="relative flex-1 min-w-[240px]">
          <div className="flex items-center rounded-2xl border border-white/15 light:border-slate-300 bg-white/[0.04] light:bg-white px-3.5 py-2 light:shadow-sm focus-within:border-orange-400">
            <Search size={16} className="text-slate-400 light:text-slate-600 flex-shrink-0 mr-2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products, categories, or sellers…"
              className="w-full bg-transparent text-xs text-white light:text-slate-900 outline-none placeholder:text-slate-400 light:placeholder:text-slate-600 font-medium"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="text-slate-400 hover:text-white light:hover:text-slate-900">
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Sorting Dropdown */}
        <div className="flex items-center gap-1.5 rounded-2xl border border-white/15 light:border-slate-300 bg-white/[0.04] light:bg-white px-3 py-2 text-xs font-semibold text-slate-300 light:text-slate-800 light:shadow-sm">
          <ArrowUpDown size={14} className="text-orange-400" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="bg-transparent text-white light:text-slate-900 font-bold outline-none cursor-pointer"
          >
            <option value="featured" className="bg-slate-900 light:bg-white text-white light:text-slate-900">Featured</option>
            <option value="price_low" className="bg-slate-900 light:bg-white text-white light:text-slate-900">Price: Low to High</option>
            <option value="price_high" className="bg-slate-900 light:bg-white text-white light:text-slate-900">Price: High to Low</option>
          </select>
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="flex gap-2 overflow-x-auto pb-3 mb-4 scrollbar-none">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`whitespace-nowrap rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
              selectedCategory === cat
                ? "bg-orange-500 text-white shadow-md shadow-orange-500/25"
                : "border border-white/10 light:border-slate-300 bg-white/[0.03] light:bg-white text-slate-300 light:text-slate-800 hover:bg-white/10 light:hover:bg-slate-100"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="mt-16 flex justify-center">
          <Loader2 size={24} className="animate-spin text-orange-400" />
        </div>
      ) : tableMissing ? (
        <p className="mt-16 text-center text-sm font-semibold text-slate-400 light:text-slate-700">Hammart isn&apos;t set up yet. Please check back shortly.</p>
      ) : (
        <div className="flex flex-col md:flex-row gap-5">
          {/* Left Taller Slim Vendor Sidebar Navbar */}
          <div className="w-full md:w-60 flex-shrink-0">
            <div className="sticky top-20 h-[calc(100vh-140px)] min-h-[480px] flex flex-col rounded-3xl border border-white/10 light:border-slate-300 bg-white/[0.02] light:bg-white p-3.5 light:shadow-sm">
              <div className="flex items-center justify-between border-b border-white/10 light:border-slate-200 pb-2.5 mb-2.5">
                <span className="text-xs font-black uppercase tracking-wider text-slate-300 light:text-slate-800 flex items-center gap-1.5">
                  <Users size={14} className="text-orange-400" /> Sellers & Vendors
                </span>
                <span className="rounded-full bg-white/10 light:bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-300 light:text-slate-800">
                  {vendorsList.length}
                </span>
              </div>

              {/* All Products Reset Button */}
              <button
                onClick={() => setSelectedVendorId(null)}
                className={`w-full flex items-center justify-between rounded-xl px-3 py-2 text-xs font-bold transition mb-2 ${
                  selectedVendorId === null
                    ? "border border-orange-400/50 bg-orange-500/20 light:bg-amber-100 text-orange-300 light:text-amber-900 shadow-sm"
                    : "border border-transparent text-slate-300 light:text-slate-800 hover:bg-white/5 light:hover:bg-slate-100"
                }`}
              >
                <span className="flex items-center gap-2">
                  <LayoutGrid size={14} /> All Sellers
                </span>
                <span className="text-[10px] font-bold opacity-75">{products.length}</span>
              </button>

              {/* Sellers List (Taller Scroll Area) */}
              <div className="flex-1 overflow-y-auto space-y-1 pr-1 scrollbar-thin">
                {vendorsList.map((vendor) => (
                  <button
                    key={vendor.vendorId}
                    onClick={() => setSelectedVendorId(vendor.vendorId)}
                    className={`w-full flex items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold transition ${
                      selectedVendorId === vendor.vendorId
                        ? "border border-orange-400/50 bg-orange-500/20 light:bg-amber-100 text-orange-300 light:text-amber-900 font-bold shadow-sm"
                        : "border border-transparent text-slate-300 light:text-slate-800 hover:bg-white/5 light:hover:bg-slate-100"
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={vendor.avatarUrl}
                        alt={vendor.name}
                        className="h-5 w-5 flex-shrink-0 rounded-full border border-white/20 light:border-slate-300 bg-white/10"
                      />
                      <span className="truncate">{vendor.name}</span>
                    </div>
                    <span className="rounded-md bg-white/10 light:bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-300 light:text-slate-800">
                      {vendor.productCount}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Main Compact Products Display Area (Right Screen) */}
          <div className="flex-1 min-w-0">
            {selectedVendorId && (
              <div className="mb-3.5 flex items-center justify-between rounded-2xl border border-orange-400/30 light:border-amber-300 bg-orange-500/10 light:bg-amber-100 px-4 py-2 text-xs">
                <p className="font-bold text-slate-200 light:text-slate-900">
                  Showing listings by <span className="text-orange-400 light:text-amber-900">@{selectedVendorId}</span>
                </p>
                <button
                  onClick={() => setSelectedVendorId(null)}
                  className="font-bold text-orange-400 light:text-amber-900 underline hover:text-orange-300"
                >
                  Clear Filter
                </button>
              </div>
            )}

            {filteredProducts.length === 0 ? (
              <div className="mt-12 flex flex-col items-center gap-2 text-center py-12">
                <ShoppingBag size={32} className="text-slate-500 light:text-slate-600" />
                <p className="text-sm font-semibold text-slate-400 light:text-slate-700">
                  {searchQuery
                    ? `No listings matching "${searchQuery}".`
                    : selectedVendorId
                    ? `No active listings found for @${selectedVendorId}.`
                    : "No listings yet — be the first to sell here."}
                </p>
              </div>
            ) : (
              /* Compact Product Cards Grid (Swiggy Instamart style smaller photos) */
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {filteredProducts.map((p) => (
                  <Link
                    key={p.productId}
                    href={`/shop/product/${p.productId}`}
                    className="group overflow-hidden rounded-2xl border border-white/10 light:border-slate-300 bg-white/[0.03] light:bg-white transition-all hover:border-orange-400/50 hover:shadow-lg light:hover:shadow-md hover:-translate-y-0.5"
                  >
                    <div className="aspect-[4/3] w-full overflow-hidden bg-black/20 light:bg-slate-100 relative">
                      {p.imageUrl || (p.imageUrls && p.imageUrls.length > 0) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.imageUrl || (p.imageUrls ? p.imageUrls[0] : "")}
                          alt={p.title}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-slate-500">
                          <ShoppingBag size={22} />
                        </div>
                      )}
                    </div>

                    <div className="p-2.5">
                      <p className="truncate text-xs font-bold text-white light:text-slate-900">{p.title}</p>
                      <p className="mt-1 flex items-center gap-0.5 text-xs font-black text-orange-400 light:text-orange-600">
                        <IndianRupee size={12} /> {p.priceInr.toLocaleString("en-IN")}
                      </p>
                      <p className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-slate-400 light:text-slate-600 truncate">
                        <Store size={10} className="flex-shrink-0 text-orange-400" /> {p.vendorId}
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
