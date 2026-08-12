"use client";

import Link from "next/link";
import { ChevronRight, ImageIcon, AlertTriangle, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { JobStatusResponse } from "@/lib/api";

const STATUS_COLORS: Record<string, string> = {
  created:       "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  validating:    "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  validated:     "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  failed:        "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  preprocessing: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  preprocessed:  "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  detecting:     "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  detected:      "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  reporting:     "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  completed:     "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
};

const CLASS_CONFIG: { key: string; label: string; bg: string; border: string; text: string }[] = [
  { key: "cracks",   label: "Cracks",   bg: "bg-red-500",    border: "border-red-200 dark:border-red-900/50",   text: "text-red-600 dark:text-red-400" },
  { key: "spalling", label: "Spalling", bg: "bg-yellow-500", border: "border-yellow-200 dark:border-yellow-900/50", text: "text-yellow-600 dark:text-yellow-400" },
  { key: "peeling",  label: "Peeling",  bg: "bg-orange-500", border: "border-orange-200 dark:border-orange-900/50", text: "text-orange-600 dark:text-orange-400" },
  { key: "algae",    label: "Algae",    bg: "bg-green-500",  border: "border-green-200 dark:border-green-900/50",  text: "text-green-600 dark:text-green-400" },
];

function formatDate(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

function routeForJob(job: JobStatusResponse): string {
  const s = job.status;
  if (["preprocessing", "preprocessed"].includes(s)) return `/preprocess/${job.job_id}`;
  if (["detecting", "detected"].includes(s))          return `/detect/${job.job_id}`;
  if (["reporting", "completed"].includes(s))          return `/results/${job.job_id}`;
  return `/upload`;
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
  const href = routeForJob(job);
  const total = job.total_defects ?? 0;
  const hasBreakdown = classBreakdown && total > 0;

  return (
    <div className={cn(
      "group flex items-center gap-3 px-4 py-3 rounded-xl border transition-all",
      selected
        ? "border-blue-400 dark:border-blue-600 bg-blue-50 dark:bg-blue-950/20"
        : "border-gray-200 dark:border-gray-800 bg-white dark:bg-[#161616] hover:border-blue-300 dark:hover:border-blue-700",
    )}>
      <button
        onClick={() => onSelect(job.job_id)}
        className="shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition cursor-pointer"
        style={{ borderColor: selected ? "#3b82f6" : undefined, backgroundColor: selected ? "#3b82f6" : undefined }}
        aria-label={selected ? "Deselect job" : "Select job"}
      >
        {selected && (
          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 8">
            <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      <Link href={href} className="flex-1 min-w-0 flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
            {job.site_location || "Unnamed job"}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[11px] text-gray-400 font-mono">{job.job_id.slice(0, 8)}…</span>
            {job.file_count != null && (
              <>
                <span className="text-gray-200 dark:text-gray-700">·</span>
                <span className="inline-flex items-center gap-1 text-[11px] text-gray-400 dark:text-gray-500">
                  <ImageIcon className="w-3 h-3 shrink-0" />
                  {job.file_count}
                </span>
              </>
            )}
            {total > 0 && (
              <>
                <span className="text-gray-200 dark:text-gray-700">·</span>
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-500 dark:text-red-400">
                  <AlertTriangle className="w-3 h-3 shrink-0" />
                  {total}
                </span>
              </>
            )}
          </div>
          {hasBreakdown && (
            <div className="mt-2 space-y-1">
              <div className="flex h-1.5 w-full rounded-full overflow-hidden gap-px">
                {CLASS_CONFIG.map(c => {
                  const count = classBreakdown[c.key] ?? 0;
                  if (count === 0) return null;
                  return (
                    <div key={c.key} className={cn("h-full transition-all", c.bg)}
                         style={{ width: `${(count / total) * 100}%` }} title={`${c.label}: ${count}`} />
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-x-2.5 gap-y-0.5">
                {CLASS_CONFIG.filter(c => (classBreakdown[c.key] ?? 0) > 0).map(c => (
                  <span key={c.key} className="inline-flex items-center gap-1 text-[10px] text-gray-500 dark:text-gray-400">
                    <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", c.bg)} />
                    {c.label} <span className="font-medium text-gray-600 dark:text-gray-300">{classBreakdown[c.key]}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", STATUS_COLORS[job.status] ?? STATUS_COLORS.created)}>
            {job.status}
          </span>
          <span className="text-xs text-gray-400 hidden sm:block">{formatDate(job.created_at)}</span>
          <ChevronRight className="w-4 h-4 text-gray-300 dark:text-gray-600 group-hover:text-blue-500 transition" />
        </div>
      </Link>

      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDeleteRequest(job.job_id); }}
        className="shrink-0 p-1.5 rounded-lg text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition cursor-pointer"
        title="Delete job"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export default JobCard;
