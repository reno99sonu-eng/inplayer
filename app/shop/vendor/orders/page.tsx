"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Package, IndianRupee, Check, X, MessageSquare, AlertTriangle } from "lucide-react";
import { useAuthModal } from "@/app/components/auth/AuthProvider";
import { authedFetch } from "@/app/lib/apiFetch";
import { orderTotalInr } from "@/app/lib/hammartOrderMath";
import VendorSalesStats from "@/app/components/hammart/VendorSalesStats";
import type { HammartOrder } from "@/app/lib/hammartOrders";

function VendorOrderCard({
  order,
  busy,
  onUpdateStatus,
  onFeedbackResolved,
}: {
  order: HammartOrder;
  busy: boolean;
  onUpdateStatus: (orderId: string, status: "vendor_confirmed" | "vendor_cancelled") => void;
  onFeedbackResolved: (orderId: string, vendorResponse: string) => void;
}) {
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = replyText.trim();
    if (!trimmed) {
      setSendError("Please write a response.");
      return;
    }
    setSendError(null);
    setSending(true);
    try {
      const res = await authedFetch(`/api/hammart/orders/${order.orderId}/feedback`, {
        method: "PATCH",
        body: JSON.stringify({ response: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSendError(data.error || "Couldn't send that. Please try again.");
        return;
      }
      onFeedbackResolved(order.orderId, trimmed);
      setReplyOpen(false);
      setReplyText("");
    } catch (err) {
      console.error("Failed to send feedback response:", err);
      setSendError("Something went wrong. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const total = orderTotalInr(order);
  const qty = order.quantity && order.quantity > 1 ? order.quantity : null;

  return (
    <div className="rounded-xl border border-white/10 light:border-black/10 bg-white/[0.02] p-3">
      <div className="flex items-center gap-3">
        {order.productImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={order.productImageUrl} alt={order.productTitle} className="h-12 w-12 flex-shrink-0 rounded-lg object-cover" />
        ) : (
          <div className="h-12 w-12 flex-shrink-0 rounded-lg bg-white/5" />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white light:text-slate-900">{order.productTitle}</p>
          <p className="flex items-center gap-1 text-xs text-slate-400 light:text-slate-600">
            <IndianRupee size={11} /> {total.toLocaleString("en-IN")}
            {qty ? ` (${qty} × ₹${order.priceInr.toLocaleString("en-IN")})` : ""} · {order.buyerName}
          </p>
        </div>
      </div>

      {order.status === "placed" ? (
        <>
          <p className="mt-2 flex items-center gap-1 text-[10px] font-semibold text-amber-300">
            <AlertTriangle size={10} /> Buyer pays you directly via UPI ({order.vendorUpiId || "your UPI ID"}) — verify it actually arrived before confirming.
          </p>
          <div className="mt-1.5 flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => onUpdateStatus(order.orderId, "vendor_confirmed")}
              className="flex items-center gap-1 rounded-lg bg-emerald-500/15 px-2.5 py-1.5 text-xs font-bold text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-50"
            >
              <Check size={12} /> Confirm received
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onUpdateStatus(order.orderId, "vendor_cancelled")}
              className="flex items-center gap-1 rounded-lg bg-red-500/15 px-2.5 py-1.5 text-xs font-bold text-red-300 hover:bg-red-500/25 disabled:opacity-50"
            >
              <X size={12} /> Cancel
            </button>
          </div>
        </>
      ) : order.status === "paid" ? (
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => onUpdateStatus(order.orderId, "vendor_confirmed")}
            className="flex items-center gap-1 rounded-lg bg-emerald-500/15 px-2.5 py-1.5 text-xs font-bold text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-50"
          >
            <Check size={12} /> Confirm & ship
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onUpdateStatus(order.orderId, "vendor_cancelled")}
            className="flex items-center gap-1 rounded-lg bg-red-500/15 px-2.5 py-1.5 text-xs font-bold text-red-300 hover:bg-red-500/25 disabled:opacity-50"
          >
            <X size={12} /> Cancel
          </button>
        </div>
      ) : order.status === "payment_pending" ? (
        <p className="mt-2 text-[11px] font-semibold text-amber-300">Awaiting payment</p>
      ) : order.status === "payment_failed" ? (
        <p className="mt-2 text-[11px] font-semibold text-red-300">Payment failed</p>
      ) : (
        <p className={`mt-2 text-[11px] font-semibold ${order.status === "vendor_confirmed" ? "text-emerald-300" : "text-red-300"}`}>
          {order.status === "vendor_confirmed" ? "Confirmed" : "Cancelled"}
        </p>
      )}

      {order.feedback && (
        <div
          className={`mt-2 rounded-lg border p-2.5 text-[11px] ${
            order.feedback.type === "complaint" ? "border-red-400/20 bg-red-500/[0.06]" : "border-sky-400/20 bg-sky-500/[0.06]"
          }`}
        >
          <p className="flex items-center gap-1 font-bold text-slate-200 light:text-slate-900">
            {order.feedback.type === "complaint" ? (
              <AlertTriangle size={11} className="text-red-400" />
            ) : (
              <MessageSquare size={11} className="text-sky-400" />
            )}
            {order.feedback.type === "complaint" ? "Complaint" : "Feedback"} from {order.buyerName}
            <span
              className={`ml-auto rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                order.feedback.status === "resolved" ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300"
              }`}
            >
              {order.feedback.status === "resolved" ? "Resolved" : "Open"}
            </span>
          </p>
          <p className="mt-1 text-slate-300 light:text-slate-700">{order.feedback.message}</p>

          {order.feedback.vendorResponse ? (
            <div className="mt-1.5 border-t border-white/10 light:border-black/10 pt-1.5">
              <p className="font-bold text-orange-300">Your reply:</p>
              <p className="mt-0.5 text-slate-300 light:text-slate-700">{order.feedback.vendorResponse}</p>
            </div>
          ) : (
            <>
              {!replyOpen && (
                <button
                  type="button"
                  onClick={() => setReplyOpen(true)}
                  className="mt-1.5 rounded-lg bg-orange-500/15 px-2 py-1 text-[10px] font-bold text-orange-300 hover:bg-orange-500/25"
                >
                  Reply to customer
                </button>
              )}
              {replyOpen && (
                <form onSubmit={handleSendReply} className="mt-1.5 space-y-1.5">
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Write your response..."
                    rows={2}
                    className="w-full rounded-lg border border-white/10 light:border-black/10 bg-white/5 light:bg-white px-2 py-1.5 text-[11px] text-white light:text-slate-900 outline-none focus:border-orange-400/50"
                  />
                  {sendError && <p className="text-[10px] text-red-400">{sendError}</p>}
                  <button
                    type="submit"
                    disabled={sending}
                    className="w-full rounded-lg bg-orange-500 py-1.5 text-[10px] font-bold text-white transition hover:bg-orange-600 disabled:opacity-60"
                  >
                    {sending ? "Sending..." : "Send Response"}
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

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

  const handleFeedbackResolved = (orderId: string, vendorResponse: string) => {
    setOrders((prev) =>
      prev.map((o) =>
        o.orderId === orderId && o.feedback
          ? { ...o, feedback: { ...o.feedback, vendorResponse, vendorRespondedAt: new Date().toISOString(), status: "resolved" } }
          : o
      )
    );
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
        Orders paid through your Razorpay setup are verified automatically — just confirm once shipped. Orders
        marked as paid via UPI need you to check your own UPI app before confirming.
      </p>

      {orders.length > 0 && (
        <div className="mt-5">
          <h2 className="mb-2 text-xs font-black uppercase tracking-wide text-slate-400 light:text-slate-600">Sales Overview</h2>
          <VendorSalesStats orders={orders} />
        </div>
      )}

      {orders.length === 0 ? (
        <div className="mt-10 flex flex-col items-center gap-2 text-center text-sm text-slate-500">
          <Package size={26} className="text-slate-600" />
          No orders yet.
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {orders.map((o) => (
            <VendorOrderCard key={o.orderId} order={o} busy={busyId === o.orderId} onUpdateStatus={updateStatus} onFeedbackResolved={handleFeedbackResolved} />
          ))}
        </div>
      )}

      <Link href="/shop/vendor" className="mt-6 block text-center text-xs font-semibold text-orange-300 hover:text-orange-200">
        ← Back to Vendor Dashboard
      </Link>
    </div>
  );
}
