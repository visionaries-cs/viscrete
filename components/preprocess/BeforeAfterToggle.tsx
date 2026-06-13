"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { useSignedUrl } from "@/hooks/useSignedUrl";

export function BeforeAfterToggle({
  jobId,
  originalKey,
  processedKey,
  label,
  ciiScore,
  originalContrast,
  processedContrast,
}: {
  jobId: string;
  originalKey: string;
  processedKey: string;
  label: string;
  ciiScore?: number | null;
  originalContrast?: number | null;
  processedContrast?: number | null;
}) {
  const [showProcessed, setShowProcessed] = useState(false);
  const original = useSignedUrl(jobId, originalKey);
  const processed = useSignedUrl(jobId, processedKey);
  const activeContrast = showProcessed ? processedContrast : originalContrast;

  return (
    <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800">
      <div className="px-3 py-2 bg-gray-50 dark:bg-gray-900 flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-gray-600 dark:text-gray-400 truncate min-w-0">
          {label}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          {ciiScore != null && (
            <div
              className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800"
              title={`Contrast Improvement Index\nOriginal contrast: ${originalContrast?.toFixed(6) ?? "—"}\nProcessed contrast: ${processedContrast?.toFixed(6) ?? "—"}`}
            >
              <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
                CII
              </span>
              <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 font-mono tabular-nums">
                {ciiScore.toFixed(2)}
              </span>
              {activeContrast != null && (
                <span className="text-[10px] text-emerald-500/70 dark:text-emerald-500/60 font-mono tabular-nums">
                  ({activeContrast.toFixed(4)})
                </span>
              )}
            </div>
          )}
          <div className="flex items-center gap-1 bg-gray-200 dark:bg-gray-700 rounded-lg p-0.5">
            <button
              onClick={() => setShowProcessed(false)}
              className={cn(
                "px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all",
                !showProcessed
                  ? "bg-white dark:bg-gray-900 text-gray-800 dark:text-white shadow-sm"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              )}
            >
              Original
            </button>
            <button
              onClick={() => setShowProcessed(true)}
              className={cn(
                "px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all",
                showProcessed
                  ? "bg-white dark:bg-gray-900 text-gray-800 dark:text-white shadow-sm"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              )}
            >
              Processed
            </button>
          </div>
        </div>
      </div>
      <div className="relative overflow-hidden bg-black" style={{ aspectRatio: "16/9" }}>
        {(!original && !processed) && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={original ?? undefined}
          alt="Original"
          decoding="async"
          className={cn(
            "absolute inset-0 w-full h-full object-contain transition-opacity duration-300",
            showProcessed ? "opacity-0" : "opacity-100"
          )}
          draggable={false}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={processed ?? undefined}
          alt="Processed"
          decoding="async"
          className={cn(
            "absolute inset-0 w-full h-full object-contain transition-opacity duration-300",
            showProcessed ? "opacity-100" : "opacity-0"
          )}
          draggable={false}
        />
        <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/60 text-white text-[10px] font-semibold">
          {showProcessed ? "PROCESSED" : "ORIGINAL"}
        </div>
      </div>
    </div>
  );
}

export default BeforeAfterToggle;
