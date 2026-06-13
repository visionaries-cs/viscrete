"use client";

import { cn } from "@/lib/utils";
import { CheckCircle2, XCircle, Loader2, Clock } from "lucide-react";

type StepStatus = "pending" | "in_progress" | "completed" | "failed";

export interface StepState {
  step: number;
  name: string;
  status: StepStatus;
  duration_sec: number | null;
  detail: string | null;
  progress: number | null;
  error: string | null;
}

export function StepItem({ step, isLast }: { step: StepState; isLast: boolean }) {
  return (
    <div className="flex gap-4">
      {/* Icon + connector column */}
      <div className="flex flex-col items-center">
        <div
          className={cn(
            "w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0 transition-all duration-300",
            step.status === "pending" &&
              "border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950",
            step.status === "in_progress" &&
              "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 shadow-sm shadow-emerald-500/30",
            step.status === "completed" &&
              "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30",
            step.status === "failed" &&
              "border-red-500 bg-red-50 dark:bg-red-950/30"
          )}
        >
          {step.status === "pending" && (
            <span className="text-xs font-bold text-gray-400 dark:text-gray-600">
              {step.step}
            </span>
          )}
          {step.status === "in_progress" && (
            <Loader2 className="w-3.5 h-3.5 text-emerald-500 animate-spin" />
          )}
          {step.status === "completed" && (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          )}
          {step.status === "failed" && (
            <XCircle className="w-3.5 h-3.5 text-red-500" />
          )}
        </div>
        {!isLast && (
          <div
            className={cn(
              "w-px flex-1 min-h-[1.5rem] mt-1 transition-colors duration-500",
              step.status === "completed"
                ? "bg-emerald-400 dark:bg-emerald-600"
                : "bg-gray-200 dark:bg-gray-800"
            )}
          />
        )}
      </div>

      {/* Content column */}
      <div className={cn("flex-1 min-w-0", !isLast && "pb-5")}>
        <div className="flex items-start justify-between gap-2">
          <span
            className={cn(
              "text-sm font-semibold leading-5",
              step.status === "pending" &&
                "text-gray-400 dark:text-gray-600",
              step.status === "in_progress" &&
                "text-gray-900 dark:text-white",
              step.status === "completed" &&
                "text-gray-900 dark:text-white",
              step.status === "failed" &&
                "text-red-600 dark:text-red-400"
            )}
          >
            {step.name}
          </span>
          {step.status === "completed" && step.duration_sec != null && (
            <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500 shrink-0 mt-0.5 font-mono tabular-nums">
              <Clock className="w-3 h-3" />
              {step.duration_sec.toFixed(2)}s
            </span>
          )}
        </div>

        {step.status === "completed" && step.detail && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {step.detail}
          </p>
        )}

        {/* Step progress bar — only shown for in_progress steps with a percent */}
        {step.status === "in_progress" && step.progress != null && (
          <div className="mt-2 max-w-sm">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-gray-500 dark:text-gray-400 truncate min-w-0 mr-2">
                {step.detail || "Processing…"}
              </span>
              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 shrink-0 tabular-nums">
                {step.progress}%
              </span>
            </div>
            <div className="h-1.5 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${step.progress}%` }}
              />
            </div>
          </div>
        )}

        {step.status === "failed" && step.error && (
          <p className="text-xs text-red-500 dark:text-red-400 mt-0.5">
            {step.error}
          </p>
        )}
      </div>
    </div>
  );
}

export default StepItem;
