"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useFileUrl } from "@/hooks/useSignedUrl";
import {
  CheckCircle2, XCircle, MapPin, MapPinOff, AlertTriangle,
  ShieldCheck, Map, Loader2, RefreshCw, CheckSquare, Square,
  ChevronLeft, ChevronRight, FileImage,
} from "lucide-react";
import type { ValidationResult } from "@/lib/api";

export function CarouselResultView({
  result,
  index,
  total,
  isNoGps,
  isSelected,
  displayCoords,
  locationLabel,
  replaceAccept = ".jpg,.jpeg,.png,.bmp,.tiff",
  overrideLoading = false,
  replaceLoading = false,
  onPrev,
  onNext,
  onToggleSelect,
  onSetLocation,
  onOverride,
  onReplace,
}: {
  result: ValidationResult;
  index: number;
  total: number;
  isNoGps: boolean;
  isSelected: boolean;
  displayCoords: { lat: number; lng: number } | null;
  locationLabel: string | null;
  replaceAccept?: string;
  overrideLoading?: boolean;
  replaceLoading?: boolean;
  onPrev: () => void;
  onNext: () => void;
  onToggleSelect?: () => void;
  onSetLocation?: () => void;
  onOverride?: () => void;
  onReplace?: (file: File) => void;
}) {
  const [imgLoading, setImgLoading] = useState(true);
  const imageUrl = useFileUrl(result.file_id ?? null);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setImgLoading(true); }, [imageUrl]);

  const isLowQuality = result.laplacian_score < result.blur_threshold;
  const sharpnessPct = Math.min(100, (result.laplacian_score / Math.max(result.blur_threshold, 1)) * 100);

  return (
    <div className="flex flex-col gap-3">
      <div className="aspect-video bg-gray-900 rounded-xl overflow-hidden relative">
        {imageUrl ? (
          <>
            {imgLoading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-gray-600" />
              </div>
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={imageUrl}
              src={imageUrl}
              alt={result.filename}
              className={cn("w-full h-full object-contain transition-opacity duration-200", imgLoading ? "opacity-0" : "opacity-100")}
              onLoad={() => setImgLoading(false)}
              onError={() => setImgLoading(false)}
            />
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-gray-600">
            <FileImage className="w-12 h-12" />
            <span className="text-xs">No preview available</span>
          </div>
        )}
      </div>

      <div className={cn(
        "bg-white dark:bg-[#161616] rounded-xl border p-4 space-y-3",
        result.is_valid
          ? "border-emerald-200 dark:border-emerald-900/60"
          : "border-red-200 dark:border-red-900/60"
      )}>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn(
            "flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold",
            result.blur_override
              ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
              : result.is_valid
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
          )}>
            {result.blur_override
              ? <ShieldCheck className="w-3 h-3" />
              : result.is_valid
                ? <CheckCircle2 className="w-3 h-3" />
                : <XCircle className="w-3 h-3" />}
            {result.blur_override ? "Override accepted" : result.is_valid ? "Valid" : "Invalid"}
          </span>
          <span className={cn(
            "flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold",
            isLowQuality
              ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
              : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
          )}>
            {isLowQuality && <AlertTriangle className="w-3 h-3" />}
            {isLowQuality ? "Low Quality" : "High Quality"}
          </span>
          {isNoGps && onToggleSelect && (
            <button
              onClick={onToggleSelect}
              className="ml-auto flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white transition cursor-pointer"
            >
              {isSelected
                ? <CheckSquare className="w-3.5 h-3.5 text-blue-500" />
                : <Square className="w-3.5 h-3.5" />}
              Select
            </button>
          )}
        </div>

        <p className="text-sm font-semibold text-gray-900 dark:text-white truncate" title={result.filename}>
          {result.filename}
        </p>

        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Sharpness</span>
            <span className="text-xs font-mono text-gray-600 dark:text-gray-300">
              {result.laplacian_score.toFixed(1)}
              <span className="text-gray-400 dark:text-gray-600"> / {result.blur_threshold.toFixed(1)}</span>
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all", isLowQuality ? "bg-amber-400" : "bg-emerald-500")}
              style={{ width: `${sharpnessPct}%` }}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isNoGps ? (
            <>
              <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
                <MapPinOff className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                No GPS data
              </span>
              {onSetLocation && (
                <button
                  onClick={onSetLocation}
                  className="ml-auto flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition cursor-pointer"
                >
                  <Map className="w-3 h-3" /> Set Location
                </button>
              )}
            </>
          ) : displayCoords ? (
            <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
              <MapPin className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              {displayCoords.lat.toFixed(5)}, {displayCoords.lng.toFixed(5)}
            </span>
          ) : locationLabel ? (
            <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
              <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              {locationLabel}
            </span>
          ) : null}
        </div>

        {!result.is_valid && result.reason && (
          <p className="text-xs text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-950/30 rounded-lg px-3 py-2">
            {result.reason}
          </p>
        )}

        {!result.is_valid && (onOverride || onReplace) && (
          <div className="flex items-center gap-3">
            {onOverride && (
              <button
                onClick={onOverride}
                disabled={overrideLoading || replaceLoading}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/50 disabled:opacity-50 transition cursor-pointer"
              >
                {overrideLoading
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <ShieldCheck className="w-3.5 h-3.5" />}
                Proceed Anyway
              </button>
            )}
            {onReplace && (
              <label className={cn(
                "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition",
                overrideLoading || replaceLoading
                  ? "bg-blue-50 text-blue-400 dark:bg-blue-950/20 dark:text-blue-600 opacity-50 cursor-not-allowed"
                  : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50 cursor-pointer"
              )}>
                <input
                  type="file"
                  accept={replaceAccept}
                  className="hidden"
                  disabled={overrideLoading || replaceLoading}
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) onReplace(f);
                    e.target.value = "";
                  }}
                />
                {replaceLoading
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <RefreshCw className="w-3.5 h-3.5" />}
                Replace File
              </label>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={onPrev}
          disabled={index === 0}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#161616] text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          <ChevronLeft className="w-4 h-4" /> Previous
        </button>
        <span className="text-xs font-mono text-gray-500 dark:text-gray-400">
          {index + 1} <span className="text-gray-300 dark:text-gray-700">/</span> {total}
        </span>
        <button
          onClick={onNext}
          disabled={index === total - 1}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#161616] text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          Next <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default CarouselResultView;
