"use client";

import Link from "next/link";
import { ExternalLink, Building2, ImageIcon, AlertTriangle, ChevronRight, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { ModalShell } from "./ModalShell";
import { ModalHeader } from "./ModalHeader";
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

export function JobsModal({
  jobs, siteId, onClose,
}: {
  jobs: JobStatusResponse[];
  siteId: string;
  onClose: () => void;
}) {
  return (
    <ModalShell onClose={onClose} maxWidth="max-w-lg">
      <ModalHeader
        icon={ExternalLink} iconBg="bg-purple-50 dark:bg-purple-950/40" iconColor="text-purple-500"
        title="Inspection Jobs" badge={jobs.length}
        subtitle="All jobs linked to this site"
        onClose={onClose}
      />

      <div className="flex-1 overflow-y-auto min-h-0 px-3 py-3 space-y-1">
        {jobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <Building2 className="w-9 h-9 mb-3 opacity-30" />
            <p className="text-sm font-medium">No jobs yet</p>
            <p className="text-xs mt-1 text-gray-300 dark:text-gray-600">Start the first inspection below</p>
          </div>
        ) : (
          jobs.map(job => {
            const total = job.total_defects ?? 0;
            return (
              <Link
                key={job.job_id}
                href={routeForJob(job)}
                onClick={onClose}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50 transition group"
              >
                <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full shrink-0", STATUS_COLORS[job.status] ?? STATUS_COLORS.created)}>
                  {job.status}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {job.site_location || "Unnamed job"}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-gray-400 font-mono">{job.job_id.slice(0, 8)}…</span>
                    {job.file_count != null && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-gray-400">
                        <ImageIcon className="w-3 h-3" />{job.file_count}
                      </span>
                    )}
                    {total > 0 && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-red-500 dark:text-red-400">
                        <AlertTriangle className="w-3 h-3" />{total}
                      </span>
                    )}
                  </div>
                </div>
                <div className="shrink-0 flex flex-col items-end gap-0.5">
                  <span className="text-[10px] text-gray-400">{formatDate(job.created_at)}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 group-hover:text-blue-500 transition" />
                </div>
              </Link>
            );
          })
        )}
      </div>

      <div className="shrink-0 px-5 py-4 border-t border-gray-100 dark:border-gray-800">
        <Link
          href={`/upload?site_id=${siteId}`}
          onClick={onClose}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 text-sm text-gray-400 hover:border-blue-400 hover:text-blue-500 dark:hover:border-blue-600 dark:hover:text-blue-400 transition"
        >
          <Plus className="w-4 h-4" />
          New Inspection Job
        </Link>
      </div>
    </ModalShell>
  );
}

export default JobsModal;
