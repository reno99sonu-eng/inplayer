"use client";

import { useState } from "react";
import { MapPin, Navigation, Check, X, Building, Home, Briefcase } from "lucide-react";

export interface LocationAddress {
  flatNo: string;
  landmark: string;
  formattedAddress: string;
  addressType: "home" | "work" | "other";
  lat?: number;
  lng?: number;
}

interface LocationMapPickerProps {
  onSelectAddress: (address: LocationAddress) => void;
  onClose: () => void;
}

export default function LocationMapPicker({ onSelectAddress, onClose }: LocationMapPickerProps) {
  const [detecting, setDetecting] = useState(false);
  const [flatNo, setFlatNo] = useState("");
  const [landmark, setLandmark] = useState("");
  const [addressType, setAddressType] = useState<"home" | "work" | "other">("home");
  const [formattedAddress, setFormattedAddress] = useState("Sector 62, Noida, Uttar Pradesh, India");
  const [coords, setCoords] = useState<{ lat: number; lng: number }>({ lat: 28.6273, lng: 77.3725 });
  const [detectSuccess, setDetectSuccess] = useState(false);

  const handleAutoDetectLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }

    setDetecting(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setCoords({ lat, lng });

        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
          );
          const data = await res.json();
          if (data && data.display_name) {
            setFormattedAddress(data.display_name);
          } else {
            setFormattedAddress(`Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
          }
        } catch {
          setFormattedAddress(`Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
        } finally {
          setDetecting(false);
          setDetectSuccess(true);
        }
      },
      (err) => {
        console.error("GPS detection error:", err);
        setDetecting(false);
        alert("Unable to detect GPS position. Please enter your address manually.");
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const handleConfirm = () => {
    if (!formattedAddress) {
      alert("Please select or enter your delivery address.");
      return;
    }

    const fullAddress = [flatNo, landmark, formattedAddress].filter(Boolean).join(", ");
    onSelectAddress({
      flatNo,
      landmark,
      formattedAddress: fullAddress,
      addressType,
      lat: coords.lat,
      lng: coords.lng,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-white/10 bg-[#0F172A] p-6 text-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2">
            <MapPin className="text-orange-400" size={20} />
            <h3 className="text-lg font-bold text-white">Select Delivery Location</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        {/* GPS Location Auto-Detect Button */}
        <div className="mt-5">
          <button
            onClick={handleAutoDetectLocation}
            disabled={detecting}
            className="flex w-full items-center justify-center gap-2.5 rounded-2xl border border-orange-500/30 bg-orange-500/10 py-3 text-sm font-bold text-orange-300 transition hover:bg-orange-500/20 active:scale-[0.99] disabled:opacity-50"
          >
            <Navigation size={18} className={detecting ? "animate-spin" : "text-orange-400"} />
            {detecting ? "Detecting GPS Location…" : "Auto-Detect Current Location on Map"}
          </button>

          {detectSuccess && (
            <p className="mt-2 text-center text-xs font-semibold text-emerald-400 flex items-center justify-center gap-1">
              <Check size={14} /> Location pinned successfully!
            </p>
          )}
        </div>

        {/* Interactive Map Visual */}
        <div className="relative mt-4 h-44 w-full overflow-hidden rounded-2xl border border-white/10 bg-slate-900">
          <iframe
            title="Location Map"
            width="100%"
            height="100%"
            frameBorder="0"
            scrolling="no"
            src={`https://maps.google.com/maps?q=${coords.lat},${coords.lng}&z=15&output=embed`}
            className="filter brightness-90 contrast-110"
          />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="relative flex flex-col items-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-500 shadow-lg shadow-orange-500/40 text-white animate-bounce">
                <MapPin size={22} />
              </div>
              <div className="h-2 w-2 rounded-full bg-orange-500/80 blur-xs" />
            </div>
          </div>
        </div>

        {/* Selected Address Line */}
        <div className="mt-4 rounded-2xl border border-white/5 bg-white/[0.03] p-3 text-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Pinned Location</span>
          <p className="mt-0.5 text-slate-200 truncate">{formattedAddress}</p>
        </div>

        {/* Address Details Form */}
        <div className="mt-4 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-300">House / Flat / Building No.</label>
            <input
              type="text"
              value={flatNo}
              onChange={(e) => setFlatNo(e.target.value)}
              placeholder="e.g. Flat 402, Block B, Green Heights"
              className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-orange-400/50"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300">Landmark (Optional)</label>
            <input
              type="text"
              value={landmark}
              onChange={(e) => setLandmark(e.target.value)}
              placeholder="e.g. Near Metro Station / Opp City Mall"
              className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-orange-400/50"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Address Tag</label>
            <div className="flex gap-2">
              {[
                { type: "home", label: "Home", icon: Home },
                { type: "work", label: "Work", icon: Briefcase },
                { type: "other", label: "Other", icon: Building },
              ].map(({ type, label, icon: Icon }) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setAddressType(type as "home" | "work" | "other")}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl border py-2 text-xs font-semibold transition ${
                    addressType === type
                      ? "border-orange-400 bg-orange-500/20 text-orange-300"
                      : "border-white/10 bg-white/5 text-slate-400 hover:bg-white/10"
                  }`}
                >
                  <Icon size={14} /> {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button
          onClick={handleConfirm}
          className="mt-6 w-full rounded-2xl bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] py-3 text-sm font-bold text-slate-950 shadow-lg shadow-orange-500/25 transition hover:brightness-110 active:scale-[0.99]"
        >
          Save & Confirm Location
        </button>
      </div>
    </div>
  );
}
