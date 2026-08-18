"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Package, IndianRupee, RefreshCw, MessageSquare, AlertTriangle, Star, StarHalf, X } from "lucide-react";
import { useAuthModal } from "@/app/components/auth/AuthProvider";
import { authedFetch } from "@/app/lib/apiFetch";
import { orderTotalInr } from "@/app/lib/hammartOrderMath";
import ShopNavLinks from "@/app/components/hammart/ShopNavLinks";
import BackButton from "@/app/components/BackButton";
import type { HammartOrder } from "@/app/lib/hammartOrders";

const STATUS_LABEL: Record<string, { label: string; tone: string }> = {
  placed: { label: "Placed — awaiting vendor confirmation", tone: "text-amber-300" },
  payment_pending: { label: "Awaiting payment", tone: "text-amber-300" },
  paid: { label: "Paid — awaiting vendor confirmation", tone: "text-emerald-300" },
  payment_failed: { label: "Payment failed", tone: "text-red-300" },
  vendor_confirmed: { label: "Confirmed by vendor", tone: "text-emerald-300" },
  vendor_cancelled: { label: "Cancelled by vendor", tone: "text-red-300" },
  delivered: { label: "Delivered", tone: "text-emerald-400" },
};

function OrderCard({ order, onFeedbackSubmitted }: { order: HammartOrder; onFeedbackSubmitted: (orderId: string, updated: HammartOrder["feedback"]) => void }) {
  const [feedbackFormOpen, setFeedbackFormOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState<"feedback" | "complaint">("feedback");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Ratings modal state
  const [ratingModalOpen, setRatingModalOpen] = useState(false);
  const [ratingStars, setRatingStars] = useState(5);
  const [ratingComment, setRatingComment] = useState("");
  const [submittingRating, setSubmittingRating] = useState(false);
  const [ratingError, setRatingError] = useState<string | null>(null);
  const [alreadyRated, setAlreadyRated] = useState(false); // Quick local state hack to hide button after success

  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = feedbackMessage.trim();
    if (!trimmed) {
      setSubmitError("Please write a message.");
      return;
    }
    setSubmitError(null);
    setSubmitting(true);
    try {
      const res = await authedFetch(`/api/hammart/orders/${order.orderId}/feedback`, {
        method: "POST",
        body: JSON.stringify({ type: feedbackType, message: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSubmitError(data.error || "Couldn't send that. Please try again.");
        return;
      }
      onFeedbackSubmitted(order.orderId, {
        type: feedbackType,
        message: trimmed,
        createdAt: new Date().toISOString(),
        status: "open",
      });
      setFeedbackFormOpen(false);
      setFeedbackMessage("");
    } catch (err) {
      console.error("Failed to submit feedback:", err);
      setSubmitError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingRating(true);
    setRatingError(null);

    try {
      const res = await authedFetch("/api/hammart/reviews", {
        method: "POST",
        body: JSON.stringify({
          productId: order.productId,
          rating: ratingStars,
          comment: ratingComment,
        }),
      });
      
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit rating");
      }
      
      setRatingModalOpen(false);
      setAlreadyRated(true);
      alert("Thank you for your rating!");
    } catch (err) {
      console.error(err);
      setRatingError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmittingRating(false);
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
            {qty ? ` (${qty} × ₹${order.priceInr.toLocaleString("en-IN")})` : ""} · from {order.vendorId}
          </p>
          <p className={`mt-0.5 text-[11px] font-semibold ${STATUS_LABEL[order.status]?.tone || "text-slate-400"}`}>
            {STATUS_LABEL[order.status]?.label || order.status}
          </p>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Link
          href={`/shop/product/${order.productId}?reorder=1`}
          className="inline-flex items-center gap-1 rounded-lg bg-orange-500/15 px-2 py-1 text-[10px] font-bold text-orange-300 hover:bg-orange-500/25"
        >
          <RefreshCw size={11} /> Reorder
        </Link>
        {!order.feedback && (
          <button
            type="button"
            onClick={() => setFeedbackFormOpen((v) => !v)}
            className="inline-flex items-center gap-1 rounded-lg border border-white/10 light:border-black/10 px-2 py-1 text-[10px] font-bold text-slate-300 light:text-slate-700 hover:bg-white/5"
          >
            <MessageSquare size={11} /> Feedback / Report Issue
          </button>
        )}
        {order.status === "delivered" && !alreadyRated && (
          <button
            onClick={() => setRatingModalOpen(true)}
            className="inline-flex items-center gap-1 rounded-lg bg-orange-500/15 px-2 py-1 text-[10px] font-bold text-orange-300 hover:bg-orange-500/25"
          >
            <Star size={11} /> Rate Product
          </button>
        )}
      </div>

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
            {order.feedback.type === "complaint" ? "Your complaint" : "Your feedback"}
            <span
              className={`ml-auto rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                order.feedback.status === "resolved" ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300"
              }`}
            >
              {order.feedback.status === "resolved" ? "Resolved" : "Open"}
            </span>
          </p>
          <p className="mt-1 text-slate-300 light:text-slate-700">{order.feedback.message}</p>
          {order.feedback.vendorResponse && (
            <div className="mt-1.5 border-t border-white/10 light:border-black/10 pt-1.5">
              <p className="font-bold text-orange-300">@{order.vendorId} replied:</p>
              <p className="mt-0.5 text-slate-300 light:text-slate-700">{order.feedback.vendorResponse}</p>
            </div>
          )}
        </div>
      )}

      {feedbackFormOpen && !order.feedback && (
        <form
          onSubmit={handleSubmitFeedback}
          className="mt-2 space-y-1.5 rounded-lg border border-white/10 light:border-black/10 bg-black/10 light:bg-slate-50 p-2.5"
        >
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setFeedbackType("feedback")}
              className={`flex-1 rounded-lg py-1 text-[10px] font-bold transition ${
                feedbackType === "feedback" ? "bg-sky-500/20 text-sky-300" : "bg-white/5 light:bg-white text-slate-400 light:text-slate-600"
              }`}
            >
              Feedback
            </button>
            <button
              type="button"
              onClick={() => setFeedbackType("complaint")}
              className={`flex-1 rounded-lg py-1 text-[10px] font-bold transition ${
                feedbackType === "complaint" ? "bg-red-500/20 text-red-300" : "bg-white/5 light:bg-white text-slate-400 light:text-slate-600"
              }`}
            >
              Complaint
            </button>
          </div>
          <textarea
            value={feedbackMessage}
            onChange={(e) => setFeedbackMessage(e.target.value)}
            placeholder={feedbackType === "complaint" ? "What went wrong with this order?" : "Share your feedback..."}
            rows={2}
            className="w-full rounded-lg border border-white/10 light:border-black/10 bg-white/5 light:bg-white px-2 py-1.5 text-[11px] text-white light:text-slate-900 outline-none focus:border-orange-400/50"
          />
          {submitError && <p className="text-[10px] text-red-400">{submitError}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-orange-500 py-1.5 text-[10px] font-bold text-white transition hover:bg-orange-600 disabled:opacity-60"
          >
            {submitting ? "Sending..." : "Send"}
          </button>
        </form>
      )}

      {/* Rating Modal */}
      {ratingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-2xl relative">
            <button
              onClick={() => setRatingModalOpen(false)}
              className="absolute right-4 top-4 text-slate-500 hover:text-white"
            >
              <X size={20} />
            </button>
            
            <h3 className="text-lg font-black text-white mb-1">Rate this product</h3>
            <p className="text-xs text-slate-400 mb-5">{order.productTitle}</p>
            
            <form onSubmit={handleRateProduct}>
              <div className="flex justify-center gap-2 mb-6">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRatingStars(star)}
                    className={`p-1 transition ${star <= ratingStars ? "text-orange-400" : "text-slate-600 hover:text-orange-400/50"}`}
                  >
                    <Star size={32} fill={star <= ratingStars ? "currentColor" : "none"} />
                  </button>
                ))}
              </div>
              
              <div className="mb-4">
                <label className="text-[11px] font-bold text-slate-400 uppercase mb-1 block">Write a review (Optional)</label>
                <textarea
                  value={ratingComment}
                  onChange={(e) => setRatingComment(e.target.value)}
                  placeholder="What did you like or dislike?"
                  rows={3}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-600 outline-none focus:border-orange-400"
                />
              </div>
              
              {ratingError && <p className="text-xs text-red-400 font-bold mb-4">{ratingError}</p>}
              
              <button
                type="submit"
                disabled={submittingRating}
                className="w-full flex justify-center items-center rounded-xl bg-orange-500 py-3 text-sm font-black text-white disabled:opacity-50 transition hover:bg-orange-600"
              >
                {submittingRating ? <Loader2 size={18} className="animate-spin" /> : "Submit Review"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

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

  const handleFeedbackSubmitted = (orderId: string, updated: HammartOrder["feedback"]) => {
    setOrders((prev) => prev.map((o) => (o.orderId === orderId ? { ...o, feedback: updated } : o)));
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
      <BackButton />
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-black text-white light:text-slate-900">My Orders</h1>
        <ShopNavLinks />
      </div>
      {orders.length === 0 ? (
        <div className="mt-10 flex flex-col items-center gap-2 text-center text-sm text-slate-500">
          <Package size={26} className="text-slate-600" />
          No orders yet.
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {orders.map((o) => (
            <OrderCard key={o.orderId} order={o} onFeedbackSubmitted={handleFeedbackSubmitted} />
          ))}
        </div>
      )}
    </div>
  );
}
