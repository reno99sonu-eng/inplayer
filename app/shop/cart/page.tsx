"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, ShoppingCart, IndianRupee, Minus, Plus, Trash2, Store, ArrowLeft, CheckCircle2, XCircle, Clock, X, MapPin } from "lucide-react";
import { useAuthModal } from "@/app/components/auth/AuthProvider";
import { authedFetch } from "@/app/lib/apiFetch";
import {
  loadRazorpayCheckoutScript,
  postHammartCheckout,
  openHammartCheckoutForGroup,
  pollHammartOrderStatuses,
  generateUpiQrDataUrl,
  type CheckoutGroupResult,
} from "@/app/lib/hammartCheckoutClient";
import LocationMapPicker, { type LocationAddress } from "@/app/components/hammart/LocationMapPicker";
import IndiaLocationFields from "@/app/components/hammart/IndiaLocationFields";
import ShopNavLinks from "@/app/components/hammart/ShopNavLinks";
import type { HammartProduct } from "@/app/lib/hammartProducts";

interface CartLineItem {
  productId: string;
  quantity: number;
  addedAt: string;
  product: HammartProduct | null;
  unavailable: boolean;
}

// One entry per vendor group in the checkout attempt — a multi-vendor
// cart is one payment per seller (see app/api/hammart/checkout/route.ts),
// not one per product line. Which kind of payment depends on that
// vendor: "awaiting_upi" is the direct-UPI fallback — no payment gateway,
// so instead of polling a webhook, this polls the order's own status,
// which only changes once the vendor confirms or cancels it
// (app/api/hammart/orders/[orderId]/route.ts). "vendor_confirmed" /
// "vendor_cancelled" are that real outcome, not a client-side guess.
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

// A checkout attempt is "done" once nothing is still actively in flight —
// used both to decide when it's safe to auto-navigate away, and to gate
// that navigation on at least one group actually having succeeded.
function isTerminalGroupStatus(status: GroupStatus): boolean {
  return status !== "opening" && status !== "verifying" && status !== "awaiting_upi";
}

interface ItemFailureState {
  productId: string;
  productTitle: string;
  error: string;
}

