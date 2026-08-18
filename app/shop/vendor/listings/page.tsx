"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Plus, Upload, Trash2, Eye, EyeOff, AlertTriangle, IndianRupee } from "lucide-react";
import { useAuthModal } from "@/app/components/auth/AuthProvider";
import { authedFetch } from "@/app/lib/apiFetch";
import { compressImageToThumbnail } from "@/app/lib/imageCompress";
import BackButton from "@/app/components/BackButton";
import type { HammartProduct } from "@/app/lib/hammartProducts";

const CATEGORIES = ["Merchandise", "Digital Products", "Handicrafts", "Fashion", "Electronics", "Home & Living", "Other"];

const COUNTRIES = ["India", "United States", "Germany", "Japan", "China", "United Kingdom", "United Arab Emirates", "France", "Vietnam", "Taiwan", "Other"];

function AddListingForm({ onCreated }: { onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [details, setDetails] = useState("");
  const [hsCode, setHsCode] = useState("");
  const [countryOfOrigin, setCountryOfOrigin] = useState("India");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [priceInr, setPriceInr] = useState("");
  const [stockQuantity, setStockQuantity] = useState("1");
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [processingImage, setProcessingImage] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flaggedNotice, setFlaggedNotice] = useState<string | null>(null);

  const handleMultipleImages = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setProcessingImage(true);
    try {
      const remainingSlots = 5 - imageUrls.length;
      const filesToProcess = Array.from(files).slice(0, remainingSlots);
      const newUrls: string[] = [];

      for (const file of filesToProcess) {
        const dataUrl = await compressImageToThumbnail(file, 1, 640, 0.82);
        newUrls.push(dataUrl);
      }

      setImageUrls((prev) => [...prev, ...newUrls]);
    } catch (err) {
      console.error("Product image processing failed:", err);
      setError("Couldn't process one or more photos. Please try again.");
    } finally {
      setProcessingImage(false);
    }
  };

  const removeImage = (index: number) => {
    setImageUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFlaggedNotice(null);

    const price = Number(priceInr);
    if (!title.trim() || !description.trim()) {
      setError("Please fill in the title and description.");
      return;
    }
    if (!Number.isFinite(price) || price < 1) {
      setError("Please enter a valid price.");
      return;
    }
    const parsedStock = parseInt(stockQuantity, 10);
    if (!Number.isFinite(parsedStock) || parsedStock < 0) {
      setError("Please enter a valid stock quantity (0 or more).");
      return;
    }

    setSubmitting(true);
    try {
      const res = await authedFetch("/api/hammart/products", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          details: details.trim(),
          hsCode: hsCode.trim(),
          countryOfOrigin,
          category,
          priceInr: price,
          stockQuantity: parsedStock,
          imageUrl: imageUrls.length > 0 ? imageUrls[0] : null,
          imageUrls,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Couldn't publish that listing.");
        return;
      }
      if (data.flagged) {
        setFlaggedNotice(
          "This listing was automatically flagged by our banned-items check and is hidden from buyers pending review. Contact InPlayer support if you believe this is a mistake."
        );
      }
      setTitle("");
      setDescription("");
      setDetails("");
      setHsCode("");
      setCountryOfOrigin("India");
      setPriceInr("");
      setStockQuantity("1");
      setImageUrls([]);
      onCreated();
    } catch (err) {
      console.error("Failed to create listing:", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3.5 rounded-2xl border border-white/10 light:border-black/10 bg-white/[0.02] p-4 text-left">
      <div>
        <label className="block text-xs font-semibold text-slate-300 light:text-slate-700 mb-1">
          Product Photos (Upload up to 5 photos)
        </label>
        
        <div className="flex flex-wrap gap-2.5 items-center">
          {imageUrls.map((url, idx) => (
            <div key={idx} className="relative group h-20 w-20 flex-shrink-0 rounded-xl overflow-hidden border border-white/15 bg-black/40">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={`Photo ${idx + 1}`} className="h-full w-full object-cover" />
              {idx === 0 && (
                <span className="absolute top-1 left-1 rounded-md bg-orange-500/90 px-1 py-0.5 text-[9px] font-bold text-white">
                  Cover
                </span>
              )}
              <button
                type="button"
                onClick={() => removeImage(idx)}
                className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-white transition opacity-80 hover:opacity-100 hover:bg-red-500"
              >
                <Trash2 size={11} />
              </button>
            </div>
          ))}

          {imageUrls.length < 5 && (
            <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-white/20 light:border-black/20 bg-white/5 transition hover:border-orange-400/50 hover:bg-orange-500/5">
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  handleMultipleImages(e.target.files);
                  e.target.value = "";
                }}
              />
              {processingImage ? (
                <Loader2 size={18} className="animate-spin text-orange-400" />
              ) : (
                <>
                  <Plus size={20} className="text-orange-400" />
                  <span className="mt-1 text-[10px] text-slate-400 light:text-slate-600">Add Photo</span>
                </>
              )}
            </label>
          )}
        </div>
      </div>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Listing title (e.g. Handmade Ceramic Coffee Mug)"
        className="w-full rounded-xl border border-white/10 light:border-black/10 bg-[#07111F] light:bg-white px-3 py-2.5 text-sm text-white light:text-slate-900 outline-none focus:border-orange-400/50"
      />

      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Short Description (Summary of item)"
        rows={2}
        className="w-full rounded-xl border border-white/10 light:border-black/10 bg-[#07111F] light:bg-white px-3 py-2.5 text-sm text-white light:text-slate-900 outline-none focus:border-orange-400/50"
      />

      <textarea
        value={details}
        onChange={(e) => setDetails(e.target.value)}
        placeholder="Product Details & Technical Specs (Dimensions, Material, Care Instructions, Warranty, Box Contents)"
        rows={3}
        className="w-full rounded-xl border border-white/10 light:border-black/10 bg-[#07111F] light:bg-white px-3 py-2.5 text-sm text-white light:text-slate-900 outline-none focus:border-orange-400/50"
      />

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[11px] font-semibold text-slate-400 light:text-slate-700 mb-1">HS Code (Trade Classification)</label>
          <input
            value={hsCode}
            onChange={(e) => setHsCode(e.target.value)}
            placeholder="e.g. 6912.00 (Optional)"
            className="w-full rounded-xl border border-white/10 light:border-black/10 bg-[#07111F] light:bg-white px-3 py-2 text-xs text-white light:text-slate-900 outline-none focus:border-orange-400/50"
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-400 light:text-slate-700 mb-1">Country of Origin</label>
          <select
            value={countryOfOrigin}
            onChange={(e) => setCountryOfOrigin(e.target.value)}
            className="w-full rounded-xl border border-white/10 light:border-black/10 bg-[#07111F] light:bg-white px-3 py-2 text-xs text-white light:text-slate-900 outline-none focus:border-orange-400/50"
          >
            {COUNTRIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="block text-[11px] font-semibold text-slate-400 light:text-slate-700 mb-1">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-xl border border-white/10 light:border-black/10 bg-[#07111F] light:bg-white px-3 py-2.5 text-sm text-white light:text-slate-900 outline-none focus:border-orange-400/50"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-400 light:text-slate-700 mb-1">Price (₹ INR)</label>
          <div className="relative">
            <IndianRupee size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="number"
              inputMode="numeric"
              value={priceInr}
              onChange={(e) => setPriceInr(e.target.value)}
              placeholder="Price"
              className="w-full rounded-xl border border-white/10 light:border-black/10 bg-[#07111F] light:bg-white py-2.5 pl-8 pr-3 text-sm text-white light:text-slate-900 outline-none focus:border-orange-400/50"
            />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-400 light:text-slate-700 mb-1">Stock Qty</label>
          <input
            type="number"
            inputMode="numeric"
            value={stockQuantity}
            onChange={(e) => setStockQuantity(e.target.value)}
            placeholder="Quantity"
            className="w-full rounded-xl border border-white/10 light:border-black/10 bg-[#07111F] light:bg-white px-3 py-2.5 text-sm text-white light:text-slate-900 outline-none focus:border-orange-400/50"
          />
        </div>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}
      {flaggedNotice && (
        <p className="flex items-start gap-1.5 rounded-lg bg-amber-500/10 px-2.5 py-2 text-[11px] text-amber-300">
          <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" /> {flaggedNotice}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting || processingImage}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] py-2.5 text-sm font-bold text-white disabled:opacity-60"
      >
        {submitting ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
        {submitting ? "Publishing..." : "Publish Listing"}
      </button>
    </form>
  );
}

export default function VendorListingsPage() {
  const { user, authLoading } = useAuthModal();
  const [products, setProducts] = useState<HammartProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await authedFetch("/api/hammart/vendor/products");
      const data = await res.json().catch(() => ({}));
      setProducts(data.products || []);
    } catch (err) {
      console.error("Failed to load listings:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const markNotLoading = () => setLoading(false);
    if (!user?.userId) {
      markNotLoading();
      return;
    }
    (async () => {
      await load();
    })();
  }, [user?.userId]);

  const toggleVisibility = async (product: HammartProduct) => {
    if (product.flagged && product.status !== "active") return;
    setBusyId(product.productId);
    try {
      const nextStatus = product.status === "active" ? "vendor_hidden" : "active";
      await authedFetch(`/api/hammart/products/${product.productId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (productId: string) => {
    if (!window.confirm("Delete this listing permanently?")) return;
    setBusyId(productId);
    try {
      await authedFetch(`/api/hammart/products/${productId}`, { method: "DELETE" });
      setProducts((prev) => prev.filter((p) => p.productId !== productId));
    } finally {
      setBusyId(null);
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
    return (
      <div className="mx-auto max-w-md px-6 py-16 text-center text-sm text-slate-400">
        Sign in to manage your Hammart listings.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-6 py-8">
      <BackButton />
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-black text-white light:text-slate-900">My Listings</h1>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 rounded-xl bg-orange-500/15 px-3 py-2 text-xs font-bold text-orange-300 hover:bg-orange-500/25"
        >
          <Plus size={14} /> {showForm ? "Close" : "New listing"}
        </button>
      </div>

      {showForm && (
        <div className="mt-4">
          <AddListingForm
            onCreated={() => {
              setShowForm(false);
              load();
            }}
          />
        </div>
      )}

      <div className="mt-5 space-y-2">
        {products.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-500">No listings yet.</p>
        ) : (
          products.map((p) => (
            <div key={p.productId} className="flex items-center gap-3 rounded-xl border border-white/10 light:border-black/10 bg-white/[0.02] p-3">
              {p.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.imageUrl} alt={p.title} className="h-14 w-14 flex-shrink-0 rounded-lg object-cover" />
              ) : (
                <div className="h-14 w-14 flex-shrink-0 rounded-lg bg-white/5" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white light:text-slate-900">{p.title}</p>
                <p className="text-xs text-slate-400 light:text-slate-600">
                  ₹{p.priceInr.toLocaleString("en-IN")} · {p.category} · Stock: {p.stockQuantity}
                </p>
                {p.flagged && (
                  <p className="mt-0.5 flex items-center gap-1 text-[11px] text-amber-400">
                    <AlertTriangle size={11} /> Flagged — hidden from buyers
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                {!p.flagged && (
                  <button
                    type="button"
                    disabled={busyId === p.productId}
                    onClick={() => toggleVisibility(p)}
                    title={p.status === "active" ? "Hide from buyers" : "Show to buyers"}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 light:border-black/10 text-slate-300 light:text-slate-600 hover:bg-white/5 disabled:opacity-50"
                  >
                    {p.status === "active" ? <Eye size={14} /> : <EyeOff size={14} />}
                  </button>
                )}
                <button
                  type="button"
                  disabled={busyId === p.productId}
                  onClick={() => remove(p.productId)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-500/20 text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <Link href="/shop/vendor" className="mt-6 block text-center text-xs font-semibold text-orange-300 hover:text-orange-200">
        ← Back to Vendor Dashboard
      </Link>
    </div>
  );
}
