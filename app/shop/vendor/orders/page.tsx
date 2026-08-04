"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Package, IndianRupee, Check, X } from "lucide-react";
import { useAuthModal } from "@/app/components/auth/AuthProvider";
import { authedFetch } from "@/app/lib/apiFetch";
import type { HammartOrder } from "@/app/lib/hammartOrders";

export default function VendorOrdersPage() {
  const { user, authLoading } = useAuthModal();
  const [orders, setOrders] = useState<HammartOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await authedFetch("/api/hammart/orders?role=vendor");
      const data = await res.json().catch(() => ({}));
      setOrders(data.orders || []);
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

  const updateStatus = async (orderId: string, status: "vendor_confirmed" | "vendor_cancelled") => {
    setBusyId(orderId);
    try {
      await authedFetch(`/api/hammart/orders/${orderId}`, { method: "PATCH", body: JSON.stringify({ status }) });
      await load();
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
    return <div className="mx-auto max-w-md px-6 py-16 text-center text-sm text-slate-400 light:text-slate-600">Sign in to see your orders.</div>;
  }

  return (
    <div className="mx-auto max-w-xl px-6 py-8">
      <h1 className="text-xl font-black text-white light:text-slate-900">Orders Received</h1>
      <p className="mt-1 text-xs text-slate-500">
        Confirm once you&apos;ve actually received payment via UPI — InPlayer can&apos;t verify this for you.
      </p>

      {orders.length === 0 ? (
        <div className="mt-10 flex flex-col items-center gap-2 text-center text-sm text-slate-500">
          <Package size={26} className="text-slate-600" />
          No orders yet.
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {orders.map((o) => (
            <div key={o.orderId} className="rounded-xl border border-white/10 light:border-black/10 bg-white/[0.02] p-3">
              <div className="flex items-center gap-3">
                {o.productImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={o.productImageUrl} alt={o.productTitle} className="h-12 w-12 flex-shrink-0 rounded-lg object-cover" />
                ) : (
                  <div className="h-12 w-12 flex-shrink-0 rounded-lg bg-white/5" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white light:text-slate-900">{o.productTitle}</p>
                  <p className="flex items-center gap-1 text-xs text-slate-400 light:text-slate-600">
                    <IndianRupee size={11} /> {o.priceInr.toLocaleString("en-IN")} · {o.buyerName}
                  </p>
                </div>
              </div>
              {o.status === "placed" ? (
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    disabled={busyId === o.orderId}
                    onClick={() => updateStatus(o.orderId, "vendor_confirmed")}
                    className="flex items-center gap-1 rounded-lg bg-emerald-500/15 px-2.5 py-1.5 text-xs font-bold text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-50"
                  >
                    <Check size={12} /> Confirm received
                  </button>
                  <button
                    type="button"
                    disabled={busyId === o.orderId}
                    onClick={() => updateStatus(o.orderId, "vendor_cancelled")}
                    className="flex items-center gap-1 rounded-lg bg-red-500/15 px-2.5 py-1.5 text-xs font-bold text-red-300 hover:bg-red-500/25 disabled:opacity-50"
                  >
                    <X size={12} /> Cancel
                  </button>
                </div>
              ) : (
                <p className={`mt-2 text-[11px] font-semibold ${o.status === "vendor_confirmed" ? "text-emerald-300" : "text-red-300"}`}>
                  {o.status === "vendor_confirmed" ? "Confirmed" : "Cancelled"}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <Link href="/shop/vendor" className="mt-6 block text-center text-xs font-semibold text-orange-300 hover:text-orange-200">
        ← Back to Vendor Dashboard
      </Link>
    </div>
  );
}
