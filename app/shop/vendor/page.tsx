"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Store, ShieldCheck, Clock, XCircle, CheckCircle2, Wallet, AlertTriangle } from "lucide-react";
import { useAuthModal } from "@/app/components/auth/AuthProvider";
import { authedFetch } from "@/app/lib/apiFetch";
import VendorKycForm from "@/app/components/hammart/VendorKycForm";
import VendorSubscribeButton from "@/app/components/hammart/VendorSubscribeButton";
import VendorSalesStats from "@/app/components/hammart/VendorSalesStats";
import { FREE_LISTINGS_LIMIT, type BusinessType, type VendorProfile } from "@/app/lib/hammartVendors";
import type { HammartOrder } from "@/app/lib/hammartOrders";

// Real "become a vendor" path for someone who ALREADY has an InPlayer
// account (the sign-up-form toggle in SignUpModal.tsx only covers brand
// new accounts) — same vendor-id availability check, same
// /api/hammart/vendor/register endpoint, just called directly with this
// session's own token instead of via the pending-localStorage handoff.
function BecomeVendorForm({ onRegistered }: { onRegistered: () => void }) {
  const [businessType, setBusinessType] = useState<BusinessType>("individual");
  const [vendorId, setVendorId] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [check, setCheck] = useState<{ status: "idle" | "checking" | "available" | "unavailable"; reason?: string }>({
    status: "idle",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const clearCheck = () => setCheck({ status: "idle" });
    const trimmed = vendorId.trim();
    if (!trimmed) {
      clearCheck();
      return;
    }
    let cancelled = false;
    const markChecking = () => setCheck({ status: "checking" });
    markChecking();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/hammart/vendor-id/check?vendorId=${encodeURIComponent(trimmed)}`);
        const data = await res.json();
        if (cancelled) return;
        setCheck({ status: data.available ? "available" : "unavailable", reason: data.reason });
      } catch {
        if (!cancelled) setCheck({ status: "unavailable", reason: "Couldn't check that vendor ID right now." });
      }
    }, 450);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [vendorId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!vendorId.trim() || check.status !== "available") {
      setError("Please choose an available vendor ID.");
      return;
    }
    if (businessType === "business" && !businessName.trim()) {
      setError("Please enter your registered business name.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await authedFetch("/api/hammart/vendor/register", {
        method: "POST",
        body: JSON.stringify({ vendorId: vendorId.trim(), businessType, businessName: businessType === "business" ? businessName.trim() : null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Couldn't register right now.");
        return;
      }
      onRegistered();
    } catch (err) {
      console.error("Vendor registration failed:", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mx-auto mt-6 max-w-md space-y-3 rounded-2xl border border-white/10 light:border-black/10 bg-white/[0.02] p-5 text-left">
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setBusinessType("individual")} className={`rounded-xl border py-2 text-xs font-bold transition ${businessType === "individual" ? "border-orange-400/50 bg-orange-500/15 text-orange-300" : "border-white/10 light:border-black/10 text-slate-400 light:text-slate-700"}`}>
          Individual Seller
        </button>
        <button type="button" onClick={() => setBusinessType("business")} className={`rounded-xl border py-2 text-xs font-bold transition ${businessType === "business" ? "border-orange-400/50 bg-orange-500/15 text-orange-300" : "border-white/10 light:border-black/10 text-slate-400 light:text-slate-700"}`}>
          Registered Business
        </button>
      </div>

      {businessType === "business" && (
        <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Business name" className="w-full rounded-xl border border-white/10 light:border-black/10 bg-[#07111F] light:bg-white px-3 py-2.5 text-sm text-white light:text-slate-900 outline-none focus:border-orange-400/50" />
      )}

      <div>
        <input
          value={vendorId}
          onChange={(e) => setVendorId(e.target.value.toLowerCase())}
          placeholder="your-shop-name"
          className="w-full rounded-xl border border-white/10 light:border-black/10 bg-[#07111F] light:bg-white px-3 py-2.5 text-sm text-white light:text-slate-900 outline-none focus:border-orange-400/50"
        />
        {check.status === "unavailable" && <p className="mt-1 text-[11px] text-red-400">{check.reason}</p>}
        {check.status === "available" && <p className="mt-1 text-[11px] text-emerald-400">inplayer.in/shop/{vendorId.trim()}</p>}
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <button type="submit" disabled={submitting} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] py-2.5 text-sm font-bold text-white disabled:opacity-60">
        {submitting ? <Loader2 size={16} className="animate-spin" /> : <Store size={16} />}
        {submitting ? "Creating..." : "Create Vendor Account"}
      </button>
    </form>
  );
}

// Vendor-facing view of the same razorpayAccountStatus the admin panel
// already shows (app/admin/hammart-vendors/page.tsx) — before this, a
// vendor had no way to see this at all and had to ask Reno directly.
// "Instant payouts" here means the same thing it means everywhere else in
// this codebase (see app/lib/razorpay.ts's Route section, app/api/hammart/
// checkout/route.ts's header comment): once active, a buyer can pay this
// vendor's listings by card/netbanking/any UPI app, and Razorpay
// automatically sends this vendor's share straight to the bank account
// they submitted at KYC the moment each payment is captured — no manual
// step for the vendor or for Reno. Until then, buyers keep paying this
// vendor directly via their own UPI ID (never blocked, never a reason to
// worry) — same message the admin panel already gives.
function PayoutStatusCard({ vendor }: { vendor: VendorProfile }) {
  const status = vendor.razorpayAccountStatus || "not_started";

  if (status === "active") {
    return (
      <div className="mt-4 flex flex-col items-center gap-1.5 rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.06] p-5 text-center">
        <Wallet size={20} className="text-emerald-400" />
        <p className="text-sm font-semibold text-white light:text-slate-900">Instant payouts are active</p>
        <p className="max-w-sm text-[11px] leading-5 text-slate-400 light:text-slate-600">
          Buyers can now pay you by card, netbanking, or any UPI app. Your share of every order (after InPlayer&apos;s
          flat ₹0.50 fee) lands in your bank account automatically the moment payment is captured.
        </p>
      </div>
    );
  }

  if (status === "pending") {
    return (
      <div className="mt-4 flex flex-col items-center gap-1.5 rounded-2xl border border-amber-400/20 bg-amber-500/[0.06] p-5 text-center">
        <Clock size={20} className="text-amber-400" />
        <p className="text-sm font-semibold text-white light:text-slate-900">Payout setup in review</p>
        <p className="max-w-sm text-[11px] leading-5 text-slate-400 light:text-slate-600">
          Razorpay is reviewing your bank details for automatic payouts — this can take a little while. In the
          meantime, buyers pay you directly via your UPI ID ({vendor.upiId || "on file"}), same as before.
        </p>
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className="mt-4 flex flex-col items-center gap-1.5 rounded-2xl border border-red-400/20 bg-red-500/[0.06] p-5 text-center">
        <AlertTriangle size={20} className="text-red-400" />
        <p className="text-sm font-semibold text-white light:text-slate-900">Payout setup needs another look</p>
        {vendor.razorpayAccountError && (
          <p className="max-w-sm text-[11px] leading-5 text-red-300">{vendor.razorpayAccountError}</p>
        )}
        <p className="max-w-sm text-[11px] leading-5 text-slate-400 light:text-slate-600">
          Buyers can still pay you directly via your UPI ID in the meantime — contact InPlayer support to have this
          retried.
        </p>
      </div>
    );
  }

  // "not_started" — either a vendor approved before this feature existed,
  // or the automatic attempt hasn't run yet. Kept low-key on purpose: this
  // is never something the vendor needs to act on themselves, and selling
  // via UPI is never blocked by it.
  return (
    <div className="mt-4 flex flex-col items-center gap-1.5 rounded-2xl border border-white/10 light:border-black/10 bg-white/[0.02] p-5 text-center">
      <Wallet size={20} className="text-slate-400" />
      <p className="text-sm font-semibold text-white light:text-slate-900">Automatic payouts not set up yet</p>
      <p className="max-w-sm text-[11px] leading-5 text-slate-400 light:text-slate-600">
        Buyers pay you directly via your UPI ID for now. InPlayer support can enable automatic card/netbanking
        payouts to your bank account for you.
      </p>
    </div>
  );
}

export default function VendorDashboardPage() {
  const { user, authLoading, openSignIn } = useAuthModal();
  const [vendor, setVendor] = useState<VendorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [tableMissing, setTableMissing] = useState(false);
  const [vendorOrders, setVendorOrders] = useState<HammartOrder[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await authedFetch("/api/hammart/vendor/me");
      const data = await res.json().catch(() => ({}));
      const loadedVendor = (data.vendor || null) as VendorProfile | null;
      setVendor(loadedVendor);
      setTableMissing(Boolean(data.tableMissing));

      // Sales data only means anything once a vendor can actually receive
      // orders — same verified-and-not-suspended gate the "Orders
      // Received" link itself sits behind below.
      if (loadedVendor && loadedVendor.kycStatus === "verified" && !loadedVendor.suspended) {
        const ordersRes = await authedFetch("/api/hammart/orders?role=vendor");
        const ordersData = await ordersRes.json().catch(() => ({}));
        setVendorOrders(ordersData.orders || []);
      } else {
        setVendorOrders([]);
      }
    } catch (err) {
      console.error("Failed to load vendor profile:", err);
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

  if (authLoading || (loading && user?.userId)) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 size={24} className="animate-spin text-slate-400" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
        <Store size={32} className="text-orange-400" />
        <h1 className="mt-4 text-2xl font-black text-white light:text-slate-900">Vendor Dashboard</h1>
        <p className="mt-2 text-sm text-slate-400 light:text-slate-600">Sign in to set up or manage your Hammart vendor account.</p>
        <button onClick={openSignIn} className="mt-5 rounded-2xl bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] px-6 py-2.5 text-sm font-bold text-white">
          Sign In
        </button>
      </div>
    );
  }

  if (tableMissing) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
        <p className="text-sm text-slate-400 light:text-slate-600">Vendor accounts aren&apos;t set up yet. Please check back shortly.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-10 text-center">
      <Store size={32} className="mx-auto text-orange-400" />
      <h1 className="mt-4 text-2xl font-black text-white light:text-slate-900">Vendor Dashboard</h1>

      {!vendor && (
        <>
          <p className="mt-2 text-sm text-slate-400 light:text-slate-600">
            You don&apos;t have a Hammart vendor account yet. Set one up below — it&apos;s free to start.
          </p>
          <BecomeVendorForm onRegistered={load} />
        </>
      )}

      {vendor && (vendor.kycStatus === "not_started" || vendor.kycStatus === "rejected") && (
        <>
          <p className="mt-2 text-sm text-slate-400 light:text-slate-600">
            <span className="font-semibold text-white light:text-slate-900">{vendor.vendorId}</span> — complete
            business verification to start publishing listings.
          </p>
          <div className="text-left">
            <VendorKycForm
              businessType={vendor.businessType}
              rejectionReason={vendor.kycStatus === "rejected" ? "Please resubmit with corrected details." : null}
              onSubmitted={load}
            />
          </div>
        </>
      )}

      {vendor && vendor.kycStatus === "pending_review" && (
        <div className="mt-6 flex flex-col items-center gap-2 rounded-2xl border border-amber-400/20 bg-amber-500/[0.06] p-6">
          <Clock size={24} className="text-amber-400" />
          <p className="text-sm font-semibold text-white light:text-slate-900">Verification in progress</p>
          <p className="text-xs text-slate-400 light:text-slate-600">
            The InPlayer team is reviewing your submission — usually within a few days.
          </p>
        </div>
      )}

      {vendor && vendor.kycStatus === "verified" && vendor.suspended && (
        <div className="mt-6 flex flex-col items-center gap-2 rounded-2xl border border-red-400/20 bg-red-500/[0.06] p-6">
          <XCircle size={24} className="text-red-400" />
          <p className="text-sm font-semibold text-white light:text-slate-900">Your vendor account is suspended</p>
          <p className="text-xs text-slate-400 light:text-slate-600">Contact InPlayer support for details.</p>
        </div>
      )}

      {vendor && vendor.kycStatus === "verified" && !vendor.suspended && (
        <div className="mt-6 flex flex-col items-center gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.06] p-6">
          <CheckCircle2 size={24} className="text-emerald-400" />
          <p className="text-sm font-semibold text-white light:text-slate-900">You&apos;re verified, {vendor.vendorId}!</p>
          <p className="flex items-center gap-1 text-[11px] text-emerald-300">
            <ShieldCheck size={12} />
            Unlimited Product Listings Enabled.
          </p>
          <div className="mt-1 flex gap-2">
            <Link href="/shop/vendor/listings" className="rounded-xl border border-white/10 light:border-black/10 px-4 py-2 text-xs font-bold text-slate-200 light:text-slate-800 hover:bg-white/5">
              My Listings
            </Link>
            <Link href="/shop/vendor/orders" className="rounded-xl border border-white/10 light:border-black/10 px-4 py-2 text-xs font-bold text-slate-200 light:text-slate-800 hover:bg-white/5">
              Orders Received
            </Link>
          </div>
        </div>
      )}

      {vendor && vendor.kycStatus === "verified" && !vendor.suspended && (
        <PayoutStatusCard vendor={vendor} />
      )}

      {vendor && vendor.kycStatus === "verified" && !vendor.suspended && vendorOrders.length > 0 && (
        <div className="mt-4 text-left">
          <h2 className="mb-2 text-xs font-black uppercase tracking-wide text-slate-400 light:text-slate-600">Sales Overview</h2>
          <VendorSalesStats orders={vendorOrders} compact />
          <Link
            href="/shop/vendor/orders"
            className="mt-2.5 block text-center text-xs font-semibold text-orange-300 hover:text-orange-200"
          >
            View full sales breakdown &amp; orders →
          </Link>
        </div>
      )}
    </div>
  );
}
