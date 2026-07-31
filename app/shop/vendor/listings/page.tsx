"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Plus, Upload, Trash2, Eye, EyeOff, AlertTriangle, IndianRupee } from "lucide-react";
import { useAuthModal } from "@/app/components/auth/AuthProvider";
import { authedFetch } from "@/app/lib/apiFetch";
import { compressImageToThumbnail } from "@/app/lib/imageCompress";
import type { HammartProduct } from "@/app/lib/hammartProducts";

const CATEGORIES = ["Merchandise", "Digital Products", "Handicrafts", "Fashion", "Electronics", "Home & Living", "Other"];

function AddListingForm({ onCreated }: { onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [priceInr, setPriceInr] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [processingImage, setProcessingImage] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flaggedNotice, setFlaggedNotice] = useState<string | null>(null);

  const handleImage = async (file: File) => {
    setProcessingImage(true);
    try {
      const dataUrl = await compressImageToThumbnail(file, 1, 640, 0.82);
      setImageUrl(dataUrl);
    } catch (err) {
      console.error("Product image processing failed:", err);
      setError("Couldn't process that photo. Please try a different one.");
    } finally {
      setProcessingImage(false);
    }
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

    setSubmitting(true);
    try {
      const res = await authedFetch("/api/hammart/products", {
        method: "POST",
        body: JSON.stringify({ title: title.trim(), description: description.trim(), category, priceInr: price, imageUrl }),
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
      setPriceInr("");
      setImageUrl(null);
      onCreated();
    } catch (err) {
      console.error("Failed to create listing:", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl border border-white/10 light:border-black/10 bg-white/[0.02] p-4">
      <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-white/15 light:border-black/15 px-3 py-3 hover:border-orange-400/40">
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleImage(file);
            e.target.value = "";
          }}
        />
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="Product" className="h-16 w-16 flex-shrink-0 rounded-lg object-cover" />
        ) : (
          <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-lg bg-white/5 light:bg-black/5 text-slate-500">
            {processingImage ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
          </div>
        )}
        <span className="text-xs font-semibold text-slate-300 light:text-slate-700">
          {imageUrl ? "Tap to replace photo" : "Tap to add a product photo"}
        </span>
      </label>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Listing title"
        className="w-full rounded-xl border border-white/10 light:border-black/10 bg-[#07111F] light:bg-white px-3 py-2.5 text-sm text-white light:text-slate-900 outline-none focus:border-orange-400/50"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description"
        rows={3}
        className="w-full rounded-xl border border-white/10 light:border-black/10 bg-[#07111F] light:bg-white px-3 py-2.5 text-sm text-white light:text-slate-900 outline-none focus:border-orange-400/50"
      />
      <div className="grid grid-cols-2 gap-2">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-xl border border-white/10 light:border-black/10 bg-[#07111F] light:bg-white px-3 py-2.5 text-sm text-white light:text-slate-900 outline-none focus:border-orange-400/50"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
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
                <p className="text-xs text-slate-400">₹{p.priceInr.toLocaleString("en-IN")} · {p.category}</p>
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
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 light:border-black/10 text-slate-300 hover:bg-white/5 disabled:opacity-50"
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
