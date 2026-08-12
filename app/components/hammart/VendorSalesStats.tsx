"use client";

import { IndianRupee, ShoppingBag, Clock, CheckCircle2, XCircle, TrendingUp } from "lucide-react";
import type { HammartOrder } from "@/app/lib/hammartOrders";
import { orderTotalInr } from "@/app/lib/hammartOrderMath";

// Pure presentational — every number here is derived directly from the
// real order rows passed in (the same /api/hammart/orders?role=vendor
// data the "Orders Received" list itself renders). Nothing here is
// estimated, mocked, or hardcoded — a vendor with zero real sales sees
// real zeroes, not a placeholder, and this component doesn't fetch
// anything itself so there's exactly one source of truth for "what are
// this vendor's orders" across the dashboard and the full orders page.
//
// "Confirmed" (vendor_confirmed) is the only status counted as actual
// revenue here — that's fulfillment confirmation (the vendor has
// shipped/received it), tracked separately from payment confirmation.
// Hammart checkout uses one of two payment paths per vendor (see
// app/api/hammart/checkout/route.ts): "paid" rows had their payment
// verified server-side via the Razorpay webhook before ever reaching that
// status; "placed" rows are the direct-UPI fallback for a vendor without
// an active Razorpay account — the buyer paid the vendor's UPI ID
// directly, and it's on the vendor's own word (same as it's always been
// for that path) that the money actually arrived.
interface VendorSalesStatsProps {
  orders: HammartOrder[];
  // Dashboard landing page gets a short at-a-glance summary; the full
  // Orders Received page gets the complete breakdown + top products.
  compact?: boolean;
}

interface ProductAggregate {
  title: string;
  imageUrl: string | null;
  units: number;
  revenue: number;
}

export default function VendorSalesStats({ orders, compact = false }: VendorSalesStatsProps) {
  const confirmed = orders.filter((o) => o.status === "vendor_confirmed");
  // Awaiting confirmation covers both payment paths — direct-UPI "placed"
  // rows and Razorpay-verified "paid" rows — either way the vendor still
  // needs to confirm the order.
  const placed = orders.filter((o) => o.status === "placed" || o.status === "paid");
  const cancelled = orders.filter((o) => o.status === "vendor_cancelled");

  const totalRevenue = confirmed.reduce((sum, o) => sum + orderTotalInr(o), 0);
  const avgOrderValue = confirmed.length > 0 ? totalRevenue / confirmed.length : 0;

  const byProduct = new Map<string, ProductAggregate>();
  confirmed.forEach((o) => {
    const qty = o.quantity && o.quantity > 0 ? o.quantity : 1;
    const existing = byProduct.get(o.productId);
    if (existing) {
      existing.units += qty;
      existing.revenue += orderTotalInr(o);
    } else {
      byProduct.set(o.productId, { title: o.productTitle, imageUrl: o.productImageUrl, units: qty, revenue: orderTotalInr(o) });
    }
  });
  const topProducts = Array.from(byProduct.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  const stats: { label: string; value: string; icon: typeof IndianRupee; tone: string }[] = [
    { label: "Total Revenue", value: `₹${totalRevenue.toLocaleString("en-IN")}`, icon: IndianRupee, tone: "border-emerald-400/20 bg-emerald-500/10 text-emerald-300" },
    { label: "Total Orders", value: orders.length.toLocaleString("en-IN"), icon: ShoppingBag, tone: "border-sky-400/20 bg-sky-500/10 text-sky-300" },
    { label: "Awaiting Confirmation", value: placed.length.toLocaleString("en-IN"), icon: Clock, tone: "border-amber-400/20 bg-amber-500/10 text-amber-300" },
    { label: "Confirmed Sales", value: confirmed.length.toLocaleString("en-IN"), icon: CheckCircle2, tone: "border-emerald-400/20 bg-emerald-500/10 text-emerald-300" },
  ];

  if (!compact) {
    stats.push(
      { label: "Cancelled", value: cancelled.length.toLocaleString("en-IN"), icon: XCircle, tone: "border-red-400/20 bg-red-500/10 text-red-300" },
      { label: "Avg. Order Value", value: `₹${Math.round(avgOrderValue).toLocaleString("en-IN")}`, icon: TrendingUp, tone: "border-orange-400/20 bg-orange-500/10 text-orange-300" }
    );
  }

  return (
    <div>
      <div className={`grid gap-2.5 ${compact ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-3"}`}>
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className={`rounded-2xl border p-3 text-left ${s.tone}`}>
              <Icon size={16} />
              <p className="mt-1.5 text-lg font-black text-white light:text-slate-900">{s.value}</p>
              <p className="text-[10px] font-semibold uppercase tracking-wide opacity-80">{s.label}</p>
            </div>
          );
        })}
      </div>

      {!compact && topProducts.length > 0 && (
        <div className="mt-4 rounded-2xl border border-white/10 light:border-black/10 bg-white/[0.02] p-4 text-left">
          <h3 className="text-xs font-black uppercase tracking-wide text-slate-300 light:text-slate-700">Top Selling Products</h3>
          <div className="mt-3 space-y-2.5">
            {topProducts.map((p, idx) => (
              <div key={idx} className="flex items-center gap-3">
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.imageUrl} alt={p.title} className="h-10 w-10 flex-shrink-0 rounded-lg object-cover" />
                ) : (
                  <div className="h-10 w-10 flex-shrink-0 rounded-lg bg-white/5" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-white light:text-slate-900">{p.title}</p>
                  <p className="text-[11px] text-slate-400 light:text-slate-600">{p.units} sold</p>
                </div>
                <p className="flex-shrink-0 text-xs font-bold text-emerald-300">₹{p.revenue.toLocaleString("en-IN")}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
