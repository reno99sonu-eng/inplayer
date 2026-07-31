"use client";

import { useEffect, useState } from "react";
import { Loader2, Package, IndianRupee } from "lucide-react";
import { useAuthModal } from "@/app/components/auth/AuthProvider";
import { authedFetch } from "@/app/lib/apiFetch";
import type { HammartOrder } from "@/app/lib/hammartOrders";

const STATUS_LABEL: Record<string, { label: string; tone: string }> = {
  placed: { label: "Placed — awaiting vendor confirmation", tone: "text-amber-300" },
  vendor_confirmed: { label: "Confirmed by vendor", tone: "text-emerald-300" },
  vendor_cancelled: { label: "Cancelled by vendor", tone: "text-red-300" },
};

export default function MyOrdersPage() {
  const { user, authLoading } = useAuthModal();
  const [orders, setOrders] = useState<HammartOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const markNotLoading = () => setLoading(false);
    if (!user?.userId) {
      markNotLoading();
      return;
    }
    (async () => {
      try {
        const res = await authedFetch("/api/hammart/orders");
        const data = await res.json().catch(() => ({}));
        setOrders(data.orders || []);
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.userId]);

  if (authLoading || (loading && user?.userId)) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 size={24} className="animate-spin text-slate-400" />
      </div>
    );
  }

  if (!user) {
    return <div className="mx-auto max-w-md px-6 py-16 text-center text-sm text-slate-400">Sign in to see your orders.</div>;
  }

  return (
    <div className="mx-auto max-w-xl px-6 py-8">
      <h1 className="text-xl font-black text-white light:text-slate-900">My Orders</h1>
      {orders.length === 0 ? (
        <div className="mt-10 flex flex-col items-center gap-2 text-center text-sm text-slate-500">
          <Package size={26} className="text-slate-600" />
          No orders yet.
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {orders.map((o) => (
            <div key={o.orderId} className="flex items-center gap-3 rounded-xl border border-white/10 light:border-black/10 bg-white/[0.02] p-3">
              {o.productImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={o.productImageUrl} alt={o.productTitle} className="h-12 w-12 flex-shrink-0 rounded-lg object-cover" />
              ) : (
                <div className="h-12 w-12 flex-shrink-0 rounded-lg bg-white/5" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white light:text-slate-900">{o.productTitle}</p>
                <p className="flex items-center gap-1 text-xs text-slate-400">
                  <IndianRupee size={11} /> {o.priceInr.toLocaleString("en-IN")} · from {o.vendorId}
                </p>
                <p className={`mt-0.5 text-[11px] font-semibold ${STATUS_LABEL[o.status]?.tone || "text-slate-400"}`}>
                  {STATUS_LABEL[o.status]?.label || o.status}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
