"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Save, MessageSquare } from "lucide-react";
import { useAuthModal } from "@/app/components/auth/AuthProvider";
import { authedFetch } from "@/app/lib/apiFetch";
import type { VendorProfile } from "@/app/lib/hammartVendors";

export default function VendorSettingsPage() {
  const { user, authLoading } = useAuthModal();
  const [vendor, setVendor] = useState<VendorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [address, setAddress] = useState("");
  const [pincode, setPincode] = useState("");
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    if (!user?.userId) {
      if (!authLoading) setLoading(false);
      return;
    }
    const load = async () => {
      try {
        const res = await authedFetch("/api/hammart/vendor/me");
        const data = await res.json().catch(() => ({}));
        if (data.vendor) {
          setVendor(data.vendor);
          setWhatsappNumber(data.vendor.whatsappNumber || "");
          setAddress(data.vendor.address || "");
          setPincode(data.vendor.pincode || "");
        }
      } catch (err) {
        console.error("Failed to load vendor settings:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user?.userId, authLoading]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await authedFetch("/api/hammart/vendor/settings", {
        method: "POST",
        body: JSON.stringify({ 
          whatsappNumber: whatsappNumber.trim(),
          address: address.trim(),
          pincode: pincode.trim()
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setMessage({ text: "Settings saved successfully.", type: "success" });
      } else {
        setMessage({ text: data.error || "Failed to save settings.", type: "error" });
      }
    } catch (err) {
      console.error("Failed to save settings:", err);
      setMessage({ text: "An error occurred while saving.", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 size={24} className="animate-spin text-slate-400" />
      </div>
    );
  }

  if (!vendor || vendor.kycStatus !== "verified") {
    return (
      <div className="mx-auto max-w-xl px-6 py-10 text-center">
        <p className="text-slate-400">You must have an active, verified vendor account to access settings.</p>
        <Link href="/shop/vendor" className="mt-4 inline-block text-orange-400 hover:underline">
          Go to Vendor Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-6 py-10">
      <Link href="/shop/vendor" className="mb-6 flex items-center gap-2 text-sm text-slate-400 hover:text-white">
        <ArrowLeft size={16} /> Back to Dashboard
      </Link>

      <h1 className="mb-8 text-2xl font-black text-white light:text-slate-900">Vendor Settings</h1>

      <form onSubmit={handleSave} className="space-y-6">
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
              <MessageSquare size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white light:text-slate-900">Order Notifications</h2>
              <p className="text-xs text-slate-400">Get a WhatsApp message whenever you receive a new order.</p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-white light:text-slate-900">
              WhatsApp Number (Optional)
            </label>
            <input
              type="tel"
              value={whatsappNumber}
              onChange={(e) => setWhatsappNumber(e.target.value)}
              placeholder="+91..."
              className="w-full rounded-xl border border-white/10 bg-[#07111F] px-4 py-3 text-sm text-white outline-none focus:border-orange-400/50"
            />
            <p className="text-[11px] leading-relaxed text-slate-500">
              Include your country code (e.g. +91). Leave this blank if you only want to receive order notifications via email.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
          <div className="mb-4">
            <h2 className="text-base font-bold text-white light:text-slate-900">Hyperlocal Delivery Area</h2>
            <p className="text-xs text-slate-400">Set your store's base location. Customers within 15km of this area will be able to see and buy your products.</p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-white light:text-slate-900">
                Pincode <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                maxLength={6}
                value={pincode}
                onChange={(e) => setPincode(e.target.value.replace(/\D/g, ''))}
                placeholder="e.g. 110001"
                className="w-full rounded-xl border border-white/10 bg-[#07111F] px-4 py-3 text-sm text-white outline-none focus:border-orange-400/50"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-white light:text-slate-900">
                Full Street Address
              </label>
              <textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Shop Number, Street Name, Area..."
                rows={3}
                className="w-full resize-none rounded-xl border border-white/10 bg-[#07111F] px-4 py-3 text-sm text-white outline-none focus:border-orange-400/50"
              />
            </div>
          </div>
        </div>

        {message && (
          <p className={`text-sm ${message.type === "success" ? "text-emerald-400" : "text-red-400"}`}>
            {message.text}
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] px-6 py-3 text-sm font-bold text-white disabled:opacity-50"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </form>
    </div>
  );
}
