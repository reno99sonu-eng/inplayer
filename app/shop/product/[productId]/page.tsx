"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import QRCode from "qrcode";
import Link from "next/link";
import { Loader2, ShoppingBag, IndianRupee, Store, ExternalLink, CheckCircle2, AlertTriangle, Star, Globe, Shield, MapPin, Send, ArrowLeft, X } from "lucide-react";
import { useAuthModal } from "@/app/components/auth/AuthProvider";
import { authedFetch } from "@/app/lib/apiFetch";
import { buildUpiLink } from "@/app/lib/upi";
import LocationMapPicker, { type LocationAddress } from "@/app/components/hammart/LocationMapPicker";
import type { HammartProduct } from "@/app/lib/hammartProducts";
import type { HammartOrder } from "@/app/lib/hammartOrders";
import type { HammartReview } from "@/app/lib/hammartReviews";

export default function ProductPage() {
  const params = useParams();
  const productId = params?.productId as string;
  const { user, signedIn, openSignIn } = useAuthModal();

  const [product, setProduct] = useState<HammartProduct | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [reviews, setReviews] = useState<HammartReview[]>([]);
  // 0, not 5.0 — a product starts with NO real ratings, and the badge
  // below renders "No ratings yet" instead of stars until totalReviews > 0.
  const [avgRating, setAvgRating] = useState(0);
  const [totalReviews, setTotalReviews] = useState(0);
  const [userRating, setUserRating] = useState(5);
  const [userComment, setUserComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const [order, setOrder] = useState<HammartOrder | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showMapPicker, setShowMapPicker] = useState(false);

  useEffect(() => {
    if (!productId) return;
    (async () => {
      try {
        const [prodRes, revRes] = await Promise.all([
          fetch(`/api/hammart/products/${productId}`),
          fetch(`/api/hammart/products/${productId}/reviews`),
        ]);

        if (!prodRes.ok) {
          setNotFound(true);
          return;
        }
        const prodData = await prodRes.json();
        setProduct(prodData.product || null);

        if (revRes.ok) {
          const revData = await revRes.json();
          setReviews(revData.reviews || []);
          // `??` (not `||`) — a genuine average of 0 must not get
          // overwritten by the fallback, only a missing/undefined value
          // should.
          setAvgRating(revData.averageRating ?? 0);
          setTotalReviews(revData.totalReviews || 0);
        }
      } catch (err) {
        console.error("Failed to load product details:", err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [productId]);

  const [showAddressModal, setShowAddressModal] = useState(false);
  const [buyerNameInput, setBuyerNameInput] = useState(user?.name || "");
  const [buyerEmail, setBuyerEmail] = useState(user?.email || "");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [city, setCity] = useState("");
  const [stateName, setStateName] = useState("");
  const [pincode, setPincode] = useState("");

  const handleBuy = async () => {
    if (!signedIn) {
      openSignIn();
      return;
    }
    setBuyerNameInput(user?.name || "");
    setBuyerEmail(user?.email || "");
    setShowAddressModal(true);
  };

  const handleAddressFromMap = (addr: LocationAddress) => {
    setDeliveryAddress(addr.formattedAddress);
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signedIn) {
      openSignIn();
      return;
    }
    if (!userComment.trim()) {
      setReviewError("Please write a short feedback comment.");
      return;
    }

    setReviewError(null);
    setSubmittingReview(true);
    try {
      const res = await authedFetch(`/api/hammart/products/${productId}/reviews`, {
        method: "POST",
        body: JSON.stringify({ rating: userRating, comment: userComment.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setReviewError(data.error || "Failed to post review.");
        return;
      }
      if (data.review) {
        setReviews((prev) => [data.review, ...prev]);
        const newTotal = totalReviews + 1;
        setTotalReviews(newTotal);
        setAvgRating(Math.round(((avgRating * totalReviews + userRating) / newTotal) * 10) / 10);
      }
      setUserComment("");
    } catch (err) {
      console.error("Failed to submit review:", err);
      setReviewError("Something went wrong. Please try again.");
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleConfirmOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deliveryAddress.trim() || !buyerPhone.trim()) {
      setError("Please provide your phone number and delivery address.");
      return;
    }

    setError(null);
    setPlacing(true);
    try {
      const res = await authedFetch("/api/hammart/orders", {
        method: "POST",
        body: JSON.stringify({
          productId,
          buyerName: buyerNameInput,
          buyerPhone,
          deliveryAddress,
          city,
          state: stateName,
          pincode,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Couldn't place your order.");
        return;
      }
      setOrder(data.order);
      setShowAddressModal(false);
      const link = buildUpiLink({
        vpa: data.order.vendorUpiId,
        payeeName: data.order.vendorId,
        amountInr: data.order.priceInr,
        note: data.order.productTitle,
      });
      try {
        setQrDataUrl(await QRCode.toDataURL(link, { width: 240, margin: 1 }));
      } catch (err) {
        console.error("QR generation failed:", err);
      }
    } catch (err) {
      console.error("Failed to place order:", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setPlacing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 size={24} className="animate-spin text-orange-400" />
      </div>
    );
  }

  if (notFound || !product) {
    return (
      <div className="mx-auto max-w-md px-6 py-16 text-center">
        <ShoppingBag size={28} className="mx-auto text-slate-500 light:text-slate-600" />
        <p className="mt-3 text-sm font-semibold text-slate-400 light:text-slate-700">This listing isn&apos;t available.</p>
        <Link href="/shop" className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-orange-400 underline">
          <ArrowLeft size={14} /> Back to HamMart
        </Link>
      </div>
    );
  }

  const photos = product.imageUrls && product.imageUrls.length > 0 ? product.imageUrls : (product.imageUrl ? [product.imageUrl] : []);
  const activePhoto = photos[activeImageIndex] || product.imageUrl;

  const upiLink = order ? buildUpiLink({ vpa: order.vendorUpiId, payeeName: order.vendorId, amountInr: order.priceInr, note: order.productTitle }) : null;
  const isOwnListing = user?.userId === product.vendorUserId;

  return (
    <div className="mx-auto max-w-4xl px-6 py-6 text-white light:text-slate-900">
      {/* Prominent Back Button */}
      <Link
        href="/shop"
        className="mb-6 inline-flex items-center gap-2 rounded-xl border border-white/10 light:border-slate-300 bg-white/5 light:bg-white px-3.5 py-2 text-xs font-bold text-slate-200 light:text-slate-800 light:shadow-sm transition hover:bg-white/10 hover:border-orange-400/40"
      >
        <ArrowLeft size={16} className="text-orange-400" />
        Back to Store
      </Link>

      <div className="grid gap-8 md:grid-cols-2">
        {/* Multi-Photo Carousel Gallery */}
        <div className="space-y-3">
          <div className="aspect-square overflow-hidden rounded-3xl border border-white/10 light:border-slate-300 bg-black/40 light:bg-slate-100 shadow-xl light:shadow-sm">
            {activePhoto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={activePhoto} alt={product.title} className="h-full w-full object-cover transition-all duration-300" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-slate-500">
                <ShoppingBag size={48} />
              </div>
            )}
          </div>

          {photos.length > 1 && (
            <div className="flex gap-2.5 overflow-x-auto pb-1">
              {photos.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveImageIndex(idx)}
                  className={`h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl border-2 transition ${
                    activeImageIndex === idx ? "border-orange-400 scale-105" : "border-white/10 light:border-slate-300 opacity-70 hover:opacity-100"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p} alt={`Thumb ${idx + 1}`} className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product Details Header */}
        <div className="flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-xs font-bold text-orange-400 light:text-orange-600">
                <Store size={13} /> {product.vendorId}
              </p>
              <span className="rounded-full bg-white/5 light:bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-300 light:text-slate-800 border border-white/10 light:border-slate-300">
                {product.category}
              </span>
            </div>

            <h1 className="mt-2 text-2xl font-black text-white light:text-slate-900">{product.title}</h1>

            {/* Star Rating Badge — an honest "no ratings yet" state
                instead of a hollow 5-star badge when nobody has actually
                reviewed this product. */}
            <div className="mt-2 flex items-center gap-2">
              {totalReviews > 0 ? (
                <>
                  <div className="flex items-center text-amber-400">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star key={star} size={15} className={star <= Math.round(avgRating) ? "fill-amber-400" : "text-slate-600 light:text-slate-400"} />
                    ))}
                  </div>
                  <span className="text-xs font-bold text-slate-200 light:text-slate-900">{avgRating.toFixed(1)}</span>
                  <span className="text-xs font-bold text-slate-400 light:text-slate-700">({totalReviews} ratings)</span>
                </>
              ) : (
                <span className="text-xs font-bold text-slate-400 light:text-slate-700">No ratings yet</span>
              )}
            </div>

            <p className="mt-3 flex items-center gap-1 text-3xl font-black text-orange-400 light:text-orange-600">
              <IndianRupee size={24} /> {product.priceInr.toLocaleString("en-IN")}
            </p>

            {/* HS Code & Country of Origin Badges */}
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <div className="flex items-center gap-1 rounded-xl bg-white/5 light:bg-white px-3 py-1.5 border border-white/10 light:border-slate-300 text-slate-300 light:text-slate-900 light:shadow-sm">
                <Globe size={13} className="text-sky-400 light:text-sky-600" />
                <span className="text-slate-400 light:text-slate-700 font-semibold">Origin:</span>
                <span className="font-bold">{product.countryOfOrigin || "India"}</span>
              </div>

              {product.hsCode && (
                <div className="flex items-center gap-1 rounded-xl bg-white/5 light:bg-white px-3 py-1.5 border border-white/10 light:border-slate-300 text-slate-300 light:text-slate-900 light:shadow-sm">
                  <Shield size={13} className="text-emerald-400 light:text-emerald-600" />
                  <span className="text-slate-400 light:text-slate-700 font-semibold">HS Code:</span>
                  <span className="font-mono font-bold">{product.hsCode}</span>
                </div>
              )}
            </div>

            <div className="mt-4">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 light:text-slate-700">Overview</h4>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-200 light:text-slate-800 font-medium">{product.description}</p>
            </div>

            {product.details && (
              <div className="mt-4 rounded-2xl border border-white/10 light:border-slate-300 bg-white/[0.02] light:bg-white p-3.5 light:shadow-sm">
                <h4 className="text-xs font-black uppercase tracking-wider text-orange-400 light:text-orange-600">Product Details & Specs</h4>
                <p className="mt-1.5 whitespace-pre-wrap text-xs leading-relaxed text-slate-200 light:text-slate-800 font-medium">{product.details}</p>
              </div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-white/10 light:border-slate-300">
            {isOwnListing ? (
              <p className="text-xs font-semibold text-slate-500 light:text-slate-700">This is your own listing.</p>
            ) : !order ? (
              <button
                type="button"
                onClick={handleBuy}
                disabled={placing}
                className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] py-3.5 text-sm font-black text-slate-950 shadow-lg shadow-orange-500/25 transition hover:brightness-110 active:scale-[0.99] disabled:opacity-60"
              >
                {placing ? <Loader2 size={18} className="animate-spin" /> : <ShoppingBag size={18} />}
                {placing ? "Placing order..." : "Buy Now"}
              </button>
            ) : null}
            {error && <p className="mt-2 text-xs font-bold text-red-400 text-center">{error}</p>}
          </div>
        </div>
      </div>

      {/* Swiggy Instamart Style Customer Reviews & Ratings Section */}
      <div className="mt-12 rounded-3xl border border-white/10 light:border-slate-300 bg-white/[0.02] light:bg-white p-6 light:shadow-sm">
        <h3 className="text-lg font-black text-white light:text-slate-900 flex items-center gap-2">
          <Star className="text-amber-400 fill-amber-400" size={20} />
          Customer Feedback & Ratings
        </h3>

        {/* Submit Review Form */}
        <form onSubmit={handleSubmitReview} className="mt-4 rounded-2xl border border-white/10 light:border-slate-300 bg-black/20 light:bg-slate-50 p-4">
          <span className="text-xs font-bold text-slate-200 light:text-slate-900 block mb-2">Write a review for this product</span>
          <div className="flex items-center gap-1.5 mb-3">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setUserRating(star)}
                className="transition transform hover:scale-110"
              >
                <Star size={20} className={star <= userRating ? "fill-amber-400 text-amber-400" : "text-slate-600 light:text-slate-400"} />
              </button>
            ))}
            <span className="ml-2 text-xs font-bold text-amber-500 light:text-amber-700">{userRating} / 5 Stars</span>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={userComment}
              onChange={(e) => setUserComment(e.target.value)}
              placeholder="Share your feedback about item quality, delivery, etc."
              className="flex-1 rounded-xl border border-white/10 light:border-slate-300 bg-white/5 light:bg-white px-3.5 py-2 text-xs text-white light:text-slate-900 outline-none focus:border-orange-400 placeholder:text-slate-400 light:placeholder:text-slate-600 font-medium"
            />
            <button
              type="submit"
              disabled={submittingReview}
              className="flex items-center gap-1 rounded-xl bg-orange-500 px-4 py-2 text-xs font-bold text-white hover:bg-orange-600 transition disabled:opacity-50"
            >
              {submittingReview ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Post
            </button>
          </div>
          {reviewError && <p className="mt-2 text-xs font-bold text-red-400">{reviewError}</p>}
        </form>

        {/* Reviews List */}
        <div className="mt-6 space-y-3">
          {reviews.length === 0 ? (
            <p className="text-xs font-semibold text-slate-400 light:text-slate-700 italic">No reviews yet — be the first to rate this product after purchase!</p>
          ) : (
            reviews.map((r) => (
              <div key={r.reviewId} className="rounded-xl border border-white/5 light:border-slate-200 bg-white/[0.03] light:bg-slate-50 p-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-200 light:text-slate-900">{r.userName}</span>
                  <div className="flex items-center text-amber-400">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star key={star} size={12} className={star <= r.rating ? "fill-amber-400" : "text-slate-700 light:text-slate-400"} />
                    ))}
                  </div>
                </div>
                <p className="mt-1 text-slate-300 light:text-slate-800 font-medium leading-relaxed">{r.comment}</p>
                <span className="mt-1 block text-[10px] text-slate-500 light:text-slate-600 font-semibold">{new Date(r.createdAt).toLocaleDateString()}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {order && (
        <div className="mt-8 rounded-2xl border border-orange-400/20 bg-orange-500/[0.05] p-5 text-center">
          <CheckCircle2 size={22} className="mx-auto text-emerald-400" />
          <p className="mt-2 text-sm font-bold text-white light:text-slate-900">Order placed — pay {order.vendorId} directly</p>
          {qrDataUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrDataUrl} alt="UPI QR code" className="mx-auto mt-4 h-48 w-48 rounded-xl bg-white p-2" />
          )}
          <p className="mt-3 text-xs text-slate-400">
            Scan with any UPI app, or{" "}
            <a href={upiLink || "#"} className="font-semibold text-orange-300 underline">
              tap to open your UPI app
            </a>
            . UPI ID: <span className="font-mono">{order.vendorUpiId}</span>
          </p>
          <a
            href="/shop/orders"
            className="mt-4 flex items-center justify-center gap-1 text-xs font-semibold text-orange-300 hover:text-orange-200"
          >
            View my orders <ExternalLink size={11} />
          </a>
        </div>
      )}

      {/* Shipping Address Modal */}
      {showAddressModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
          <div className="w-full max-w-md rounded-3xl border border-white/15 light:border-slate-300 bg-slate-900 light:bg-white p-6 shadow-2xl text-white light:text-slate-900">
            <div className="flex items-center justify-between border-b border-white/10 light:border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddressModal(false)}
                  className="rounded-full p-1 text-slate-400 hover:text-white light:hover:text-slate-900 transition mr-1"
                  title="Back"
                >
                  <ArrowLeft size={18} />
                </button>
                <ShoppingBag className="text-orange-400" size={20} />
                <h3 className="text-lg font-black text-white light:text-slate-900">
                  Shipping & Delivery Details
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddressModal(false)}
                className="rounded-full p-1.5 text-slate-400 light:text-slate-600 transition hover:bg-white/10 light:hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleConfirmOrder} className="mt-4 space-y-3">
              <div>
                <label className="text-[11px] font-bold text-slate-300 light:text-slate-800 uppercase">Full Name</label>
                <input
                  type="text"
                  required
                  value={buyerNameInput}
                  onChange={(e) => setBuyerNameInput(e.target.value)}
                  placeholder="Your Name"
                  className="mt-1 w-full rounded-xl border border-white/10 light:border-slate-300 bg-white/5 light:bg-white px-3 py-2 text-xs text-white light:text-slate-900 placeholder:text-slate-500 light:placeholder:text-slate-600 outline-none focus:border-orange-400 font-medium"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-300 light:text-slate-800 uppercase">Customer Email Address</label>
                <input
                  type="email"
                  required
                  value={buyerEmail}
                  onChange={(e) => setBuyerEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="mt-1 w-full rounded-xl border border-white/10 light:border-slate-300 bg-white/5 light:bg-white px-3 py-2 text-xs text-white light:text-slate-900 placeholder:text-slate-500 light:placeholder:text-slate-600 outline-none focus:border-orange-400 font-medium"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-300 light:text-slate-800 uppercase">Phone / Mobile Number</label>
                <input
                  type="tel"
                  required
                  value={buyerPhone}
                  onChange={(e) => setBuyerPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="mt-1 w-full rounded-xl border border-white/10 light:border-slate-300 bg-white/5 light:bg-white px-3 py-2 text-xs text-white light:text-slate-900 placeholder:text-slate-500 light:placeholder:text-slate-600 outline-none focus:border-orange-400 font-medium"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-slate-300 light:text-slate-800 uppercase">Delivery Address</label>
                  <button
                    type="button"
                    onClick={() => setShowMapPicker(true)}
                    className="flex items-center gap-1 text-[11px] font-bold text-orange-400 light:text-orange-600 hover:underline"
                  >
                    <MapPin size={12} /> Auto-Detect Map
                  </button>
                </div>
                <textarea
                  required
                  rows={2}
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  placeholder="House/Flat No., Street, Landmark"
                  className="w-full rounded-xl border border-white/10 light:border-slate-300 bg-white/5 light:bg-white px-3 py-2 text-xs text-white light:text-slate-900 placeholder:text-slate-500 light:placeholder:text-slate-600 outline-none focus:border-orange-400 font-medium"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-300 light:text-slate-800 uppercase">City</label>
                  <input
                    type="text"
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="City"
                    className="mt-1 w-full rounded-xl border border-white/10 light:border-slate-300 bg-white/5 light:bg-white px-3 py-2 text-xs text-white light:text-slate-900 placeholder:text-slate-500 light:placeholder:text-slate-600 outline-none focus:border-orange-400 font-medium"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-300 light:text-slate-800 uppercase">State</label>
                  <input
                    type="text"
                    required
                    value={stateName}
                    onChange={(e) => setStateName(e.target.value)}
                    placeholder="State"
                    className="mt-1 w-full rounded-xl border border-white/10 light:border-slate-300 bg-white/5 light:bg-white px-3 py-2 text-xs text-white light:text-slate-900 placeholder:text-slate-500 light:placeholder:text-slate-600 outline-none focus:border-orange-400 font-medium"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-300 light:text-slate-800 uppercase">Pincode</label>
                  <input
                    type="text"
                    required
                    value={pincode}
                    onChange={(e) => setPincode(e.target.value)}
                    placeholder="110001"
                    className="mt-1 w-full rounded-xl border border-white/10 light:border-slate-300 bg-white/5 light:bg-white px-3 py-2 text-xs text-white light:text-slate-900 placeholder:text-slate-500 light:placeholder:text-slate-600 outline-none focus:border-orange-400 font-medium"
                  />
                </div>
              </div>

              {error && <p className="text-xs font-bold text-red-400">{error}</p>}

              <div className="mt-5 flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddressModal(false)}
                  className="flex-1 rounded-xl border border-white/10 light:border-slate-300 bg-white/5 light:bg-slate-100 py-2.5 text-xs font-bold text-slate-300 light:text-slate-800 hover:bg-white/10 light:hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={placing}
                  className="flex-1 rounded-xl bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] py-2.5 text-xs font-black text-slate-950 disabled:opacity-50 shadow-md shadow-orange-500/20"
                >
                  {placing ? "Sending..." : "Confirm Order"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Location Map Picker Modal */}
      {showMapPicker && (
        <LocationMapPicker
          onSelectAddress={handleAddressFromMap}
          onClose={() => setShowMapPicker(false)}
        />
      )}
    </div>
  );
}

