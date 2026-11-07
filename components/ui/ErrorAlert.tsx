import { AlertCircle, LogIn, RotateCcw, WifiOff, X } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { describeError } from "@/lib/errors";

interface ErrorAlertProps {
  /** The raw error (Error, string, or anything thrown). `message` is accepted for backward compatibility. */
  error?: unknown;
  message?: string | null;
  /** Overrides the friendly title. */
  title?: string;
  onRetry?: () => void;
  onDismiss?: () => void;
  /** "block" for page/section failures, "inline" for one-line form errors. */
  variant?: "block" | "inline";
  className?: string;
}

/**
 * Friendly error display: plain-language title + message, optional Retry /
 * Dismiss, and the raw error under a collapsed "Technical details" for debugging.
 */
export function ErrorAlert({
  error, message, title, onRetry, onDismiss, variant = "block", className,
}: ErrorAlertProps) {
  const source = error ?? message;
  if (source == null || source === "") return null;
  const info = describeError(source);
  const Icon = info.kind === "network" ? WifiOff : AlertCircle;

  const details = info.detail && (
    <details className="mt-2 text-xs text-red-700/80 dark:text-red-300/80">
      <summary className="cursor-pointer select-none hover:underline">Technical details</summary>
      <code className="mt-1 block whitespace-pre-wrap break-all rounded-md bg-red-100/70 dark:bg-red-950/50 px-2 py-1 font-mono">
        {info.detail}
      </code>
    </details>
  );

  if (variant === "inline") {
    return (
      <div role="alert" className={cn("text-sm text-red-600 dark:text-red-400", className)}>
        <div className="flex items-start gap-2">
          <Icon className="w-4 h-4 mt-0.5 shrink-0" />
          <span className="min-w-0">
            <span className="font-medium">{title ?? info.title}.</span> {info.message}
          </span>
          {onDismiss && (
            <button type="button" onClick={onDismiss} aria-label="Dismiss" className="ml-auto shrink-0 transition hover:opacity-70">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        {details}
      </div>
    );
  }

  return (
    <div
      role="alert"
      className={cn(
        "rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-4 text-sm",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <Icon className="w-5 h-5 mt-0.5 shrink-0 text-red-600 dark:text-red-400" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-red-800 dark:text-red-200">{title ?? info.title}</p>
          <p className="mt-0.5 text-red-700 dark:text-red-300">{info.message}</p>
          {(onRetry || info.kind === "auth") && (
            <div className="mt-3 flex flex-wrap gap-2">
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 hover:bg-red-700 px-3 py-1.5 text-xs font-semibold text-white transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Try again
                </button>
              )}
              {info.kind === "auth" && (
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 dark:border-red-700 px-3 py-1.5 text-xs font-semibold text-red-700 dark:text-red-300 transition hover:bg-red-100 dark:hover:bg-red-900/40"
                >
                  <LogIn className="w-3.5 h-3.5" /> Sign in
                </Link>
              )}
            </div>
          )}
          {details}
        </div>
        {onDismiss && (
          <button type="button" onClick={onDismiss} aria-label="Dismiss" className="shrink-0 text-red-600 dark:text-red-400 transition hover:opacity-70">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

export default ErrorAlert;
