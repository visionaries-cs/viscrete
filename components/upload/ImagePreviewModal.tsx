"use client";

import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { useFileUrl } from "@/hooks/useSignedUrl";
import { FileImage, X, XCircle, AlertTriangle } from "lucide-react";
import type { ValidationResult } from "@/lib/api";

export function ImagePreviewModal({ result, onClose }: { result: ValidationResult; onClose: () => void }) {
  const isLowQuality = result.laplacian_score < result.blur_threshold;
  const imageUrl = useFileUrl(result.file_id ?? null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white dark:bg-[#161616] rounded-2xl border border-gray-200 dark:border-gray-800 shadow-2xl w-full max-w-lg overflow-hidden">

        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <span className="flex-1 text-sm font-semibold text-gray-800 dark:text-gray-100 truncate min-w-0">
            {result.filename}
          </span>
          <button
            onClick={onClose}
            className="shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="bg-gray-100 dark:bg-gray-900 flex items-center justify-center" style={{ minHeight: 200, maxHeight: 320, overflow: "hidden" }}>
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt={result.filename} className="max-w-full object-contain" style={{ maxHeight: 320 }} />
          ) : (
            <div className="flex flex-col items-center gap-2 py-14 text-gray-400">
              <FileImage className="w-10 h-10" />
              <span className="text-xs">No preview available</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3 px-4 py-4">
          <div className="bg-gray-50 dark:bg-gray-900 rounded-xl px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1">Laplacian</p>
            <p className="font-mono font-semibold text-sm text-gray-800 dark:text-gray-100">{result.laplacian_score.toFixed(2)}</p>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">thresh: {result.blur_threshold.toFixed(2)}</p>
          </div>

          <div className="bg-gray-50 dark:bg-gray-900 rounded-xl px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1">Quality</p>
            <p className={cn("font-semibold text-sm flex items-center gap-1", isLowQuality ? "text-amber-500 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400")}>
              {isLowQuality && <AlertTriangle className="w-3.5 h-3.5 shrink-0" />}
              {isLowQuality ? "Low" : "High"}
            </p>
          </div>

          <div className="bg-gray-50 dark:bg-gray-900 rounded-xl px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1">GPS</p>
            {result.gps_data?.latitude != null ? (
              <p className="font-mono text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                {result.gps_data.latitude.toFixed(5)}<br />{result.gps_data.longitude!.toFixed(5)}
                {result.gps_data.altitude != null && <><br />{result.gps_data.altitude.toFixed(1)} m</>}
              </p>
            ) : result.gps ? (
              <p className="font-mono text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                {result.gps.lat.toFixed(5)}<br />{result.gps.lng.toFixed(5)}
              </p>
            ) : result.location_label ? (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 leading-relaxed">{result.location_label}</p>
            ) : (
              <p className="text-xs text-gray-400 dark:text-gray-500">No data</p>
            )}
          </div>
        </div>

        {!result.is_valid && result.reason && (
          <div className="mx-4 mb-4 flex items-start gap-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 px-3 py-2 rounded-lg">
            <XCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            {result.reason}
          </div>
        )}
      </div>
    </div>
  );
}

export default ImagePreviewModal;
