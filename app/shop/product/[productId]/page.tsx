"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, ShoppingBag, IndianRupee, Store, ExternalLink, CheckCircle2, XCircle, Clock, Star, Globe, Shield, MapPin, Send, ArrowLeft, X, RefreshCw, Minus, Plus, Heart, ShoppingCart } from "lucide-react";
import { useAuthModal } from "@/app/components/auth/AuthProvider";
import { authedFetch } from "@/app/lib/apiFetch";
import {
  loadRazorpayCheckoutScript,
  postHammartCheckout,
  openHammartCheckoutForGroup,
  pollHammartOrderStatuses,
  generateUpiQrDataUrl,
} from "@/app/lib/hammartCheckoutClient";
import LocationMapPicker, { type LocationAddress } from "@/app/components/hammart/LocationMapPicker";
import IndiaLocationFields from "@/app/components/hammart/IndiaLocationFields";
import ShopNavLinks from "@/app/components/hammart/ShopNavLinks";
import type { HammartProduct } from "@/app/lib/hammartProducts";
import type { HammartOrder } from "@/app/lib/hammartOrders";
import type { HammartReview } from "@/app/lib/hammartReviews";

// "awaiting_upi" is the direct-UPI fallback for a vendor without an
// active Razorpay Route account (see app/api/hammart/checkout/route.ts) —
// no payment gateway, so there's no webhook to poll for real proof of
// payment. What IS polled instead is the order's own status row, which
// only ever changes once the vendor themselves confirms or cancels it
// (app/api/hammart/orders/[orderId]/route.ts) — "vendor_confirmed" /
// "vendor_cancelled" below are that outcome, reached the same honest way
// Hammart's direct-UPI path has always worked, just surfaced live on this
// screen instead of only on a later visit to My Orders.
type GroupStatus =
  | "opening"
  | "verifying"
  | "paid"
  | "payment_failed"
  | "dismissed"
  | "failed"
  | "unavailable"
  | "awaiting_upi"
  | "vendor_confirmed"
  | "vendor_cancelled";

interface GroupCheckoutState {
  vendorId: string;
  amountInr: number;
  status: GroupStatus;
  error?: string;
  paymentMethod?: "razorpay" | "upi";
  upiLink?: string;
  vendorUpiId?: string;
  qrDataUrl?: string;
  orderIds?: string[];
  buyerClaimed?: boolean;
  claimingPaid?: boolean;
}