export default function CartPage() {
  const { user, authLoading } = useAuthModal();
  const router = useRouter();
  const [items, setItems] = useState<CartLineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableMissing, setTableMissing] = useState(false);
  const [busyProductId, setBusyProductId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await authedFetch("/api/hammart/cart");
      const data = await res.json().catch(() => ({}));
      setItems(data.items || []);
      setTableMissing(Boolean(data.tableMissing));
    } catch (err) {
      console.error("Failed to load cart:", err);
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

  const updateQuantity = async (productId: string, nextQuantity: number) => {
    if (nextQuantity < 1) return;
    setBusyProductId(productId);
    setItems((prev) => prev.map((it) => (it.productId === productId ? { ...it, quantity: nextQuantity } : it)));
    try {
      await authedFetch(`/api/hammart/cart/${productId}`, { method: "PATCH", body: JSON.stringify({ quantity: nextQuantity }) });
    } catch (err) {
      console.error("Failed to update quantity:", err);
    } finally {
      setBusyProductId(null);
    }
  };

  const removeItem = async (productId: string) => {
    setBusyProductId(productId);
    try {
      await authedFetch(`/api/hammart/cart/${productId}`, { method: "DELETE" });
      setItems((prev) => prev.filter((it) => it.productId !== productId));
    } catch (err) {
      console.error("Failed to remove cart item:", err);
    } finally {
      setBusyProductId(null);
    }
  };

  // ---- Checkout ----
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [buyerNameInput, setBuyerNameInput] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [city, setCity] = useState("");
  const [stateName, setStateName] = useState("");
  const [pincode, setPincode] = useState("");
  const [showMapPicker, setShowMapPicker] = useState(false);

  const [checkingOut, setCheckingOut] = useState(false);
  const [groupResults, setGroupResults] = useState<GroupCheckoutState[] | null>(null);
  const [itemFailures, setItemFailures] = useState<ItemFailureState[]>([]);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  // OTP Verification State
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpInput, setOtpInput] = useState("");
  const [otpError, setOtpError] = useState<string | null>(null);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);

  const openCheckout = () => {
    setBuyerNameInput(user?.name || "");
    setBuyerEmail(user?.email || "");
    setShowAddressModal(true);
  };

  const handleAddressFromMap = (addr: LocationAddress) => {
    setDeliveryAddress(addr.formattedAddress);
  };

  // Only real, available, live-priced items can actually be ordered — a
  // product that vanished after being added to the cart simply can't be
  // checked out, so it's excluded here rather than pretending to order it.
  const availableItems = items.filter(
    (it): it is CartLineItem & { product: HammartProduct } => !it.unavailable && Boolean(it.product)
  );
  const unavailableItems = items.filter((it) => it.unavailable || !it.product);

  const groups = new Map<string, { vendorId: string; items: (CartLineItem & { product: HammartProduct })[] }>();
  availableItems.forEach((it) => {
    const key = it.product.vendorId;
    const existing = groups.get(key);
    if (existing) existing.items.push(it);
    else groups.set(key, { vendorId: key, items: [it] });
  });

  const grandTotal = availableItems.reduce((sum, it) => sum + it.product.priceInr * it.quantity, 0);

  const updateGroupStatus = (vendorId: string, status: GroupStatus, error?: string) => {
    setGroupResults((prev) => prev?.map((g) => (g.vendorId === vendorId ? { ...g, status, error } : g)) ?? prev);
  };

  // Direct-UPI path only. Reuses the Razorpay path's own polling helper
  // but against a much longer budget — a vendor manually checking their
  // UPI app realistically takes minutes, not the ~36s Razorpay's
  // near-instant Route settlement is tuned for. Running the budget out
  // just leaves this group exactly as it was (still "awaiting_upi") —
  // never shown as an error, since nothing failed, it's just not
  // confirmed yet. The buyer can always leave and check My Orders later.
  const pollUpiVendorConfirmation = async (vendorId: string, orderIds: string[]) => {
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
      updateGroupStatus(vendorId, "vendor_cancelled");
    } else if (values.length > 0 && values.every((s) => s === "vendor_confirmed")) {
      updateGroupStatus(vendorId, "vendor_confirmed");
    }
  };

  // "I've completed this payment" — a nudge, not a payment confirmation.
  // See app/api/hammart/orders/mark-buyer-paid/route.ts's header comment:
  // this only emails the vendor to check sooner, it never changes the
  // order's real status on its own.
  const handleClaimBuyerPaid = async (vendorId: string, orderIds: string[] | undefined) => {
    if (!orderIds?.length) return;
    setGroupResults((prev) => prev?.map((g) => (g.vendorId === vendorId ? { ...g, claimingPaid: true } : g)) ?? prev);
    try {
      await authedFetch("/api/hammart/orders/mark-buyer-paid", {
        method: "POST",
        body: JSON.stringify({ orderIds }),
      });
    } catch (err) {
      console.error("Failed to notify vendor of claimed payment:", err);
    } finally {
      setGroupResults((prev) =>
        prev?.map((g) => (g.vendorId === vendorId ? { ...g, buyerClaimed: true, claimingPaid: false } : g)) ?? prev
      );
    }
  };

  // One payment per vendor group (see app/api/hammart/checkout/route.ts) —
  // each group comes back as either "razorpay" (real gateway Checkout
  // popup, opened one at a time since only one popup can meaningfully be
  // open at once, final status from polling the webhook-verified "paid"
  // state) or "upi" (no gateway at all — just render the vendor's QR/link
  // and leave it to them to confirm once actually paid).
  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deliveryAddress.trim() || !buyerPhone.trim()) {
      setCheckoutError("Please provide your phone number and delivery address.");
      return;
    }
    if (availableItems.length === 0) {
      setCheckoutError("Your cart has no available items to order.");
      return;
    }

    setCheckoutError(null);
    setSendingOtp(true);
    
    try {
      const res = await authedFetch("/api/whatsapp/send-otp", {
        method: "POST",
        body: JSON.stringify({ phone: buyerPhone }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to send OTP.");
      }
      setShowOtpModal(true);
    } catch (err) {
       console.error("OTP send failed:", err);
       setCheckoutError(err instanceof Error ? err.message : "Couldn't send OTP right now.");
    } finally {
       setSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
     if (!otpInput.trim() || otpInput.length < 6) {
        setOtpError("Please enter a valid 6-digit OTP.");
        return;
     }
     
     setOtpError(null);
     setVerifyingOtp(true);

     try {
       const res = await authedFetch("/api/whatsapp/verify-otp", {
         method: "POST",
         body: JSON.stringify({ phone: buyerPhone, otp: otpInput.trim() }),
       });
       const data = await res.json();
       if (!res.ok) {
          throw new Error(data.error || "Invalid OTP.");
       }
       
       setShowOtpModal(false);
       setOtpInput("");
       executeCheckout();
     } catch (err) {
        console.error("OTP verification failed:", err);
        setOtpError(err instanceof Error ? err.message : "Verification failed.");
     } finally {
        setVerifyingOtp(false);
     }
  };

  const executeCheckout = async () => {
    setCheckingOut(true);

    let response;
    try {
      response = await postHammartCheckout({
        authedFetch,
        items: availableItems.map((it) => ({ productId: it.productId, quantity: it.quantity })),
        buyerName: buyerNameInput,
        buyerEmail,
        buyerPhone,
        deliveryAddress,
        city,
        state: stateName,
        pincode,
      });
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : "Couldn't start checkout right now.");
      setCheckingOut(false);
      return;
    }

    // Only load Razorpay's script if at least one vendor group actually
    // needs it — a cart that's entirely UPI-fallback vendors shouldn't
    // pull in the gateway script at all.
    const razorpayGroups = response.groups.filter((g): g is CheckoutGroupResult & { success: true; paymentMethod: "razorpay" } => g.success && g.paymentMethod === "razorpay");
    if (razorpayGroups.length > 0) {
      try {
        await loadRazorpayCheckoutScript();
      } catch (err) {
        // Don't abort the whole checkout over this — a hybrid cart may
        // still have UPI-fallback groups that don't need this script at
        // all. Razorpay groups will simply resolve "unavailable" below
        // once openHammartCheckoutForGroup finds window.Razorpay missing,
        // which already surfaces per-group in the results UI.
        console.error("Failed to load Razorpay Checkout script:", err);
      }
    }

    setShowAddressModal(false);
    setItemFailures(response.failedItems);
    setGroupResults(
      response.groups.map((g) => ({
        vendorId: g.vendorId,
        amountInr: g.amountInr || 0,
        status: g.success ? (g.paymentMethod === "upi" ? "awaiting_upi" : "opening") : "failed",
        error: g.error,
        paymentMethod: g.paymentMethod,
        upiLink: g.upiLink,
        vendorUpiId: g.vendorUpiId,
        orderIds: g.orderIds,
      }))
    );

    // The server already removed successfully-ordered items from the real
    // cart — keep the visible list in sync without a full refetch.
    const orderedVendorUserIds = new Set(response.groups.filter((g) => g.success).map((g) => g.vendorUserId));
    setItems((prev) => prev.filter((it) => !(it.product && orderedVendorUserIds.has(it.product.vendorUserId))));

    setCheckingOut(false);

    // UPI groups just need their QR code rendered — no popup, no
    // polling, nothing to wait on (all can happen concurrently).
    const upiGroups = response.groups.filter((g): g is CheckoutGroupResult & { success: true; paymentMethod: "upi" } => g.success && g.paymentMethod === "upi");
    await Promise.all(
      upiGroups.map(async (group) => {
        if (!group.upiLink) return;
        const qrDataUrl = await generateUpiQrDataUrl(group.upiLink);
        setGroupResults((prev) => prev?.map((g) => (g.vendorId === group.vendorId ? { ...g, qrDataUrl } : g)) ?? prev);
      })
    );

    // Kick off background polling for every UPI group so this screen can
    // reach a real "Order placed!" state on its own once its vendor
    // confirms — not awaited, runs alongside whatever Razorpay groups do
    // below.
    upiGroups.forEach((group) => {
      void pollUpiVendorConfirmation(group.vendorId, group.orderIds || []);
    });

    // Razorpay groups: sequential, not Promise.all — only one Checkout
    // popup can be meaningfully open at a time.
    for (const group of razorpayGroups) {
      const outcome = await openHammartCheckoutForGroup(group, { buyerName: buyerNameInput, buyerEmail, buyerPhone });

      if (outcome === "dismissed") {
        updateGroupStatus(group.vendorId, "dismissed");
        continue;
      }
      if (outcome === "unavailable") {
        updateGroupStatus(group.vendorId, "unavailable");
        continue;
      }

      updateGroupStatus(group.vendorId, "verifying");
      const statuses = await pollHammartOrderStatuses({ authedFetch, orderIds: group.orderIds || [] });
      const values = Object.values(statuses);
      if (values.every((s) => s === "paid")) {
        updateGroupStatus(group.vendorId, "paid");
      } else if (values.some((s) => s === "payment_failed")) {
        updateGroupStatus(group.vendorId, "payment_failed");
      } else {
        // Still pending after the poll budget — not a failure, just not
        // confirmed yet. /shop/orders will reflect the real status the
        // moment the webhook lands.
        updateGroupStatus(group.vendorId, "verifying");
      }
    }
  };

  // Once every vendor group in this checkout attempt has reached a real,
  // final outcome — Razorpay's webhook-verified "paid", or a vendor's own
  // "vendor_confirmed"/"vendor_cancelled" on the direct-UPI path — and at
  // least one of them actually succeeded, take the buyer back to their
  // order list automatically. Deliberately waits for ALL groups (not just
  // one) so a multi-vendor cart never navigates away while another
  // group's QR code or Razorpay popup is still mid-flight.
  useEffect(() => {
    if (!groupResults || groupResults.length === 0) return;
    const allTerminal = groupResults.every((g) => isTerminalGroupStatus(g.status));
    const anySucceeded = groupResults.some((g) => g.status === "paid" || g.status === "vendor_confirmed");
    if (!allTerminal || !anySucceeded) return;
    const timer = setTimeout(() => router.push("/shop/orders"), 2500);
    return () => clearTimeout(timer);
  }, [groupResults, router]);

  if (authLoading || (loading && user?.userId)) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 size={24} className="animate-spin text-slate-400" />
      </div>
    );
  }

  if (!user) {
    return <div className="mx-auto max-w-md px-6 py-16 text-center text-sm text-slate-400 light:text-slate-600">Sign in to see your cart.</div>;
  }

  if (tableMissing) {
    return (
      <div className="mx-auto max-w-md px-6 py-16 text-center text-sm text-slate-400 light:text-slate-600">
        Carts aren&apos;t set up yet. Please check back shortly.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-8 text-white light:text-slate-900">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/shop"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 light:bg-slate-100 text-slate-400 light:text-slate-500 transition hover:bg-white/10 hover:text-white light:hover:bg-slate-200 light:hover:text-slate-900"
            title="Back to shop"
          >
            <ArrowLeft size={18} />
          </Link>
          <h1 className="flex items-center gap-2 text-xl font-black text-white light:text-slate-900">
            <ShoppingCart size={20} className="text-orange-400" /> Your Cart
          </h1>
        </div>
        <ShopNavLinks />
      </div>

      {(groupResults || itemFailures.length > 0) && (
        <div className="mt-5 space-y-3">
          <p className="text-sm font-bold text-white light:text-slate-900">Checkout results</p>
          {groupResults?.map((g) => (
            <div
              key={g.vendorId}
              className={`rounded-2xl border p-4 text-center ${
                g.status === "paid" || g.status === "vendor_confirmed"
                  ? "border-emerald-400/20 bg-emerald-500/[0.05]"
                  : g.status === "payment_failed" || g.status === "failed" || g.status === "vendor_cancelled"
                  ? "border-red-400/20 bg-red-500/[0.05]"
                  : "border-amber-400/20 bg-amber-500/[0.05]"
              }`}
            >
              {g.status === "paid" ? (
                <>
                  <CheckCircle2 size={20} className="mx-auto text-emerald-400" />
                  <p className="mt-1.5 text-sm font-bold text-white light:text-slate-900">Paid — order from {g.vendorId} confirmed</p>
                  <p className="mt-1 text-lg font-black text-orange-400">₹{g.amountInr.toLocaleString("en-IN")}</p>
                </>
              ) : g.status === "vendor_confirmed" ? (
                <>
                  <CheckCircle2 size={20} className="mx-auto text-emerald-400" />
                  <p className="mt-1.5 text-sm font-bold text-white light:text-slate-900">Order placed! {g.vendorId} confirmed your payment</p>
                  <p className="mt-1 text-lg font-black text-orange-400">₹{g.amountInr.toLocaleString("en-IN")}</p>
                </>
              ) : g.status === "vendor_cancelled" ? (
                <>
                  <XCircle size={20} className="mx-auto text-red-400" />
                  <p className="mt-1.5 text-sm font-bold text-white light:text-slate-900">{g.vendorId} cancelled this order</p>
                  <p className="mt-1 text-xs text-slate-400">
                    If you already paid via UPI and haven&apos;t heard about a refund, contact the seller directly.
                  </p>
                </>
              ) : g.status === "awaiting_upi" ? (
                <>
                  <p className="text-sm font-bold text-white light:text-slate-900">Pay {g.vendorId} directly</p>
                  <p className="mt-1 text-lg font-black text-orange-400">₹{g.amountInr.toLocaleString("en-IN")}</p>
                  {g.qrDataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={g.qrDataUrl} alt="UPI QR code" className="mx-auto mt-3 h-40 w-40 rounded-xl bg-white p-2" />
                  ) : (
                    <Loader2 size={20} className="mx-auto mt-3 animate-spin text-amber-400" />
                  )}
                  <p className="mt-2 text-xs text-slate-400">
                    UPI ID: <span className="font-mono">{g.vendorUpiId}</span>
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    This seller hasn&apos;t set up automatic payments yet — scan the QR or use the UPI ID above to pay them
                    directly. They&apos;ll confirm your order once payment arrives.
                  </p>

                  {g.buyerClaimed ? (
                    <p className="mt-3 flex items-center justify-center gap-1.5 text-xs font-semibold text-sky-300">
                      <Loader2 size={13} className="animate-spin" /> We&apos;ve let {g.vendorId} know — confirming your payment…
                    </p>
                  ) : (
                    <button
                      type="button"
                      disabled={g.claimingPaid}
                      onClick={() => handleClaimBuyerPaid(g.vendorId, g.orderIds)}
                      className="mt-3 rounded-xl bg-orange-500/15 px-4 py-2 text-xs font-bold text-orange-300 transition hover:bg-orange-500/25 disabled:opacity-60"
                    >
                      {g.claimingPaid ? "Notifying…" : "I've completed this payment"}
                    </button>
                  )}
                  <p className="mt-2 text-[10px] text-slate-600">
                    This will update automatically once {g.vendorId} confirms — feel free to leave and check My
                    Orders anytime.
                  </p>
                </>
              ) : g.status === "opening" || g.status === "verifying" ? (
                <>
                  <Loader2 size={20} className="mx-auto animate-spin text-amber-400" />
                  <p className="mt-1.5 text-sm font-bold text-white light:text-slate-900">
                    {g.status === "opening" ? `Opening payment for ${g.vendorId}…` : `Confirming payment for ${g.vendorId}…`}
                  </p>
                </>
              ) : g.status === "dismissed" ? (
                <>
                  <Clock size={20} className="mx-auto text-amber-400" />
                  <p className="mt-1.5 text-sm font-bold text-white light:text-slate-900">Payment not completed — {g.vendorId}</p>
                  <p className="mt-1 text-xs text-slate-400">Your order is saved as awaiting payment — retry anytime from My Orders.</p>
                </>
              ) : (
                <div className="flex items-center gap-2 text-left">
                  <XCircle size={18} className="flex-shrink-0 text-red-400" />
                  <p className="text-xs font-semibold text-red-300">
                    {g.vendorId}: {g.error || "Payment failed — please try again."}
                  </p>
                </div>
              )}
            </div>
          ))}
          {itemFailures.map((f) => (
            <div key={f.productId} className="flex items-center gap-2 rounded-2xl border border-red-400/20 bg-red-500/[0.05] p-4">
              <XCircle size={18} className="flex-shrink-0 text-red-400" />
              <p className="text-xs font-semibold text-red-300">
                {f.productTitle}: {f.error}
              </p>
            </div>
          ))}
          <Link href="/shop/orders" className="mt-2 block text-center text-xs font-semibold text-orange-300 hover:text-orange-200">
            View my orders →
          </Link>
        </div>
      )}

      {items.length === 0 ? (
        <div className="mt-10 flex flex-col items-center gap-2 text-center text-sm text-slate-500">
          <ShoppingCart size={26} className="text-slate-600" />
          Your cart is empty.
          <Link href="/shop" className="mt-2 text-xs font-bold text-orange-400 underline">
            Browse HamMart
          </Link>
        </div>
      ) : (
        <div className="mt-5 space-y-5">
          {Array.from(groups.values()).map((group) => (
            <div key={group.vendorId} className="rounded-2xl border border-white/10 light:border-slate-300 bg-white/[0.02] light:bg-white p-3.5 light:shadow-sm">
              <p className="flex items-center gap-1.5 text-xs font-bold text-orange-400 light:text-orange-600">
                <Store size={13} /> {group.vendorId}
              </p>
              <div className="mt-2.5 space-y-2.5">
                {group.items.map((it) => (
                  <div key={it.productId} className="flex items-center gap-3">
                    {it.product.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={it.product.imageUrl} alt={it.product.title} className="h-14 w-14 flex-shrink-0 rounded-lg object-cover" />
                    ) : (
                      <div className="h-14 w-14 flex-shrink-0 rounded-lg bg-white/5" />
                    )}
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/shop/product/${it.productId}`}
                        className="block truncate text-sm font-semibold text-white light:text-slate-900 hover:text-orange-300 light:hover:text-orange-600"
                      >
                        {it.product.title}
                      </Link>
                      <p className="flex items-center gap-1 text-xs text-slate-400 light:text-slate-600">
                        <IndianRupee size={11} /> {it.product.priceInr.toLocaleString("en-IN")} × {it.quantity} = ₹
                        {(it.product.priceInr * it.quantity).toLocaleString("en-IN")}
                      </p>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-1.5">
                      <div className="flex items-center rounded-lg border border-white/10 light:border-slate-300">
                        <button
                          type="button"
                          onClick={() => updateQuantity(it.productId, it.quantity - 1)}
                          disabled={busyProductId === it.productId || it.quantity <= 1}
                          className="flex h-7 w-7 items-center justify-center text-slate-300 light:text-slate-700 disabled:opacity-40"
                        >
                          <Minus size={12} />
                        </button>
                        <span className="w-6 text-center text-xs font-bold text-white light:text-slate-900">{it.quantity}</span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(it.productId, it.quantity + 1)}
                          disabled={busyProductId === it.productId || it.quantity >= (it.product.stockQuantity ?? 20)}
                          className="flex h-7 w-7 items-center justify-center text-slate-300 light:text-slate-700 disabled:opacity-40"
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItem(it.productId)}
                        disabled={busyProductId === it.productId}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-500/20 text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {unavailableItems.length > 0 && (
            <div className="rounded-2xl border border-white/10 light:border-slate-300 bg-white/[0.02] light:bg-white p-3.5">
              <p className="text-xs font-bold text-slate-400 light:text-slate-600">No longer available</p>
              <div className="mt-2 space-y-2">
                {unavailableItems.map((it) => (
                  <div key={it.productId} className="flex items-center gap-3">
                    <div className="h-10 w-10 flex-shrink-0 rounded-lg bg-white/5" />
                    <p className="flex-1 text-xs text-slate-500">This item was removed by the seller.</p>
                    <button
                      type="button"
                      onClick={() => removeItem(it.productId)}
                      disabled={busyProductId === it.productId}
                      className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg border border-red-500/20 text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {availableItems.length > 0 && (
            <div className="rounded-2xl border border-orange-400/20 bg-orange-500/[0.05] p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold text-slate-300 light:text-slate-700">
                  Total ({availableItems.length} item{availableItems.length === 1 ? "" : "s"})
                </span>
                <span className="text-lg font-black text-orange-400">₹{grandTotal.toLocaleString("en-IN")}</span>
              </div>
              {groups.size > 1 && (
                <p className="mt-1 text-[11px] text-slate-500">
                  Items are from {groups.size} different sellers — you&apos;ll complete one payment per seller.
                </p>
              )}
              <button
                type="button"
                onClick={openCheckout}
                className="mt-3 w-full rounded-2xl bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] py-3 text-sm font-black text-slate-950 shadow-lg shadow-orange-500/25 transition hover:brightness-110 active:scale-[0.99]"
              >
                Proceed to Checkout
              </button>
            </div>
          )}
        </div>
      )}

      {/* Shared Shipping Address Modal — one address for every item in
          this checkout batch, same fields/flow as the single-product Buy
          Now checkout (see app/shop/product/[productId]/page.tsx). */}
      {showAddressModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl border border-white/15 light:border-slate-300 bg-slate-900 light:bg-white p-6 shadow-2xl text-white light:text-slate-900">
            <div className="flex items-center justify-between border-b border-white/10 light:border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddressModal(false)}
                  className="mr-1 rounded-full p-1 text-slate-400 light:text-slate-600 hover:text-white light:hover:text-slate-900 transition"
                  title="Back"
                >
                  <ArrowLeft size={18} />
                </button>
                <ShoppingCart className="text-orange-400" size={20} />
                <h3 className="text-lg font-black text-white light:text-slate-900">Shipping & Delivery Details</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddressModal(false)}
                className="rounded-full p-1.5 text-slate-400 light:text-slate-600 transition hover:bg-white/10 light:hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            {checkingOut ? (
              <div className="flex flex-col items-center gap-3 py-10">
                <Loader2 size={28} className="animate-spin text-orange-400" />
                <p className="text-sm font-semibold text-slate-300 light:text-slate-700">Starting checkout…</p>
              </div>
            ) : (
              <form onSubmit={handleCheckout} className="mt-4 space-y-3">
                <p className="text-[11px] text-slate-400 light:text-slate-600">
                  This address applies to all {availableItems.length} item{availableItems.length === 1 ? "" : "s"} in this order.
                </p>
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
                  <div className="mb-1 flex items-center justify-between">
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

                {checkoutError && <p className="text-xs font-bold text-red-400">{checkoutError}</p>}

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
                    disabled={checkingOut}
                    className="flex-1 rounded-xl bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] py-2.5 text-xs font-black text-slate-950 disabled:opacity-50 shadow-md shadow-orange-500/20"
                  >
                    {checkingOut ? "Placing orders..." : `Confirm ${availableItems.length} Order${availableItems.length === 1 ? "" : "s"}`}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {showMapPicker && <LocationMapPicker onSelectAddress={handleAddressFromMap} onClose={() => setShowMapPicker(false)} />}
    </div>
  );
}
