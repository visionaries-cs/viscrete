"use client";

import { CheckCircle2, Clock, Loader2 } from "lucide-react";
import { StepItem } from "./StepItem";
import type { StepState } from "./StepItem";

interface CompletedSummary {
  total_processed: number;
  pipeline_type: string;
  duration_sec: number;
}

function formatTime(totalSecs: number): string {
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

export function PreprocessingStepper({
  steps,
  completedSummary,
  elapsedSecs,
  isRunning,
}: {
  steps: StepState[];
  completedSummary: CompletedSummary | null;
  elapsedSecs: number;
  isRunning: boolean;
}) {
  if (steps.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-400 dark:text-gray-600 py-4">
        <Loader2 className="w-4 h-4 animate-spin" />
        Connecting to pipeline…
      </div>
    );
  }

  return (
    <div>
      {/* Vertical step list */}
      <div>
        {steps.map((step, i) => (
          <StepItem key={step.step} step={step} isLast={i === steps.length - 1} />
        ))}
      </div>

      {/* Elapsed timer while running */}
      {isRunning && (
        <div className="mt-4 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <Clock className="w-3.5 h-3.5" />
          <span>
            Elapsed:{" "}
            <span className="font-mono font-semibold text-gray-700 dark:text-gray-200 tabular-nums">
              {formatTime(elapsedSecs)}
            </span>
          </span>
        </div>
      )}

      {/* Summary card after completion */}
      {completedSummary && (
        <div className="mt-5 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
              Pipeline Complete
            </span>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
                Files Processed
              </p>
              <p className="text-2xl font-bold font-mono text-gray-900 dark:text-white tabular-nums">
                {completedSummary.total_processed}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
                Pipeline Type
              </p>
              <p className="text-sm font-bold text-gray-900 dark:text-white capitalize mt-1.5">
                {completedSummary.pipeline_type}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
                Total Duration
              </p>
              <p className="text-2xl font-bold font-mono text-gray-900 dark:text-white tabular-nums">
                {(completedSummary.duration_sec ?? 0).toFixed(2)}s
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PreprocessingStepper;