export default function ProductPage() {
  const params = useParams();
  const productId = params?.productId as string;
  const { user, signedIn, openSignIn } = useAuthModal();
  const searchParams = useSearchParams();
  const router = useRouter();

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

  // "Buy Now" is always a single vendor group (one product, this
  // product's own vendor) — see app/shop/cart/page.tsx for the
  // multi-vendor version of this same flow.
  const [checkoutGroup, setCheckoutGroup] = useState<GroupCheckoutState | null>(null);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reorderPrefilled, setReorderPrefilled] = useState(false);
  const reorderHandledRef = useRef(false);

  const [buyQuantity, setBuyQuantity] = useState(1);
  const [wishlisted, setWishlisted] = useState(false);
  const [wishlistBusy, setWishlistBusy] = useState(false);
  const [addingToCart, setAddingToCart] = useState(false);
  const [addedToCart, setAddedToCart] = useState(false);
  const [cartError, setCartError] = useState<string | null>(null);

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

  // Wishlist heart's initial state — a cheap single-item check (see
  // /api/hammart/wishlist's GET, same dual-mode shape as /api/watchlist)
  // rather than fetching the buyer's entire wishlist just to check one id.
  useEffect(() => {
    (() => {
      if (!signedIn || !productId) return;
      (async () => {
        try {
          const res = await authedFetch(`/api/hammart/wishlist?productId=${encodeURIComponent(productId)}`);
          const data = await res.json().catch(() => ({}));
          setWishlisted(Boolean(data.wishlisted));
        } catch (err) {
          console.error("Failed to check wishlist status:", err);
        }
      })();
    })();
  }, [signedIn, productId]);

  const [showAddressModal, setShowAddressModal] = useState(false);
  const [buyerNameInput, setBuyerNameInput] = useState(user?.name || "");
  const [buyerEmail, setBuyerEmail] = useState(user?.email || "");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [city, setCity] = useState("");
  const [stateName, setStateName] = useState("");
  const [pincode, setPincode] = useState("");

  // "Reorder" from My Orders (/shop/orders) links here with ?reorder=1.
  // Runs at most once per page visit (reorderHandledRef) so it never
  // fights with someone mid-edit in the address modal. Pulls the buyer's
  // own most recent real order for this exact product — /api/hammart/
  // orders only ever returns the caller's own orders, never anyone
  // else's — and prefills the same modal the normal "Buy Now" button
  // opens, so price/availability are always re-checked live through the
  // exact same order-creation flow rather than assumed from the old
  // order.
  useEffect(() => {
    (() => {
      if (reorderHandledRef.current) return;
      if (!product || !signedIn) return;
      if (searchParams.get("reorder") !== "1") return;
      if (user?.userId === product.vendorUserId) return;
      reorderHandledRef.current = true;

      (async () => {
        setBuyerNameInput(user?.name || "");
        setBuyerEmail(user?.email || "");
        try {
          const res = await authedFetch("/api/hammart/orders");
          const data = await res.json().catch(() => ({}));
          const past = ((data.orders || []) as HammartOrder[]).find((o) => o.productId === productId);
          if (past) {
            setBuyerNameInput(past.buyerName || user?.name || "");
            setBuyerEmail(past.buyerEmail || user?.email || "");
            setBuyerPhone(past.buyerPhone ?? "");
            setDeliveryAddress(past.deliveryAddress ?? "");
            setCity(past.city ?? "");
            setStateName(past.state ?? "");
            setPincode(past.pincode ?? "");
            setReorderPrefilled(true);
          }
        } catch (err) {
          console.error("Failed to prefill reorder details:", err);
        } finally {
          setShowAddressModal(true);
        }
      })();
    })();
  }, [product, signedIn, searchParams, user, productId]);

  const handleBuy = async () => {
    if (!signedIn) {
      openSignIn();
      return;
    }
    setBuyerNameInput(user?.name || "");
    setBuyerEmail(user?.email || "");
    setShowAddressModal(true);
  };

  const handleAddToCart = async () => {
    if (!signedIn) {
      openSignIn();
      return;
    }
    setCartError(null);
    setAddingToCart(true);
    try {
      const res = await authedFetch("/api/hammart/cart", {
        method: "POST",
        body: JSON.stringify({ productId, quantity: buyQuantity }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCartError(data.error || "Couldn't add that to your cart.");
        return;
      }
      window.dispatchEvent(new Event("hammart-cart-updated"));
      setAddedToCart(true);
      setTimeout(() => setAddedToCart(false), 1800);
    } catch (err) {
      console.error("Failed to add to cart:", err);
      setCartError("Something went wrong. Please try again.");
    } finally {
      setAddingToCart(false);
    }
  };

  const toggleWishlist = async () => {
    if (!signedIn) {
      openSignIn();
      return;
    }
    setWishlistBusy(true);
    try {
      if (wishlisted) {
        await authedFetch(`/api/hammart/wishlist/${productId}`, { method: "DELETE" });
        setWishlisted(false);
      } else {
        const res = await authedFetch("/api/hammart/wishlist", {
          method: "POST",
          body: JSON.stringify({ productId }),
        });
        if (res.ok) setWishlisted(true);
      }
    } catch (err) {
      console.error("Failed to update wishlist:", err);
    } finally {
      setWishlistBusy(false);
    }
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

  const updateCheckoutStatus = (status: GroupStatus, error?: string) => {
    setCheckoutGroup((prev) => (prev ? { ...prev, status, error } : prev));
  };

  // Direct-UPI path only. Reuses the same polling helper the Razorpay path
  // already uses, just against a much longer budget — a vendor manually
  // checking their own UPI app realistically takes minutes, not the ~36s
  // Razorpay's near-instant Route settlement is tuned for. If the budget
  // runs out before the vendor confirms, this leaves the screen exactly as
  // it was (still "awaiting_upi", QR still valid) — never shown as an
  // error, since nothing actually failed, it's just not confirmed yet. The
  // buyer can always leave and check My Orders later; nothing here blocks
  // that.
  const pollUpiVendorConfirmation = async (orderIds: string[]) => {
    if (orderIds.length === 0) return;
    const statuses = await pollHammartOrderStatuses({
      authedFetch,
      orderIds,
      maxAttempts: 40,
      intervalMs: 5000, // ~200s total
      pendingStatus: "placed", // direct-UPI orders start here, not "payment_pending"
    });
    const values = Object.values(statuses);
    if (values.some((s) => s === "vendor_cancelled")) {
      updateCheckoutStatus("vendor_cancelled");
    } else if (values.length > 0 && values.every((s) => s === "vendor_confirmed")) {
      updateCheckoutStatus("vendor_confirmed");
    }
    // Otherwise: still "placed" for at least one order in the group —
    // leave the UI exactly as it is.
  };

  // "I've completed this payment" — a nudge, not a payment confirmation.
  // See app/api/hammart/orders/mark-buyer-paid/route.ts's header comment:
  // this only emails the vendor to check sooner, it never changes the
  // order's real status on its own.
  const handleClaimBuyerPaid = async () => {
    if (!checkoutGroup?.orderIds?.length || checkoutGroup.buyerClaimed) return;
    setCheckoutGroup((prev) => (prev ? { ...prev, claimingPaid: true } : prev));
    try {
      await authedFetch("/api/hammart/orders/mark-buyer-paid", {
        method: "POST",
        body: JSON.stringify({ orderIds: checkoutGroup.orderIds }),
      });
    } catch (err) {
      console.error("Failed to notify vendor of claimed payment:", err);
    } finally {
      setCheckoutGroup((prev) => (prev ? { ...prev, buyerClaimed: true, claimingPaid: false } : prev));
    }
  };

  // Once this single-vendor "Buy Now" checkout reaches a real success
  // state — Razorpay's webhook-verified "paid", or the vendor's own
  // "vendor_confirmed" on the direct-UPI path — take the buyer back to
  // their order list automatically instead of leaving them stuck staring
  // at a QR code or a spinner that already did its job.
  useEffect(() => {
    if (checkoutGroup?.status !== "paid" && checkoutGroup?.status !== "vendor_confirmed") return;
    const timer = setTimeout(() => router.push("/shop/orders"), 2500);
    return () => clearTimeout(timer);
  }, [checkoutGroup?.status, router]);

  // Checkout for a single-product "Buy Now" — same underlying flow as
  // app/shop/cart/page.tsx's multi-vendor version (see
  // app/api/hammart/checkout/route.ts): either a real Razorpay Checkout
  // popup (status only ever becomes "paid" from polling the
  // webhook-verified result, never from Checkout's own client-side
  // callback) or, for a vendor without an active Razorpay account, a
  // direct UPI QR/link with no gateway involved at all.
  const handleConfirmOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deliveryAddress.trim() || !buyerPhone.trim()) {
      setError("Please provide your phone number and delivery address.");
      return;
    }

    setError(null);
    setPlacing(true);

    let response;
    try {
      response = await postHammartCheckout({
        authedFetch,
        items: [{ productId, quantity: buyQuantity }],
        buyerName: buyerNameInput,
        buyerEmail,
        buyerPhone,
        deliveryAddress,
        city,
        state: stateName,
        pincode,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't start checkout right now.");
      setPlacing(false);
      return;
    }

    setShowAddressModal(false);
    setPlacing(false);

    const group = response.groups[0];
    if (!group || !group.success) {
      setError(group?.error || response.failedItems[0]?.error || "Couldn't place your order.");
      return;
    }

    if (group.paymentMethod === "upi") {
      setCheckoutGroup({
        vendorId: group.vendorId,
        amountInr: group.amountInr || 0,
        status: "awaiting_upi",
        paymentMethod: "upi",
        upiLink: group.upiLink,
        vendorUpiId: group.vendorUpiId,
        orderIds: group.orderIds,
      });
      if (group.upiLink) {
        const qrDataUrl = await generateUpiQrDataUrl(group.upiLink);
        setCheckoutGroup((prev) => (prev ? { ...prev, qrDataUrl } : prev));
      }
      // No gateway, so no webhook — poll the order's own status instead,
      // which only ever changes once the vendor confirms or cancels it
      // (see GroupStatus's comment above). This is what lets this screen
      // reach a real "Order placed!" state on its own once that happens,
      // rather than only ever showing the QR forever.
      void pollUpiVendorConfirmation(group.orderIds || []);
      return;
    }

    try {
      await loadRazorpayCheckoutScript();
    } catch {
      setCheckoutGroup({ vendorId: group.vendorId, amountInr: group.amountInr || 0, status: "unavailable" });
      return;
    }

    setCheckoutGroup({ vendorId: group.vendorId, amountInr: group.amountInr || 0, status: "opening", paymentMethod: "razorpay" });

    const outcome = await openHammartCheckoutForGroup(group, { buyerName: buyerNameInput, buyerEmail, buyerPhone });
    if (outcome === "dismissed") {
      updateCheckoutStatus("dismissed");
      return;
    }
    if (outcome === "unavailable") {
      updateCheckoutStatus("unavailable");
      return;
    }

    updateCheckoutStatus("verifying");
    const statuses = await pollHammartOrderStatuses({ authedFetch, orderIds: group.orderIds || [] });
    const values = Object.values(statuses);
    if (values.every((s) => s === "paid")) {
      updateCheckoutStatus("paid");
    } else if (values.some((s) => s === "payment_failed")) {
      updateCheckoutStatus("payment_failed");
    } else {
      updateCheckoutStatus("verifying");
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

  const isOwnListing = user?.userId === product.vendorUserId;

  return (
    <div className="mx-auto max-w-4xl px-6 py-6 text-white light:text-slate-900">
      {/* Prominent Back Button + Orders/Wishlist/Cart quick nav */}
      <div className="mb-6 flex items-center justify-between gap-3">
        <Link
          href="/shop"
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 light:border-slate-300 bg-white/5 light:bg-white px-3.5 py-2 text-xs font-bold text-slate-200 light:text-slate-800 light:shadow-sm transition hover:bg-white/10 hover:border-orange-400/40"
        >
          <ArrowLeft size={16} className="text-orange-400" />
          Back to Store
        </Link>
        <ShopNavLinks />
      </div>

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
            ) : product && product.stockQuantity !== undefined && product.stockQuantity <= 0 ? (
              <div className="flex flex-col gap-2">
                <span className="self-start rounded-md bg-red-500/10 px-3 py-1.5 text-xs font-bold text-red-500">
                  Out of Stock
                </span>
                <p className="text-xs text-slate-400">This item is currently unavailable.</p>
              </div>
            ) : !checkoutGroup ? (
              <>
                <div className="flex items-center gap-3">
                  <div className="flex items-center rounded-xl border border-white/10 light:border-slate-300 bg-white/5 light:bg-white light:shadow-sm">
                    <button
                      type="button"
                      onClick={() => setBuyQuantity((q) => Math.max(1, q - 1))}
                      className="flex h-10 w-10 items-center justify-center text-slate-300 light:text-slate-700 hover:text-orange-400 light:hover:text-orange-600"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="w-8 text-center text-sm font-bold text-white light:text-slate-900">{buyQuantity}</span>
                    <button
                      type="button"
                      onClick={() => {
                        const maxQty = product?.stockQuantity ? Math.min(20, product.stockQuantity) : 20;
                        setBuyQuantity((q) => Math.min(maxQty, q + 1));
                      }}
                      className="flex h-10 w-10 items-center justify-center text-slate-300 light:text-slate-700 hover:text-orange-400 light:hover:text-orange-600"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={toggleWishlist}
                    disabled={wishlistBusy}
                    title={wishlisted ? "Remove from wishlist" : "Save to wishlist"}
                    className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border transition disabled:opacity-60 ${
                      wishlisted
                        ? "border-red-400/40 bg-red-500/10 text-red-400"
                        : "border-white/10 light:border-slate-300 bg-white/5 light:bg-white light:shadow-sm text-slate-300 light:text-slate-700"
                    }`}
                  >
                    <Heart size={16} className={wishlisted ? "fill-red-400" : ""} />
                  </button>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={handleAddToCart}
                    disabled={addingToCart}
                    className="flex items-center justify-center gap-2 rounded-2xl border border-orange-400/40 bg-orange-500/10 py-3.5 text-sm font-black text-orange-300 transition hover:bg-orange-500/20 disabled:opacity-60"
                  >
                    {addingToCart ? <Loader2 size={18} className="animate-spin" /> : <ShoppingCart size={18} />}
                    {addedToCart ? "Added ✓" : addingToCart ? "Adding..." : "Add to Cart"}
                  </button>
                  <button
                    type="button"
                    onClick={handleBuy}
                    disabled={placing}
                    className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] py-3.5 text-sm font-black text-slate-950 shadow-lg shadow-orange-500/25 transition hover:brightness-110 active:scale-[0.99] disabled:opacity-60"
                  >
                    {placing ? <Loader2 size={18} className="animate-spin" /> : <ShoppingBag size={18} />}
                    {placing ? "Placing order..." : "Buy Now"}
                  </button>
                </div>
              </>
            ) : null}
            {error && <p className="mt-2 text-xs font-bold text-red-400 text-center">{error}</p>}
            {cartError && <p className="mt-2 text-xs font-bold text-red-400 text-center">{cartError}</p>}
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

      {checkoutGroup && (
        <div
          className={`mt-8 rounded-2xl border p-5 text-center ${
            checkoutGroup.status === "paid" || checkoutGroup.status === "vendor_confirmed"
              ? "border-emerald-400/20 bg-emerald-500/[0.05]"
              : checkoutGroup.status === "payment_failed" ||
                checkoutGroup.status === "failed" ||
                checkoutGroup.status === "unavailable" ||
                checkoutGroup.status === "vendor_cancelled"
              ? "border-red-400/20 bg-red-500/[0.05]"
              : "border-orange-400/20 bg-orange-500/[0.05]"
          }`}
        >
          {checkoutGroup.status === "paid" ? (
            <>
              <CheckCircle2 size={22} className="mx-auto text-emerald-400" />
              <p className="mt-2 text-sm font-bold text-white light:text-slate-900">Payment confirmed — {checkoutGroup.vendorId} has been notified</p>
              <p className="mt-1 text-lg font-black text-orange-400">₹{checkoutGroup.amountInr.toLocaleString("en-IN")}</p>
              <p className="mt-2 text-[11px] text-slate-500">Order placed! Taking you to My Orders…</p>
            </>
          ) : checkoutGroup.status === "vendor_confirmed" ? (
            <>
              <CheckCircle2 size={22} className="mx-auto text-emerald-400" />
              <p className="mt-2 text-sm font-bold text-white light:text-slate-900">Order placed! {checkoutGroup.vendorId} confirmed your payment</p>
              <p className="mt-1 text-lg font-black text-orange-400">₹{checkoutGroup.amountInr.toLocaleString("en-IN")}</p>
              <p className="mt-2 text-[11px] text-slate-500">Taking you to My Orders…</p>
            </>
          ) : checkoutGroup.status === "vendor_cancelled" ? (
            <>
              <XCircle size={22} className="mx-auto text-red-400" />
              <p className="mt-2 text-sm font-bold text-white light:text-slate-900">{checkoutGroup.vendorId} cancelled this order</p>
              <p className="mt-1 text-xs text-slate-400">
                If you already paid via UPI and haven&apos;t heard about a refund, contact the seller directly.
              </p>
            </>
          ) : checkoutGroup.status === "awaiting_upi" ? (
            <>
              <p className="text-sm font-bold text-white light:text-slate-900">Pay {checkoutGroup.vendorId} directly</p>
              <p className="mt-1 text-lg font-black text-orange-400">₹{checkoutGroup.amountInr.toLocaleString("en-IN")}</p>
              {checkoutGroup.qrDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={checkoutGroup.qrDataUrl} alt="UPI QR code" className="mx-auto mt-3 h-40 w-40 rounded-xl bg-white p-2" />
              ) : (
                <Loader2 size={20} className="mx-auto mt-3 animate-spin text-amber-400" />
              )}
              <p className="mt-2 text-xs text-slate-400">
                UPI ID: <span className="font-mono">{checkoutGroup.vendorUpiId}</span>
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                This seller hasn&apos;t set up automatic payments yet — scan the QR or use the UPI ID above to pay them
                directly. They&apos;ll confirm your order once payment arrives.
              </p>

              {checkoutGroup.buyerClaimed ? (
                <p className="mt-3 flex items-center justify-center gap-1.5 text-xs font-semibold text-sky-300">
                  <Loader2 size={13} className="animate-spin" /> We&apos;ve let {checkoutGroup.vendorId} know — confirming your payment…
                </p>
              ) : (
                <button
                  type="button"
                  disabled={checkoutGroup.claimingPaid}
                  onClick={handleClaimBuyerPaid}
                  className="mt-3 rounded-xl bg-orange-500/15 px-4 py-2 text-xs font-bold text-orange-300 transition hover:bg-orange-500/25 disabled:opacity-60"
                >
                  {checkoutGroup.claimingPaid ? "Notifying…" : "I've completed this payment"}
                </button>
              )}
              <p className="mt-2 text-[10px] text-slate-600">
                This page will update automatically once {checkoutGroup.vendorId} confirms — feel free to leave and
                check My Orders anytime.
              </p>
            </>
          ) : checkoutGroup.status === "opening" || checkoutGroup.status === "verifying" ? (
            <>
              <Loader2 size={22} className="mx-auto animate-spin text-orange-400" />
              <p className="mt-2 text-sm font-bold text-white light:text-slate-900">
                {checkoutGroup.status === "opening" ? "Opening payment…" : "Confirming your payment…"}
              </p>
            </>
          ) : checkoutGroup.status === "dismissed" ? (
            <>
              <Clock size={22} className="mx-auto text-amber-400" />
              <p className="mt-2 text-sm font-bold text-white light:text-slate-900">Payment not completed</p>
              <p className="mt-1 text-xs text-slate-400">Your order is saved as awaiting payment — retry anytime from My Orders.</p>
            </>
          ) : (
            <>
              <XCircle size={22} className="mx-auto text-red-400" />
              <p className="mt-2 text-sm font-bold text-red-300">{checkoutGroup.error || "Payment failed — please try again."}</p>
            </>
          )}
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
                  className="rounded-full p-1 text-slate-400 light:text-slate-600 hover:text-white light:hover:text-slate-900 transition mr-1"
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
              {reorderPrefilled && (
                <p className="flex items-center gap-1.5 rounded-lg bg-orange-500/10 px-2.5 py-2 text-[11px] font-semibold text-orange-300">
                  <RefreshCw size={12} className="flex-shrink-0" /> Prefilled from your last order — feel free to edit.
                </p>
              )}
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
                <IndiaLocationFields
                  state={stateName}
                  city={city}
                  onStateChange={setStateName}
                  onCityChange={setCity}
                />
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

