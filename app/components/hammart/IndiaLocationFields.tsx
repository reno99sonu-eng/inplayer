"use client";

import { useEffect, useMemo, useState } from "react";
import { CITIES_BY_STATE, INDIA_STATES, OTHER_CITY_OPTION } from "@/app/data/indiaStatesCities";

const FIELD_CLASS =
  "mt-1 w-full rounded-xl border border-white/10 light:border-slate-300 bg-white/5 light:bg-white px-3 py-2 text-xs text-white light:text-slate-900 placeholder:text-slate-500 light:placeholder:text-slate-600 outline-none focus:border-orange-400 font-medium";

const LABEL_CLASS = "text-[11px] font-bold text-slate-300 light:text-slate-800 uppercase";

interface IndiaLocationFieldsProps {
  state: string;
  city: string;
  onStateChange: (state: string) => void;
  onCityChange: (city: string) => void;
}

// State + City address dropdowns for the Hammart checkout modal — shared by
// app/shop/cart/page.tsx and app/shop/product/[productId]/page.tsx (both
// used free-text City/State inputs before this, which let a typo like
// "Mumbai" vs "mumbai" vs "Bombay" straight through to the vendor's
// shipping label). State is the fixed India states/UTs list; City cascades
// off whichever state is selected. Real addresses can land in a town too
// small for any curated list, so City always keeps an "Other" option that
// reveals a free-text fallback — narrows the common case to a couple of
// taps without ever blocking a real order over an incomplete list.
//
// Renders as two sibling <div> grid cells (State, then City) so it drops
// straight into each page's existing `grid grid-cols-3 gap-2` row ahead of
// the untouched third Pincode cell — State first because City's options
// depend on it, so picking city first would just show a disabled dropdown.
export default function IndiaLocationFields({ state, city, onStateChange, onCityChange }: IndiaLocationFieldsProps) {
  const cityOptions = useMemo(() => (state ? CITIES_BY_STATE[state] || [] : []), [state]);
  const isKnownCity = city !== "" && cityOptions.includes(city);

  // Tracks whether "Other" is the active mode for the City dropdown,
  // independent of what (if anything) has been typed into the fallback
  // text box — without this, picking "Other" while the text box is still
  // empty would look identical to nothing being selected, and the
  // dropdown would silently snap back to "Select City".
  const [manualMode, setManualMode] = useState(false);

  // Reconciles manualMode when `city` arrives from OUTSIDE a direct pick
  // in this component — e.g. prefilled from a past order or the map
  // auto-detect. A non-empty city that isn't in this state's curated list
  // should still show (and stay editable) via the Other text box instead
  // of silently disappearing. Left alone while city is empty so the
  // State-change reset and an explicit "Other" pick (both of which set
  // manualMode directly) aren't fought by this effect.
  useEffect(() => {
    if (city === "") return;
    setManualMode(!isKnownCity);
  }, [city, isKnownCity]);

  const selectValue = manualMode ? OTHER_CITY_OPTION : isKnownCity ? city : "";

  return (
    <>
      <div>
        <label className={LABEL_CLASS}>State</label>
        <select
          required
          value={state}
          onChange={(e) => {
            onStateChange(e.target.value);
            // Changing state invalidates whatever city was picked for the
            // OLD state — a leftover "Mumbai" under a newly-selected
            // "Tamil Nadu" would silently ship to the wrong place.
            setManualMode(false);
            onCityChange("");
          }}
          className={FIELD_CLASS}
        >
          <option value="">Select State</option>
          {INDIA_STATES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={LABEL_CLASS}>City</label>
        <select
          required={!manualMode}
          value={selectValue}
          disabled={!state}
          onChange={(e) => {
            const next = e.target.value;
            if (next === OTHER_CITY_OPTION) {
              setManualMode(true);
              onCityChange("");
            } else {
              setManualMode(false);
              onCityChange(next);
            }
          }}
          className={FIELD_CLASS}
        >
          <option value="">{state ? "Select City" : "Select State first"}</option>
          {cityOptions.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
          <option value={OTHER_CITY_OPTION}>Other (type manually)</option>
        </select>
        {manualMode && (
          <input
            type="text"
            required
            value={city}
            onChange={(e) => onCityChange(e.target.value)}
            placeholder="Enter your city/town"
            className={`${FIELD_CLASS} mt-1.5`}
          />
        )}
      </div>
    </>
  );
}
