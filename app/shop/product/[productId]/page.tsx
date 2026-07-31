"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import QRCode from "qrcode";
import { Loader2, ShoppingBag, IndianRupee, Store, ExternalLink, CheckCircle2, AlertTriangle } from "lucide-react";
import { useAuthModal } from "@/app/components/auth/AuthProvider";
import { authedFetch } from "@/app/lib/apiFetch";
import { buildUpiLink } from "@/app/lib/upi";
import type { HammartProduct } from "@/app/lib/hammartProducts";
import type { HammartOrder } from "@/app/lib/hammartOrders";

// Real checkout — money moves buyer -> vendor DIRECTLY over UPI (this QR
// and link encode the vendor's own UPI ID and the exact price). InPlayer
// never sees or touches this payment; "Place order" just records the
// claim and emails the vendor, it does not confirm payment happened. That
// caveat is shown to the buyer here, not hidden.
export default function ProductPage() {
  const params = useParams();
  const productId = params?.productId as string;
  const { user, signedIn, openSignIn } = useAuthModal();

  const [product, setProduct] = useState<HammartProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [order, setOrder] = useState<HammartOrder | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!productId) return;
    (async () => {
      try {
        const res = await fetch(`/api/hammart/products/${productId}`);
        if (!res.ok) {
          setNotFound(true);
          return;
        }
        const data = await res.json();
        setProduct(data.product || null);
      } catch (err) {
        console.error("Failed to load product:", err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [productId]);

  const handleBuy = async () => {
    if (!signedIn) {
      openSignIn();
      return;
    }
    setError(null);
    setPlacing(true);
    try {
      const res = await authedFetch("/api/hammart/orders", {
        method: "POST",
        body: JSON.stringify({ productId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Couldn't place your order.");
        return;
      }
      setOrder(data.order);
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
        <Loader2 size={24} className="animate-spin text-slate-400" />
      </div>
    );
  }

  if (notFound || !product) {
    return (
      <div className="mx-auto max-w-md px-6 py-16 text-center">
        <ShoppingBag size={28} className="mx-auto text-slate-600" />
        <p className="mt-3 text-sm text-slate-500">This listing isn&apos;t available.</p>
      </div>
    );
  }

  const upiLink = order ? buildUpiLink({ vpa: order.vendorUpiId, payeeName: order.vendorId, amountInr: order.priceInr, note: order.productTitle }) : null;
  const isOwnListing = user?.userId === product.vendorUserId;

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <div className="grid gap-6 sm:grid-cols-2">
        <div className="aspect-square overflow-hidden rounded-2xl bg-white/5">
          {product.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.imageUrl} alt={product.title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-slate-600">
              <ShoppingBag size={40} />
            </div>
          )}
        </div>

        <div>
          <p className="flex items-center gap-1 text-xs font-semibold text-slate-500">
            <Store size={12} /> {product.vendorId}
          </p>
          <h1 className="mt-1 text-xl font-black text-white light:text-slate-900">{product.title}</h1>
          <p className="mt-2 flex items-center gap-1 text-2xl font-black text-orange-300 light:text-orange-700">
            <IndianRupee size={20} /> {product.priceInr.toLocaleString("en-IN")}
          </p>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-300 light:text-slate-700">{product.description}</p>

          {isOwnListing ? (
            <p className="mt-6 text-xs text-slate-500">This is your own listing.</p>
          ) : !order ? (
            <button
              type="button"
              onClick={handleBuy}
              disabled={placing}
              className="mt-6 flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] px-6 py-3 text-sm font-bold text-white disabled:opacity-60"
            >
              {placing ? <Loader2 size={16} className="animate-spin" /> : <ShoppingBag size={16} />}
              {placing ? "Placing order..." : "Buy Now"}
            </button>
          ) : null}

          {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
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
          <p className="mt-4 flex items-start gap-1.5 rounded-xl bg-amber-500/10 px-3 py-2 text-left text-[11px] leading-relaxed text-amber-300">
            <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" />
            This payment goes straight to the vendor — InPlayer doesn&apos;t process it and can&apos;t confirm it
            for you. The vendor has been emailed about this order and will confirm once they receive payment.
          </p>
          <a
            href="/shop/orders"
            className="mt-4 flex items-center justify-center gap-1 text-xs font-semibold text-orange-300 hover:text-orange-200"
          >
            View my orders <ExternalLink size={11} />
          </a>
        </div>
      )}
    </div>
  );
}
