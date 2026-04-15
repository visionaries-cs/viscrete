"use client";

import { useState, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  X,
  MapPin,
  Navigation,
  Tag,
  Loader2,
  MousePointerClick,
} from "lucide-react";

// Load Leaflet only on the client — it accesses `window` at import time
const LocationMapInner = dynamic(
  () => import("@/components/LocationMapInner"),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    ),
  },
);

// ─── Public interface ─────────────────────────────────────────────────────────

export interface LocationPickerResult {
  latitude?: number;
  longitude?: number;
  altitude?: number;
  location_label?: string;
}

interface Props {
  /** Title shown in the modal header, e.g. the filename */
  title?: string;
  /** Seed the form with existing values when reopening */
  initialLat?: string;
  initialLng?: string;
  initialAlt?: string;
  initialLabel?: string;
  onConfirm: (result: LocationPickerResult) => void;
  onClose: () => void;
}

type Tab = "map" | "label";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseDeg(s: string): number | null {
  const v = parseFloat(s);
  return s.trim() && !isNaN(v) ? v : null;
}

function fmtDeg(n: number): string {
  return n.toFixed(6);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function LocationPickerModal({
  title,
  initialLat = "",
  initialLng = "",
  initialAlt = "",
  initialLabel = "",
  onConfirm,
  onClose,
}: Props) {
  const [tab, setTab] = useState<Tab>("map");

  // GPS fields — shared between map click and manual inputs
  const [lat, setLat] = useState(initialLat);
  const [lng, setLng] = useState(initialLng);
  const [alt, setAlt] = useState(initialAlt);

  // Label field
  const [label, setLabel] = useState(initialLabel);

  const [error, setError] = useState<string | null>(null);

  // Map receives parsed numbers; null means no pin
  const parsedLat = parseDeg(lat);
  const parsedLng = parseDeg(lng);

  // Called by the map when the user clicks — auto-fills the coordinate inputs
  const handleMapClick = useCallback((clickLat: number, clickLng: number) => {
    setLat(fmtDeg(clickLat));
    setLng(fmtDeg(clickLng));
    setError(null);
  }, []);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function handleConfirm() {
    setError(null);

    if (tab === "map") {
      const la = parseDeg(lat);
      const lo = parseDeg(lng);
      if (la == null || lo == null) {
        setError("Click on the map or enter valid latitude and longitude.");
        return;
      }
      const result: LocationPickerResult = { latitude: la, longitude: lo };
      const altVal = parseDeg(alt);
      if (altVal != null) result.altitude = altVal;
      // Include label if the user also filled it in
      if (label.trim()) result.location_label = label.trim();
      onConfirm(result);
      return;
    }

    // label tab
    if (!label.trim()) {
      setError("Enter a location label.");
      return;
    }
    const result: LocationPickerResult = { location_label: label.trim() };
    // Include coords too if the user happened to fill them
    const la = parseDeg(lat);
    const lo = parseDeg(lng);
    if (la != null && lo != null) {
      result.latitude = la;
      result.longitude = lo;
      const altVal = parseDeg(alt);
      if (altVal != null) result.altitude = altVal;
    }
    onConfirm(result);
  }

  const hasCoords = parsedLat != null && parsedLng != null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white dark:bg-[#161616] rounded-2xl border border-gray-200 dark:border-gray-800 shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col"
        style={{ maxHeight: "90vh" }}
      >
        {/* ── Header ────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 dark:border-gray-800 shrink-0">
          <MapPin className="w-4 h-4 text-blue-500 shrink-0" />
          <span className="flex-1 text-sm font-semibold text-gray-900 dark:text-white truncate min-w-0">
            {title ?? "Set Location"}
          </span>
          <button
            onClick={onClose}
            className="shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Tab switcher ──────────────────────────────────────────────── */}
        <div className="flex items-center gap-1 px-5 pt-4 shrink-0">
          <button
            onClick={() => setTab("map")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer",
              tab === "map"
                ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800",
            )}
          >
            <Navigation className="w-3.5 h-3.5" />
            Map / Coordinates
          </button>
          <button
            onClick={() => setTab("label")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer",
              tab === "label"
                ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800",
            )}
          >
            <Tag className="w-3.5 h-3.5" />
            Text Label Only
          </button>
        </div>

        {/* ── Body ──────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 min-h-0">

          {tab === "map" && (
            <>
              {/* Interactive map */}
              <div className="relative" style={{ height: 320 }}>
                <LocationMapInner
                  lat={parsedLat}
                  lng={parsedLng}
                  onChange={handleMapClick}
                />
                {/* Hint overlay — fades after first click */}
                {!hasCoords && (
                  <div className="absolute inset-0 flex items-end justify-center pb-4 pointer-events-none">
                    <div className="flex items-center gap-2 bg-black/60 text-white text-xs px-3 py-1.5 rounded-full backdrop-blur-sm">
                      <MousePointerClick className="w-3.5 h-3.5" />
                      Click anywhere on the map to pin a location
                    </div>
                  </div>
                )}
              </div>

              {/* Coordinate inputs — auto-filled by map click, editable manually */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">
                    Latitude *
                  </Label>
                  <Input
                    value={lat}
                    onChange={e => { setLat(e.target.value); setError(null); }}
                    placeholder="14.5995"
                    className="h-8 text-sm border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white font-mono"
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">
                    Longitude *
                  </Label>
                  <Input
                    value={lng}
                    onChange={e => { setLng(e.target.value); setError(null); }}
                    placeholder="120.9842"
                    className="h-8 text-sm border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white font-mono"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">
                  Altitude (optional, metres)
                </Label>
                <Input
                  value={alt}
                  onChange={e => setAlt(e.target.value)}
                  placeholder="12.5"
                  className="h-8 text-sm border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white font-mono"
                />
              </div>
              {/* Optional label even in map/GPS mode */}
              <div>
                <Label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">
                  Location Label (optional)
                </Label>
                <Input
                  value={label}
                  onChange={e => setLabel(e.target.value)}
                  placeholder="e.g. Basement 1 near the corner"
                  className="h-8 text-sm border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white"
                />
              </div>
            </>
          )}

          {tab === "label" && (
            <>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Use a descriptive text location when GPS coordinates are unavailable.
              </p>
              <div>
                <Label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">
                  Location Label *
                </Label>
                <Input
                  value={label}
                  onChange={e => { setLabel(e.target.value); setError(null); }}
                  placeholder="e.g. Basement 1 near the corner of the house"
                  className="h-9 text-sm border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white"
                  autoFocus
                />
              </div>
              {/* Optionally attach coordinates even in label mode */}
              <details className="group">
                <summary className="text-xs text-gray-400 dark:text-gray-500 cursor-pointer hover:text-gray-600 dark:hover:text-gray-300 transition select-none">
                  + Also attach GPS coordinates (optional)
                </summary>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Latitude</Label>
                    <Input
                      value={lat}
                      onChange={e => setLat(e.target.value)}
                      placeholder="14.5995"
                      className="h-8 text-sm border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white font-mono"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Longitude</Label>
                    <Input
                      value={lng}
                      onChange={e => setLng(e.target.value)}
                      placeholder="120.9842"
                      className="h-8 text-sm border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white font-mono"
                    />
                  </div>
                </div>
              </details>
            </>
          )}
        </div>

        {/* ── Footer ────────────────────────────────────────────────────── */}
        <div className="shrink-0 px-5 py-4 border-t border-gray-100 dark:border-gray-800 space-y-3">
          {/* Live coordinate preview */}
          {hasCoords && (
            <p className="text-xs font-mono text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
              <MapPin className="w-3 h-3" />
              {fmtDeg(parsedLat!)}, {fmtDeg(parsedLng!)}
              {parseDeg(alt) != null && ` · ${fmtDeg(parseDeg(alt)!)} m`}
            </p>
          )}
          {error && (
            <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
          )}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1 cursor-pointer border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold cursor-pointer"
            >
              <MapPin className="w-4 h-4 mr-2" />
              Confirm Location
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
