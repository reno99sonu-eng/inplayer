"use client";

import { useState } from "react";
import { MapPin, Navigation, Check, X, Building, Home, Briefcase, ArrowLeft, Plus, Minus, Move } from "lucide-react";

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
  const [zoom, setZoom] = useState(15);
  const [detectSuccess, setDetectSuccess] = useState(false);
  const [isDraggingMap, setIsDraggingMap] = useState(false);

  const fetchAddressForCoords = async (lat: number, lng: number) => {
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
    }
  };

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
        await fetchAddressForCoords(lat, lng);
        setDetecting(false);
        setDetectSuccess(true);
      },
      (err) => {
        console.error("GPS detection error:", err);
        setDetecting(false);
        alert("Unable to detect GPS position. Please adjust map manually.");
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // Draggable Map Pan Handlers
  const handleMapPan = (dLat: number, dLng: number) => {
    const newLat = coords.lat + dLat;
    const newLng = coords.lng + dLng;
    setCoords({ lat: newLat, lng: newLng });
    fetchAddressForCoords(newLat, newLng);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
      <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-white/15 light:border-slate-300 bg-slate-900 light:bg-white p-5 sm:p-6 text-white light:text-slate-900 shadow-2xl">
        {/* Modal Header with Back / Close Button */}
        <div className="flex items-center justify-between border-b border-white/10 light:border-slate-200 pb-3.5">
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="rounded-full p-1 text-slate-400 hover:text-white light:hover:text-slate-900 transition mr-1"
              title="Back"
            >
              <ArrowLeft size={18} />
            </button>
            <MapPin className="text-orange-400" size={20} />
            <h3 className="text-base sm:text-lg font-black text-white light:text-slate-900">Select Delivery Location</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 light:text-slate-600 transition hover:bg-white/10 light:hover:bg-slate-100 hover:text-white light:hover:text-slate-900"
          >
            <X size={18} />
          </button>
        </div>

        {/* GPS Location Auto-Detect Button */}
        <div className="mt-4">
          <button
            onClick={handleAutoDetectLocation}
            disabled={detecting}
            className="flex w-full items-center justify-center gap-2.5 rounded-2xl border border-orange-500/40 bg-orange-500/10 light:bg-amber-100 py-2.5 text-xs font-bold text-orange-300 light:text-amber-900 transition hover:bg-orange-500/20 active:scale-[0.99] disabled:opacity-50"
          >
            <Navigation size={16} className={detecting ? "animate-spin text-orange-400" : "text-orange-400"} />
            {detecting ? "Detecting GPS Location…" : "Auto-Detect Current Location on Map"}
          </button>

          {detectSuccess && (
            <p className="mt-1.5 text-center text-xs font-bold text-emerald-400 light:text-emerald-700 flex items-center justify-center gap-1">
              <Check size={14} /> Location pinned successfully!
            </p>
          )}
        </div>

        {/* Interactive Draggable Map Container */}
        <div className="relative mt-3 h-48 w-full overflow-hidden rounded-2xl border border-white/10 light:border-slate-300 bg-slate-950 light:bg-slate-100 group">
          <iframe
            title="Location Map"
            width="100%"
            height="100%"
            frameBorder="0"
            scrolling="no"
            src={`https://maps.google.com/maps?q=${coords.lat},${coords.lng}&z=${zoom}&output=embed`}
            className="filter brightness-95 contrast-105 pointer-events-none"
          />

          {/* Center Draggable Location Target Marker */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="relative flex flex-col items-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-500 shadow-xl shadow-orange-500/50 text-white animate-bounce">
                <MapPin size={22} />
              </div>
              <div className="h-2 w-2 rounded-full bg-orange-500/80 blur-xs" />
            </div>
          </div>

          {/* Interactive Map Pan & Drag Controls */}
          <div className="absolute top-2 right-2 flex flex-col gap-1 z-10">
            <button
              onClick={() => setZoom((z) => Math.min(z + 1, 19))}
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900/90 light:bg-white border border-white/20 light:border-slate-300 text-white light:text-slate-900 shadow-md font-bold hover:bg-slate-800"
              title="Zoom In"
            >
              <Plus size={14} />
            </button>
            <button
              onClick={() => setZoom((z) => Math.max(z - 1, 3))}
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900/90 light:bg-white border border-white/20 light:border-slate-300 text-white light:text-slate-900 shadow-md font-bold hover:bg-slate-800"
              title="Zoom Out"
            >
              <Minus size={14} />
            </button>
          </div>

          {/* Directional Drag Controls Overlay */}
          <div className="absolute bottom-2 right-2 flex items-center gap-1 z-10 bg-slate-900/80 light:bg-white/90 backdrop-blur-md p-1 rounded-xl border border-white/10 light:border-slate-300 text-[10px] font-bold text-slate-300 light:text-slate-800">
            <Move size={12} className="text-orange-400" />
            <span>Pan Map:</span>
            <button onClick={() => handleMapPan(0.002, 0)} className="px-1.5 py-0.5 rounded bg-white/10 light:bg-slate-200 hover:bg-orange-500 hover:text-white">▲ North</button>
            <button onClick={() => handleMapPan(-0.002, 0)} className="px-1.5 py-0.5 rounded bg-white/10 light:bg-slate-200 hover:bg-orange-500 hover:text-white">▼ South</button>
            <button onClick={() => handleMapPan(0, -0.002)} className="px-1.5 py-0.5 rounded bg-white/10 light:bg-slate-200 hover:bg-orange-500 hover:text-white">◄ West</button>
            <button onClick={() => handleMapPan(0, 0.002)} className="px-1.5 py-0.5 rounded bg-white/10 light:bg-slate-200 hover:bg-orange-500 hover:text-white">► East</button>
          </div>
        </div>

        {/* Selected Address Display */}
        <div className="mt-3 rounded-2xl border border-white/10 light:border-slate-300 bg-white/[0.03] light:bg-slate-50 p-2.5 text-xs light:shadow-sm">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 light:text-slate-600">Pinned Location</span>
          <p className="mt-0.5 text-slate-200 light:text-slate-900 font-bold truncate">{formattedAddress}</p>
        </div>

        {/* Address Details Form */}
        <div className="mt-3 space-y-2.5">
          <div>
            <label className="block text-xs font-bold text-slate-300 light:text-slate-800">House / Flat / Building No.</label>
            <input
              type="text"
              value={flatNo}
              onChange={(e) => setFlatNo(e.target.value)}
              placeholder="e.g. Flat 402, Block B, Green Heights"
              className="mt-1 w-full rounded-xl border border-white/10 light:border-slate-300 bg-white/5 light:bg-white px-3 py-2 text-xs text-white light:text-slate-900 placeholder:text-slate-500 light:placeholder:text-slate-600 outline-none focus:border-orange-400 font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 light:text-slate-800">Landmark (Optional)</label>
            <input
              type="text"
              value={landmark}
              onChange={(e) => setLandmark(e.target.value)}
              placeholder="e.g. Near Metro Station / Opp City Mall"
              className="mt-1 w-full rounded-xl border border-white/10 light:border-slate-300 bg-white/5 light:bg-white px-3 py-2 text-xs text-white light:text-slate-900 placeholder:text-slate-500 light:placeholder:text-slate-600 outline-none focus:border-orange-400 font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 light:text-slate-800 mb-1">Address Tag</label>
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
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl border py-2 text-xs font-bold transition ${
                    addressType === type
                      ? "border-orange-400 bg-orange-500/20 light:bg-amber-100 text-orange-300 light:text-amber-900 shadow-sm"
                      : "border-white/10 light:border-slate-300 bg-white/5 light:bg-slate-100 text-slate-400 light:text-slate-700 hover:bg-white/10 light:hover:bg-slate-200"
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
          className="mt-5 w-full rounded-2xl bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] py-3 text-xs sm:text-sm font-black text-slate-950 shadow-lg shadow-orange-500/25 transition hover:brightness-110 active:scale-[0.99]"
        >
          Save & Confirm Location
        </button>
      </div>
    </div>
  );
}
