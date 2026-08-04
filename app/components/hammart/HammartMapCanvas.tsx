"use client";

// The real interactive map underneath LocationMapPicker.tsx — split into its
// own file because Leaflet touches `window` at import time and can only run
// in the browser, so LocationMapPicker loads this via next/dynamic with
// `ssr: false`. Uses OpenStreetMap tiles (same free OSM family as the
// reverse-geocoding call in LocationMapPicker, which already hits
// nominatim.openstreetmap.org — no new API key or billing account needed).
// If InPlayer's map traffic ever gets heavy, OSM's usage policy asks
// high-volume production apps to move to a paid tile provider (Mapbox,
// Google, etc.) — swapping the TileLayer `url` below is the only change
// that would take.
import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";
import type { Map as LeafletMap } from "leaflet";
import "leaflet/dist/leaflet.css";

interface HammartMapCanvasProps {
  lat: number;
  lng: number;
  zoom: number;
  /** Bump this to force the map to fly to (lat, lng) programmatically — used
      for GPS auto-detect, which needs to move the map from OUTSIDE a user
      drag. Left unchanged (e.g. during normal dragging), nothing happens. */
  flyToSignal: number;
  onMapReady: (map: LeafletMap) => void;
  onMoveEnd: (lat: number, lng: number) => void;
  onZoomEnd: (zoom: number) => void;
}

// Lives INSIDE <MapContainer> (react-leaflet's map instance is only reachable
// via useMap()/useMapEvents() from a descendant, not a plain ref on
// MapContainer) — reports the live map instance up, flies to a new center
// only when flyToSignal actually changes (never on every render, which would
// fight the user mid-drag), and reports real drag/zoom gestures back up via
// the native Leaflet `moveend`/`zoomend` events. This IS the fix for the
// old N/S/E/W step-button panning: Leaflet's own drag handling is what moves
// the map now, this just listens for when a drag/zoom finishes.
function MapController({ lat, lng, zoom, flyToSignal, onMapReady, onMoveEnd, onZoomEnd }: HammartMapCanvasProps) {
  const map = useMap();
  const lastSignal = useRef(flyToSignal);
  const readyReported = useRef(false);

  useEffect(() => {
    if (readyReported.current) return;
    readyReported.current = true;
    onMapReady(map);
  }, [map, onMapReady]);

  useEffect(() => {
    if (flyToSignal === lastSignal.current) return;
    lastSignal.current = flyToSignal;
    map.flyTo([lat, lng], zoom, { duration: 0.8 });
    // Only react to flyToSignal changing — lat/lng/zoom are read at the
    // moment it fires, not tracked continuously (that would re-fly the map
    // on every drag-driven coordinate update, fighting the user's own drag).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flyToSignal, map]);

  useMapEvents({
    moveend: () => {
      const center = map.getCenter();
      onMoveEnd(center.lat, center.lng);
    },
    zoomend: () => {
      onZoomEnd(map.getZoom());
    },
  });

  return null;
}

export default function HammartMapCanvas(props: HammartMapCanvasProps) {
  return (
    <MapContainer
      center={[props.lat, props.lng]}
      zoom={props.zoom}
      zoomControl={false}
      dragging={true}
      touchZoom={true}
      scrollWheelZoom={true}
      doubleClickZoom={true}
      style={{ height: "100%", width: "100%", background: "#0f172a" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapController {...props} />
    </MapContainer>
  );
}
