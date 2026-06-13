"use client";

import { Calendar } from "lucide-react";
import { ModalShell } from "./ModalShell";
import { ModalHeader } from "./ModalHeader";
import type { SiteResponse, JobStatusResponse } from "@/lib/api";

function formatDate(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

function formatDateTime(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-PH", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function daysSince(iso?: string): string {
  if (!iso) return "—";
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "1 day ago";
  return `${diff} days ago`;
}

export function CreatedModal({
  site, jobs, onClose,
}: {
  site: SiteResponse;
  jobs: JobStatusResponse[];
  onClose: () => void;
}) {
  const jobDates = jobs.map(j => j.created_at).filter(Boolean) as string[];
  const firstJob = jobDates.length ? jobDates.reduce((a, b) => a < b ? a : b) : undefined;
  const lastJob  = jobDates.length ? jobDates.reduce((a, b) => a > b ? a : b) : undefined;

  const rows = [
    { label: "Site created",     value: formatDateTime(site.created_at),  sub: daysSince(site.created_at) },
    { label: "Last updated",     value: formatDateTime(site.updated_at ?? undefined), sub: daysSince(site.updated_at ?? undefined) },
    { label: "First inspection", value: firstJob ? formatDate(firstJob) : "No jobs yet", sub: firstJob ? daysSince(firstJob) : undefined },
    { label: "Latest inspection",value: lastJob  ? formatDate(lastJob)  : "No jobs yet", sub: lastJob  ? daysSince(lastJob)  : undefined },
  ];

  return (
    <ModalShell onClose={onClose}>
      <ModalHeader
        icon={Calendar} iconBg="bg-emerald-50 dark:bg-emerald-950/40" iconColor="text-emerald-500"
        title="Site Timeline" subtitle="Key dates for this inspection site"
        onClose={onClose}
      />
      <div className="flex-1 overflow-y-auto min-h-0 px-5 py-4 space-y-1">
        {rows.map(({ label, value, sub }) => (
          <div key={label} className="flex items-start justify-between gap-4 px-3 py-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50 transition">
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider pt-0.5 shrink-0">{label}</p>
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900 dark:text-white">{value}</p>
              {sub && <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{sub}</p>}
            </div>
          </div>
        ))}

        {jobs.length > 0 && (
          <div className="mt-4 px-3">
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Total inspections</p>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                <div className="h-full rounded-full bg-emerald-500" style={{ width: "100%" }} />
              </div>
              <span className="text-sm font-bold text-gray-900 dark:text-white shrink-0">{jobs.length}</span>
            </div>
          </div>
        )}
      </div>
    </ModalShell>
  );
}

export default CreatedModal;
