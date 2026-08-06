"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { Loader2, ShoppingCart, IndianRupee, Minus, Plus, Trash2, Store, ArrowLeft, CheckCircle2, XCircle, X, MapPin } from "lucide-react";
import { useAuthModal } from "@/app/components/auth/AuthProvider";
import { authedFetch } from "@/app/lib/apiFetch";
import { buildUpiLink } from "@/app/lib/upi";
import { orderTotalInr } from "@/app/lib/hammartOrderMath";
import LocationMapPicker, { type LocationAddress } from "@/app/components/hammart/LocationMapPicker";
import ShopNavLinks from "@/app/components/hammart/ShopNavLinks";
import type { HammartProduct } from "@/app/lib/hammartProducts";
import type { HammartOrder } from "@/app/lib/hammartOrders";

interface CartLineItem {
  productId: string;
  quantity: number;
  addedAt: string;
  product: HammartProduct | null;
  unavailable: boolean;
}

interface CheckoutResult {
  productId: string;
  productTitle: string;
  success: boolean;
  error?: string;
  order?: HammartOrder;
  qrDataUrl?: string;
}

export default function CartPage() {
  const { user, authLoading } = useAuthModal();
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
  const [checkoutProgress, setCheckoutProgress] = useState<{ done: number; total: number } | null>(null);
  const [checkoutResults, setCheckoutResults] = useState<CheckoutResult[] | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

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

  // Hammart payments move buyer -> vendor directly over UPI (see
  // app/lib/hammartOrders.ts's top comment) — there's no single combined
  // checkout, so a multi-vendor cart genuinely becomes N separate orders,
  // each needing its own UPI payment. This loop places them one at a
  // time and reports each outcome honestly rather than pretending it was
  // one atomic transaction.
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
    setCheckingOut(true);
    setCheckoutProgress({ done: 0, total: availableItems.length });

    const results: CheckoutResult[] = [];
    for (const item of availableItems) {
      const product = item.product;
      try {
        const res = await authedFetch("/api/hammart/orders", {
          method: "POST",
          body: JSON.stringify({
            productId: item.productId,
            quantity: item.quantity,
            buyerName: buyerNameInput,
            buyerEmail,
            buyerPhone,
            deliveryAddress,
            city,
            state: stateName,
            pincode,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          results.push({ productId: item.productId, productTitle: product.title, success: false, error: data.error || "Couldn't place this order." });
        } else {
          const order = data.order as HammartOrder;
          const link = buildUpiLink({ vpa: order.vendorUpiId, payeeName: order.vendorId, amountInr: orderTotalInr(order), note: order.productTitle });
          let qrDataUrl: string | undefined;
          try {
            qrDataUrl = await QRCode.toDataURL(link, { width: 220, margin: 1 });
          } catch (err) {
            console.error("QR generation failed:", err);
          }
          results.push({ productId: item.productId, productTitle: product.title, success: true, order, qrDataUrl });
        }
      } catch (err) {
        console.error(`Failed to order ${product.title}:`, err);
        results.push({ productId: item.productId, productTitle: product.title, success: false, error: "Something went wrong. Please try again." });
      }
      setCheckoutProgress((prev) => (prev ? { done: prev.done + 1, total: prev.total } : prev));
    }

    setCheckoutResults(results);
    setShowAddressModal(false);
    setCheckingOut(false);

    // The server already removed successfully-ordered items from the
    // real cart (see POST /api/hammart/orders) — this just keeps the
    // visible list in sync without a full refetch.
    const succeededIds = new Set(results.filter((r) => r.success).map((r) => r.productId));
    setItems((prev) => prev.filter((it) => !succeededIds.has(it.productId)));
  };

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
      <div className="flex items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-xl font-black text-white light:text-slate-900">
          <ShoppingCart size={20} className="text-orange-400" /> Your Cart
        </h1>
        <ShopNavLinks />
      </div>

      {checkoutResults && (
        <div className="mt-5 space-y-3">
          <p className="text-sm font-bold text-white light:text-slate-900">Checkout results</p>
          {checkoutResults.map((r) => (
            <div
              key={r.productId}
              className={`rounded-2xl border p-4 ${r.success ? "border-emerald-400/20 bg-emerald-500/[0.05]" : "border-red-400/20 bg-red-500/[0.05]"}`}
            >
              {r.success && r.order ? (
                <div className="text-center">
                  <CheckCircle2 size={20} className="mx-auto text-emerald-400" />
                  <p className="mt-1.5 text-sm font-bold text-white light:text-slate-900">
                    {r.productTitle} — pay {r.order.vendorId} directly
                  </p>
                  <p className="mt-1 text-lg font-black text-orange-400">₹{orderTotalInr(r.order).toLocaleString("en-IN")}</p>
                  {r.qrDataUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.qrDataUrl} alt="UPI QR code" className="mx-auto mt-3 h-40 w-40 rounded-xl bg-white p-2" />
                  )}
                  <p className="mt-2 text-xs text-slate-400">
                    UPI ID: <span className="font-mono">{r.order.vendorUpiId}</span>
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <XCircle size={18} className="flex-shrink-0 text-red-400" />
                  <p className="text-xs font-semibold text-red-300">
                    {r.productTitle}: {r.error}
                  </p>
                </div>
              )}
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
                          disabled={busyProductId === it.productId || it.quantity >= 20}
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
                  Items are from {groups.size} different sellers — you&apos;ll pay each one separately via their own UPI ID.
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

            {checkingOut && checkoutProgress ? (
              <div className="flex flex-col items-center gap-3 py-10">
                <Loader2 size={28} className="animate-spin text-orange-400" />
                <p className="text-sm font-semibold text-slate-300 light:text-slate-700">
                  Placing order {Math.min(checkoutProgress.done + 1, checkoutProgress.total)} of {checkoutProgress.total}...
                </p>
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
