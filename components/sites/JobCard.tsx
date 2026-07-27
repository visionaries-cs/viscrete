"use client";

import Link from "next/link";
import { AlertTriangle, ChevronRight, ImageIcon, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { JobStatusResponse } from "@/lib/api";
import { StatusBadge } from "@/components/ui/StatusBadge";

const CLASS_CONFIG = [
  { key: "cracks", label: "Cracks", bg: "bg-red-500" },
  { key: "spalling", label: "Spalling", bg: "bg-amber-500" },
  { key: "peeling", label: "Peeling", bg: "bg-orange-500" },
  { key: "algae", label: "Algae", bg: "bg-emerald-500" },
] as const;

function formatDate(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

function routeForJob(job: JobStatusResponse): string {
  if (["preprocessing", "preprocessed"].includes(job.status)) return `/preprocess/${job.job_id}`;
  if (["detecting", "detected", "reporting", "completed"].includes(job.status)) return `/results/${job.job_id}`;
  return "/upload";
}

export function JobCard({
  job,
  selected,
  onSelect,
  onDeleteRequest,
  classBreakdown,
}: {
  job: JobStatusResponse;
  selected: boolean;
  onSelect: (jobId: string) => void;
  onDeleteRequest: (jobId: string) => void;
  classBreakdown?: Record<string, number>;
}) {
  const total = job.total_defects ?? 0;
  const hasBreakdown = classBreakdown && total > 0;

  return (
    <div
      className={cn(
        "group flex items-start gap-3 rounded-xl border px-3 py-3 transition-[border-color,background-color,box-shadow] sm:items-center sm:px-4",
        selected
          ? "border-primary/45 bg-primary/[0.04] ring-2 ring-primary/10"
          : "border-border bg-card hover:border-primary/30 hover:shadow-sm",
      )}
    >
      <button
        onClick={() => onSelect(job.job_id)}
        className={cn(
          "mt-1 flex size-5 shrink-0 items-center justify-center rounded-md border transition sm:mt-0",
          selected ? "border-primary bg-primary" : "border-input bg-card hover:border-primary/60",
        )}
        aria-label={selected ? "Deselect job" : "Select job"}
      >
        {selected && (
          <svg className="size-3 text-primary-foreground" fill="none" viewBox="0 0 10 8">
            <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      <Link
        href={routeForJob(job)}
        className="flex min-w-0 flex-1 flex-col justify-between gap-3 sm:flex-row sm:items-center sm:gap-4"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{job.site_location || "Unnamed job"}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="font-mono text-[11px] text-muted-foreground">{job.job_id.slice(0, 8)}…</span>
            {job.file_count != null && (
              <>
                <span className="text-border">·</span>
                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                  <ImageIcon className="size-3" />{job.file_count} files
                </span>
              </>
            )}
            {total > 0 && (
              <>
                <span className="text-border">·</span>
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-600 dark:text-red-300">
                  <AlertTriangle className="size-3" />{total} findings
                </span>
              </>
            )}
          </div>
          {hasBreakdown && (
            <div className="mt-2 space-y-1.5">
              <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted">
                {CLASS_CONFIG.map((item) => {
                  const count = classBreakdown[item.key] ?? 0;
                  if (!count) return null;
                  return <span key={item.key} className={item.bg} style={{ width: `${(count / total) * 100}%` }} />;
                })}
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {CLASS_CONFIG.filter((item) => (classBreakdown[item.key] ?? 0) > 0).map((item) => (
                  <span key={item.key} className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                    <span className={cn("size-1.5 rounded-full", item.bg)} />
                    {item.label} <strong className="font-semibold text-foreground">{classBreakdown[item.key]}</strong>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <StatusBadge status={job.status} />
          <span className="hidden text-xs text-muted-foreground md:block">{formatDate(job.created_at)}</span>
          <ChevronRight className="size-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
        </div>
      </Link>

      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onDeleteRequest(job.job_id);
        }}
        className="shrink-0 rounded-lg p-2 text-muted-foreground transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-300"
        aria-label="Delete job"
      >
        <Trash2 className="size-4" />
      </button>
    </div>
  );
}

export default JobCard;
