"use client";

import { cn } from "@/lib/utils";
import {
  CheckCircle2, XCircle, MapPin, MapPinOff, AlertTriangle,
  ShieldCheck, Map, Loader2, RefreshCw, CheckSquare, Square,
} from "lucide-react";
import type { ValidationResult } from "@/lib/api";

export function FileResultCard({
  result,
  isNoGps = false,
  isSelected = false,
  displayCoords = null,
  locationLabel = null,
  replaceAccept = ".jpg,.jpeg,.png,.bmp,.tiff",
  overrideLoading = false,
  replaceLoading = false,
  onPreview,
  onToggleSelect,
  onSetLocation,
  onOverride,
  onReplace,
}: {
  result: ValidationResult;
  isNoGps?: boolean;
  isSelected?: boolean;
  displayCoords?: { lat: number; lng: number } | null;
  locationLabel?: string | null;
  replaceAccept?: string;
  overrideLoading?: boolean;
  replaceLoading?: boolean;
  onPreview: () => void;
  onToggleSelect?: () => void;
  onSetLocation?: () => void;
  onOverride?: () => void;
  onReplace?: (file: File) => void;
}) {
  const isLowQuality = result.laplacian_score < result.blur_threshold;
  const isActing = overrideLoading || replaceLoading;
  return (
    <div
      onClick={onToggleSelect ?? onPreview}
      className={cn(
        "bg-white dark:bg-[#161616] rounded-xl border px-3 py-2 transition cursor-pointer",
        isSelected
          ? "border-blue-400 dark:border-blue-600 bg-blue-50/60 dark:bg-blue-950/30"
          : result.is_valid
            ? "border-emerald-200 dark:border-emerald-900/60 hover:border-emerald-400 dark:hover:border-emerald-700"
            : "border-red-200 dark:border-red-900/60 hover:border-red-400 dark:hover:border-red-700"
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        {isNoGps ? (
          <div onClick={e => { e.stopPropagation(); onToggleSelect?.(); }} className="shrink-0 cursor-pointer">
            {isSelected
              ? <CheckSquare className="w-3.5 h-3.5 text-blue-500" />
              : <Square className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600" />}
          </div>
        ) : (
          result.blur_override
            ? <ShieldCheck className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            : result.is_valid
              ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              : <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
        )}

        <span
          className="flex-1 min-w-0 truncate text-xs font-medium text-gray-800 dark:text-gray-100"
          onClick={e => { e.stopPropagation(); onPreview(); }}
        >
          {result.filename}
        </span>

        <span className="shrink-0 font-mono text-[11px] text-gray-400 dark:text-gray-500">
          {result.laplacian_score.toFixed(1)}
          <span className="text-gray-300 dark:text-gray-700">/{result.blur_threshold.toFixed(1)}</span>
        </span>

        {result.blur_override ? (
          <span className="shrink-0 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
            <ShieldCheck className="w-2.5 h-2.5" /> Overridden
          </span>
        ) : (
          <span className={cn(
            "shrink-0 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold",
            isLowQuality
              ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
              : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
          )}>
            {isLowQuality && <AlertTriangle className="w-2.5 h-2.5" />}
            {isLowQuality ? "Low" : "High"}
          </span>
        )}

        {isNoGps ? (
          <>
            <span className="shrink-0 flex items-center gap-0.5 text-[11px] text-gray-300 dark:text-gray-700">
              <MapPinOff className="w-2.5 h-2.5 text-orange-400" /> No GPS
            </span>
            {onSetLocation && (
              <button
                onClick={e => { e.stopPropagation(); onSetLocation(); }}
                className="shrink-0 p-1 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:text-blue-400 dark:hover:bg-blue-950/30 transition cursor-pointer"
                title="Set location"
              >
                <Map className="w-3.5 h-3.5" />
              </button>
            )}
          </>
        ) : (
          <span className="shrink-0 flex items-center gap-0.5 text-[11px] text-gray-400 dark:text-gray-500">
            {displayCoords
              ? <><MapPin className="w-2.5 h-2.5 text-blue-400" />{displayCoords.lat.toFixed(3)}, {displayCoords.lng.toFixed(3)}</>
              : locationLabel
                ? <><MapPin className="w-2.5 h-2.5 text-emerald-400" /><span className="truncate max-w-[80px]">{locationLabel}</span></>
                : <span className="text-gray-300 dark:text-gray-700">No GPS</span>}
          </span>
        )}
      </div>

      {!result.is_valid && result.reason && (
        <p className="mt-0.5 pl-5 text-[10px] text-red-500 dark:text-red-400 truncate">
          {result.reason}
        </p>
      )}

      {!result.is_valid && (onOverride || onReplace) && (
        <div className="mt-1.5 pl-5 flex items-center gap-2" onClick={e => e.stopPropagation()}>
          {onOverride && (
            <button
              onClick={() => onOverride()}
              disabled={isActing}
              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/50 disabled:opacity-50 transition cursor-pointer"
            >
              {overrideLoading
                ? <Loader2 className="w-2.5 h-2.5 animate-spin" />
                : <ShieldCheck className="w-2.5 h-2.5" />}
              Proceed Anyway
            </button>
          )}
          {onReplace && (
            <label
              onClick={e => e.stopPropagation()}
              className={cn(
                "flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold transition",
                isActing
                  ? "bg-blue-50 text-blue-400 dark:bg-blue-950/20 dark:text-blue-600 opacity-50 cursor-not-allowed"
                  : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50 cursor-pointer"
              )}
            >
              <input
                type="file"
                accept={replaceAccept}
                className="hidden"
                disabled={isActing}
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) onReplace(f);
                  e.target.value = "";
                }}
              />
              {replaceLoading
                ? <Loader2 className="w-2.5 h-2.5 animate-spin" />
                : <RefreshCw className="w-2.5 h-2.5" />}
              Replace
            </label>
          )}
        </div>
      )}
    </div>
  );
}

export default FileResultCard;
