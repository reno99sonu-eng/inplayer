"use client";

import { authedFetch } from "@/app/lib/apiFetch";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, AlertTriangle, Search, ShieldAlert, Ban, RotateCcw, ShoppingBag } from "lucide-react";

type Tab = "flagged" | "removed" | "all";

interface Product {
  productId: string;
  vendorUserId: string;
  vendorUsername: string | null;
  vendorId: string;
  title: string;
  description: string;
  category: string;
  priceInr: number;
  imageUrl: string | null;
  status: "active" | "vendor_hidden" | "admin_removed";
  flagged: boolean;
  flaggedCategory: string | null;
  flaggedReason: string | null;
  createdAt: string;
}

export default function AdminHammartProductsPage() {
  const [tab, setTab] = useState<Tab>("flagged");
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tableMissing, setTableMissing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.vendorId.toLowerCase().includes(q) ||
        (p.vendorUsername || "").toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
    );
  }, [items, query]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authedFetch(`/api/admin/hammart-products?tab=${tab}`);
      if (!res.ok) throw new Error(`Couldn't load listings (HTTP ${res.status}).`);
      const data = await res.json();
      setItems(data.items || []);
      setTableMissing(Boolean(data.tableMissing));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      await load();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const runAction = async (productId: string, action: "remove" | "restore") => {
    setBusyId(productId);
    try {
      const res = await authedFetch("/api/admin/hammart-products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, action }),
      });
      if (res.ok) {
        setItems((prev) => prev.filter((p) => p.productId !== productId));
      } else {
        const data = await res.json().catch(() => ({}));
        window.alert(data.error || "Couldn't save that right now.");
      }
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <div>
        <h2 className="text-xl font-black text-white light:text-slate-900">Hammart Products — moderation</h2>
        <p className="mt-1 text-sm text-slate-400 light:text-slate-600">
          Listings the banned-items AI check flagged, plus anything already removed. Removing a listing here
          takes it off the storefront immediately; it doesn&apos;t touch the vendor&apos;s account.
        </p>
      </div>

      <div className="mt-4 flex items-center gap-2">
        {(
          [
            { key: "flagged", label: "Flagged" },
            { key: "removed", label: "Removed" },
            { key: "all", label: "All listings" },
          ] as { key: Tab; label: string }[]
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${
              tab === t.key
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                : "bg-white/5 text-slate-400 light:text-slate-700 light:bg-slate-200/80 hover:bg-white/10 hover:text-white light:hover:text-slate-900"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-2 rounded-2xl border border-white/10 light:border-slate-300 bg-white/[0.03] light:bg-white px-4 py-3 light:shadow-sm">
        <Search size={16} className="text-slate-400 light:text-slate-600" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by title, vendor ID, or category…"
          className="w-full bg-transparent text-sm text-white light:text-slate-900 outline-none placeholder:text-slate-500 light:placeholder:text-slate-600 font-medium"
        />
      </div>

      {tableMissing && (
        <div className="mt-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-xs leading-5 text-amber-300 light:text-amber-800 font-semibold">
          Hammart-Products hasn&apos;t been created in AWS yet, so nothing can be listed until it exists.
        </div>
      )}
      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300 light:text-red-800 font-semibold">
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <Loader2 size={24} className="animate-spin text-indigo-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-8 flex flex-col items-center gap-2 py-8 text-center">
          <ShoppingBag size={28} className="text-emerald-400" />
          <p className="text-sm text-slate-500">{query ? `Nothing matches "${query}".` : "Nothing here."}</p>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {filtered.map((p) => (
            <div key={p.productId} className="flex gap-3 rounded-2xl border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.02] p-4">
              {p.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.imageUrl} alt={p.title} className="h-20 w-20 flex-shrink-0 rounded-xl border border-white/10 object-cover" />
              ) : (
                <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-xl border border-dashed border-white/10 text-[10px] text-slate-600">
                  No photo
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-white light:text-slate-900">{p.title}</p>
                    <p className="mt-0.5 text-xs text-slate-400 light:text-slate-600">
                      {p.category} · ₹{p.priceInr} · Sold by {p.vendorId}
                      {p.vendorUsername ? ` (@${p.vendorUsername})` : ""}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs text-slate-500">{p.description}</p>
                  </div>
                  <span className="text-[11px] text-slate-500">{new Date(p.createdAt).toLocaleDateString("en-IN")}</span>
                </div>

                {p.flagged && (
                  <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-500/10 light:bg-amber-100 px-2.5 py-1.5 text-[11px] text-amber-300 light:text-amber-800">
                    <ShieldAlert size={12} className="mt-0.5 flex-shrink-0" />
                    Flagged as {p.flaggedCategory || "possibly banned"}
                    {p.flaggedReason ? `: "${p.flaggedReason}"` : "."}
                  </p>
                )}

                <div className="mt-3 flex items-center gap-2">
                  <Link href={`/shop/product/${p.productId}`} target="_blank" className="text-[11px] font-semibold text-indigo-300 hover:text-indigo-200">
                    View listing
                  </Link>
                  {p.status === "admin_removed" ? (
                    <button
                      type="button"
                      disabled={busyId === p.productId}
                      onClick={() => runAction(p.productId, "restore")}
                      className="flex items-center gap-1.5 rounded-xl bg-emerald-500/15 light:bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-300 light:text-emerald-700 transition hover:bg-emerald-500/25 light:hover:bg-emerald-200 disabled:opacity-60"
                    >
                      {busyId === p.productId ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
                      Restore listing
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={busyId === p.productId}
                      onClick={() => runAction(p.productId, "remove")}
                      className="flex items-center gap-1.5 rounded-xl bg-red-500/15 light:bg-red-100 px-3 py-1.5 text-xs font-bold text-red-300 light:text-red-700 transition hover:bg-red-500/25 light:hover:bg-red-200 disabled:opacity-60"
                    >
                      {busyId === p.productId ? <Loader2 size={13} className="animate-spin" /> : <Ban size={13} />}
                      Remove listing
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
