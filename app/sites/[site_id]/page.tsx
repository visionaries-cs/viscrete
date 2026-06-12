"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Building2, Plus, Layers, Loader2, AlertCircle,
  MapPin, Calendar, ChevronRight, Trash2, ExternalLink, X,
  ImageIcon, AlertTriangle, LogOut, Pencil, Users, UserPlus,
  Clock, BarChart3,
} from "lucide-react";
import { ModeToggle } from "@/components/ui/mode-toggle";
import { getSupabase } from "@/lib/supabase";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { cn } from "@/lib/utils";
import {
  getSite, getJobsForSite, getSiteItems, deleteSite, deleteJob, updateSite,
  type SiteResponse, type JobStatusResponse,
} from "@/lib/api";
import dynamic from "next/dynamic";

const LocationDisplayMap = dynamic(() => import("@/components/LocationDisplayMap"), { ssr: false });
const LocationPickerMap  = dynamic(() => import("@/components/LocationPickerMap"),  { ssr: false });

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function routeForJob(job: JobStatusResponse): string {
  const s = job.status;
  if (["preprocessing", "preprocessed"].includes(s)) return `/preprocess/${job.job_id}`;
  if (["detecting", "detected"].includes(s))          return `/detect/${job.job_id}`;
  if (["reporting", "completed"].includes(s))          return `/results/${job.job_id}`;
  return `/upload`;
}

function getInitials(name: string): string {
  return name.trim().split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase() || "?";
}

const AVATAR_COLORS = [
  "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
  "bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
  "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300",
  "bg-pink-100 text-pink-700 dark:bg-pink-900/50 dark:text-pink-300",
  "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300",
];

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

// ─── Shared modal shell ───────────────────────────────────────────────────────

function ModalShell({
  onClose,
  children,
  maxWidth = "max-w-md",
}: {
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className={cn(
          "w-full bg-white dark:bg-[#161616] rounded-t-2xl sm:rounded-2xl border border-gray-200 dark:border-gray-800 shadow-2xl flex flex-col max-h-[85dvh] sm:max-h-[80vh]",
          maxWidth,
        )}
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function ModalHeader({
  icon: Icon,
  iconBg,
  iconColor,
  title,
  badge,
  subtitle,
  onClose,
}: {
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  title: string;
  badge?: number | string;
  subtitle?: string;
  onClose: () => void;
}) {
  return (
    <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 dark:border-gray-800 shrink-0">
      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", iconBg)}>
        <Icon className={cn("w-4 h-4", iconColor)} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold text-gray-900 dark:text-white">{title}</h2>
          {badge != null && String(badge) !== "0" && (
            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-[10px] font-bold text-gray-600 dark:text-gray-300">
              {badge}
            </span>
          )}
        </div>
        {subtitle && (
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{subtitle}</p>
        )}
      </div>
      <button
        onClick={onClose}
        className="shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition cursor-pointer"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  onClick,
  children,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ElementType;
  onClick?: () => void;
  children?: React.ReactNode;
}) {
  const cls = "bg-white dark:bg-[#161616] rounded-xl border border-gray-200 dark:border-gray-800 p-4 flex flex-col text-left";
  const interactive = "hover:border-blue-300 dark:hover:border-blue-600 transition group cursor-pointer";

  const inner = (
    <>
      <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">{label}</p>
      <div className="flex items-center gap-2">
        <Icon className={cn("w-4 h-4 shrink-0 text-gray-400", onClick && "group-hover:text-blue-500 transition")} />
        <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">{value}</span>
      </div>
      {children}
      {onClick && (
        <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-2 group-hover:text-blue-400 transition">
          tap to view
        </p>
      )}
    </>
  );

  if (onClick) {
    return <button onClick={onClick} className={cn(cls, interactive)}>{inner}</button>;
  }
  return <div className={cls}>{inner}</div>;
}

// ─── Job Card ─────────────────────────────────────────────────────────────────

function JobCard({
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

// ─── Inspector Modal ──────────────────────────────────────────────────────────

function InspectorModal({
  allInspectors, jobInspectorMap, siteInspectorNames,
  onAdd, onRemove, onClose, saving,
}: {
  allInspectors: string[];
  jobInspectorMap: Record<string, number>;
  siteInspectorNames: string[];
  onAdd: (name: string) => void;
  onRemove: (name: string) => void;
  onClose: () => void;
  saving: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (adding) inputRef.current?.focus(); }, [adding]);

  const isDuplicate = draft.trim() !== "" &&
    allInspectors.map(n => n.toLowerCase()).includes(draft.trim().toLowerCase());

  function handleAdd() {
    const name = draft.trim();
    if (!name || isDuplicate) return;
    onAdd(name);
    setDraft("");
    setAdding(false);
  }

  return (
    <ModalShell onClose={onClose}>
      <ModalHeader
        icon={Users} iconBg="bg-blue-50 dark:bg-blue-950/40" iconColor="text-blue-500"
        title="Inspectors" badge={allInspectors.length}
        subtitle="People who have inspected this site"
        onClose={onClose}
      />

      <div className="flex-1 overflow-y-auto min-h-0 px-3 py-3 space-y-0.5">
        {allInspectors.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <Users className="w-9 h-9 mb-3 opacity-30" />
            <p className="text-sm font-medium">No inspectors yet</p>
            <p className="text-xs mt-1 text-gray-300 dark:text-gray-600">Inspectors appear from jobs or can be added below</p>
          </div>
        ) : (
          allInspectors.map((name, i) => {
            const fromJob  = name in jobInspectorMap;
            const fromSite = siteInspectorNames.includes(name);
            const jobCount = jobInspectorMap[name] ?? 0;
            return (
              <div key={name} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50 transition group">
                <div className={cn("w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 select-none", AVATAR_COLORS[i % AVATAR_COLORS.length])}>
                  {getInitials(name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{name}</p>
                  <div className="mt-0.5">
                    {fromJob ? (
                      <span className="text-[10px] text-gray-400 dark:text-gray-500">{jobCount} job{jobCount !== 1 ? "s" : ""}</span>
                    ) : (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500">added manually</span>
                    )}
                  </div>
                </div>
                {fromSite && !fromJob && (
                  <button onClick={() => onRemove(name)} disabled={saving}
                    className="shrink-0 p-1.5 rounded-lg text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition cursor-pointer opacity-0 group-hover:opacity-100 disabled:opacity-30">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="shrink-0 px-5 py-4 border-t border-gray-100 dark:border-gray-800">
        {adding ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input ref={inputRef} value={draft} onChange={e => setDraft(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleAdd(); if (e.key === "Escape") { setAdding(false); setDraft(""); } }}
                placeholder="Inspector full name…"
                className="flex-1 px-3 py-2 rounded-lg text-sm border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" />
              <button onClick={handleAdd} disabled={!draft.trim() || isDuplicate || saving}
                className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0">
                Add
              </button>
              <button onClick={() => { setAdding(false); setDraft(""); }}
                className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition cursor-pointer shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>
            {isDuplicate && <p className="text-xs text-amber-600 dark:text-amber-400 px-1">This inspector is already on the list.</p>}
          </div>
        ) : (
          <button onClick={() => setAdding(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 text-sm text-gray-400 hover:border-blue-400 hover:text-blue-500 dark:hover:border-blue-600 dark:hover:text-blue-400 transition cursor-pointer">
            <UserPlus className="w-4 h-4" />
            Add Inspector
          </button>
        )}
      </div>
    </ModalShell>
  );
}

// ─── Created Modal ────────────────────────────────────────────────────────────

function CreatedModal({
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

        {/* Activity bar — jobs per month */}
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

// ─── Jobs Modal ───────────────────────────────────────────────────────────────

function JobsModal({
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

// ─── Total Defects Modal ──────────────────────────────────────────────────────

function DefectsModal({
  total, classSummary, floorSummary, siteId, onClose,
}: {
  total: number;
  classSummary: Record<string, number>;
  floorSummary: Record<string, number>;
  siteId: string;
  onClose: () => void;
}) {
  const maxFloor = Math.max(...Object.values(floorSummary), 1);

  return (
    <ModalShell onClose={onClose}>
      <ModalHeader
        icon={BarChart3} iconBg="bg-red-50 dark:bg-red-950/40" iconColor="text-red-500"
        title="Defect Summary" badge={total}
        subtitle="Breakdown by class and floor"
        onClose={onClose}
      />

      <div className="flex-1 overflow-y-auto min-h-0 px-5 py-4 space-y-5">
        {total === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <BarChart3 className="w-9 h-9 mb-3 opacity-30" />
            <p className="text-sm font-medium">No defects detected yet</p>
            <p className="text-xs mt-1 text-gray-300 dark:text-gray-600">Run a detection job to see results here</p>
          </div>
        ) : (
          <>
            {/* Stacked bar */}
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">By Class</p>
              <div className="flex h-3 w-full rounded-full overflow-hidden gap-px mb-4">
                {CLASS_CONFIG.map(c => {
                  const count = classSummary[c.key] ?? 0;
                  if (count === 0) return null;
                  return (
                    <div key={c.key} className={cn("h-full transition-all", c.bg)}
                         style={{ width: `${(count / total) * 100}%` }} title={`${c.label}: ${count}`} />
                  );
                })}
              </div>

              {/* Per-class rows */}
              <div className="space-y-2">
                {CLASS_CONFIG.map(c => {
                  const count = classSummary[c.key] ?? 0;
                  const pct   = total > 0 ? Math.round((count / total) * 100) : 0;
                  return (
                    <div key={c.key} className="flex items-center gap-3">
                      <span className={cn("w-2 h-2 rounded-full shrink-0", c.bg)} />
                      <span className="text-xs text-gray-600 dark:text-gray-300 w-16 shrink-0">{c.label}</span>
                      <div className="flex-1 h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                        <div className={cn("h-full rounded-full transition-all", c.bg)} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs font-semibold text-gray-900 dark:text-white w-6 text-right shrink-0">{count}</span>
                      <span className="text-[10px] text-gray-400 w-8 text-right shrink-0">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* By floor */}
            {Object.keys(floorSummary).length > 0 && (
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">By Floor</p>
                <div className="space-y-2">
                  {Object.entries(floorSummary).sort(([, a], [, b]) => b - a).map(([floor, count]) => (
                    <div key={floor} className="flex items-center gap-3">
                      <span className="text-xs text-gray-600 dark:text-gray-300 w-20 truncate shrink-0">{floor}</span>
                      <div className="flex-1 h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                        <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${(count / maxFloor) * 100}%` }} />
                      </div>
                      <span className="text-xs font-semibold text-gray-900 dark:text-white w-6 text-right shrink-0">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {total > 0 && (
        <div className="shrink-0 px-5 py-4 border-t border-gray-100 dark:border-gray-800">
          <Link
            href={`/sites/${siteId}/items`}
            onClick={onClose}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 text-sm font-medium text-gray-600 dark:text-gray-300 transition"
          >
            View all defects <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      )}
    </ModalShell>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type PendingDelete =
  | { type: "job";  id: string }
  | { type: "jobs"; ids: string[] }
  | { type: "site" };

type ActiveModal = "inspector" | "created" | "jobs" | "defects" | null;

export default function SiteDetailPage() {
  const { site_id } = useParams<{ site_id: string }>();
  const router = useRouter();
  const { email } = useCurrentUser();

  const [site, setSite] = useState<SiteResponse | null>(null);
  const [jobs, setJobs] = useState<JobStatusResponse[]>([]);
  const [floorSummary, setFloorSummary] = useState<Record<string, number>>({});
  const [classSummary, setClassSummary] = useState<Record<string, number>>({});
  const [jobClassMap, setJobClassMap] = useState<Record<string, Record<string, number>>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedJobIds, setSelectedJobIds] = useState<Set<string>>(new Set());
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [editingAddress, setEditingAddress] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);

  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [savingInspector, setSavingInspector] = useState(false);

  useEffect(() => { load(); }, [site_id]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [siteData, jobsData, itemsData] = await Promise.all([
        getSite(site_id),
        getJobsForSite(site_id),
        getSiteItems(site_id),
      ]);
      setSite(siteData);
      setJobs(jobsData);

      const summary: Record<string, number> = {};
      const classes: Record<string, number> = {};
      const byJob:   Record<string, Record<string, number>> = {};
      for (const d of itemsData.defects) {
        const floor = d.floor ?? "Unassigned";
        summary[floor] = (summary[floor] ?? 0) + 1;
        const cls = d.defect_type?.toLowerCase() ?? "unknown";
        classes[cls] = (classes[cls] ?? 0) + 1;
        if (!byJob[d.job_id]) byJob[d.job_id] = {};
        byJob[d.job_id][cls] = (byJob[d.job_id][cls] ?? 0) + 1;
      }
      setFloorSummary(summary);
      setClassSummary(classes);
      setJobClassMap(byJob);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load site");
    } finally {
      setLoading(false);
    }
  }

  function toggleSelect(jobId: string) {
    setSelectedJobIds(prev => {
      const next = new Set(prev);
      if (next.has(jobId)) { next.delete(jobId); } else { next.add(jobId); }
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedJobIds(prev =>
      prev.size === jobs.length ? new Set() : new Set(jobs.map(j => j.job_id))
    );
  }

  function openDeleteModal(pending: PendingDelete) {
    setDeleteError(null);
    setPendingDelete(pending);
  }

  async function handleConfirmDelete() {
    if (!pendingDelete) return;

    if (pendingDelete.type === "job") {
      const id = (pendingDelete as { type: "job"; id: string }).id;
      const snapshot = jobs.find(j => j.job_id === id);
      setJobs(prev => prev.filter(j => j.job_id !== id));
      setSelectedJobIds(prev => { const n = new Set(prev); n.delete(id); return n; });
      setPendingDelete(null);
      try {
        await deleteJob(id);
      } catch (e) {
        if (snapshot) setJobs(prev => [snapshot, ...prev]);
        setDeleteError(e instanceof Error ? e.message : "Failed to delete — item restored.");
      }

    } else if (pendingDelete.type === "jobs") {
      const ids = (pendingDelete as { type: "jobs"; ids: string[] }).ids;
      const snapshot = jobs.filter(j => ids.includes(j.job_id));
      setJobs(prev => prev.filter(j => !ids.includes(j.job_id)));
      setSelectedJobIds(new Set());
      setPendingDelete(null);
      try {
        await Promise.all(ids.map(id => deleteJob(id)));
      } catch (e) {
        setJobs(prev => [...snapshot, ...prev]);
        setDeleteError(e instanceof Error ? e.message : "Failed to delete — items restored.");
      }

    } else {
      setPendingDelete(null);
      router.push("/inspection");
      try { await deleteSite(site_id); } catch { /* already navigated */ }
    }
  }

  async function handleAddressSave(address: string) {
    const previousAddress = site?.address ?? '';
    setSite(prev => prev ? { ...prev, address } : prev);
    setEditingAddress(false);
    try {
      const updated = await updateSite(site_id, { address });
      setSite(updated);
    } catch {
      setSite(prev => prev ? { ...prev, address: previousAddress } : prev);
      setEditingAddress(true);
    }
  }

  async function handleAddInspector(name: string) {
    if (!site) return;
    const currentNames = site.inspector_name
      ? site.inspector_name.split(",").map(s => s.trim()).filter(Boolean)
      : [];
    if (currentNames.map(n => n.toLowerCase()).includes(name.toLowerCase())) return;
    const newCsv = [...currentNames, name].join(", ");
    const previousCsv = site.inspector_name;
    setSite(prev => prev ? { ...prev, inspector_name: newCsv } : prev);
    setSavingInspector(true);
    try {
      const updated = await updateSite(site_id, { inspector_name: newCsv });
      setSite(updated);
    } catch {
      setSite(prev => prev ? { ...prev, inspector_name: previousCsv } : prev);
    } finally {
      setSavingInspector(false);
    }
  }

  async function handleRemoveInspector(name: string) {
    if (!site) return;
    const previousCsv = site.inspector_name;
    const newCsv = site.inspector_name
      .split(",").map(s => s.trim()).filter(s => s && s !== name).join(", ");
    setSite(prev => prev ? { ...prev, inspector_name: newCsv } : prev);
    try {
      const updated = await updateSite(site_id, { inspector_name: newCsv });
      setSite(updated);
    } catch {
      setSite(prev => prev ? { ...prev, inspector_name: previousCsv } : prev);
    }
  }

  // ── Derived data ─────────────────────────────────────────────────────────────
  const jobInspectorMap: Record<string, number> = {};
  jobs.forEach(j => {
    if (j.inspector_name) jobInspectorMap[j.inspector_name] = (jobInspectorMap[j.inspector_name] ?? 0) + 1;
  });
  const siteInspectorNames = site
    ? site.inspector_name.split(",").map(s => s.trim()).filter(Boolean)
    : [];
  const allInspectors = [...new Set([...Object.keys(jobInspectorMap), ...siteInspectorNames])];
  const totalDefects  = Object.values(floorSummary).reduce((a, b) => a + b, 0);
  const maxFloorCount = Math.max(...Object.values(floorSummary), 1);
  const allSelected   = jobs.length > 0 && selectedJobIds.size === jobs.length;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error || !site) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a] flex items-center justify-center p-6">
        <div className="text-center">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <p className="text-gray-700 dark:text-gray-300 mb-4">{error ?? "Site not found"}</p>
          <Link href="/inspection" className="text-sm text-blue-600 underline">← Back to Sites</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a]">
      {/* Header */}
      <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-[#111]">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 flex items-center gap-3 sm:gap-4">
          <Link href="/inspection" className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-gray-900 dark:text-white truncate">{site.name}</h1>
            <button
              onClick={() => { setEditingAddress(true); }}
              className="inline-flex items-center gap-1 mt-0.5 text-xs text-gray-400 hover:text-blue-500 transition group cursor-pointer"
            >
              <MapPin className="w-3 h-3 shrink-0" />
              <span className="truncate max-w-[160px] sm:max-w-xs">{site.address || 'Add location…'}</span>
              <Pencil className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition shrink-0" />
            </button>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <Link
              href={`/sites/${site_id}/items`}
              className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs sm:text-sm text-gray-600 dark:text-gray-300 hover:border-blue-300 dark:hover:border-blue-700 transition"
            >
              <Layers className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">View All Defects</span>
            </Link>
            {email && (
              <span className="hidden md:block text-xs text-gray-400 dark:text-gray-500 font-mono truncate max-w-[160px]">
                {email}
              </span>
            )}
            <ModeToggle />
            <button
              onClick={async () => { await getSupabase().auth.signOut(); router.push('/login'); }}
              title="Sign out"
              className="p-2 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8">

        {/* ── 4 stat cards — identical structure so labels align ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 items-start">

          <StatCard
            label="Inspectors" icon={Users}
            value={allInspectors.length > 0 ? allInspectors.length : "—"}
            onClick={() => setActiveModal("inspector")}
          />

          <StatCard
            label="Created" icon={Calendar}
            value={formatDate(site.created_at)}
            onClick={() => setActiveModal("created")}
          />

          <StatCard
            label="Jobs" icon={ExternalLink}
            value={jobs.length}
            onClick={() => setActiveModal("jobs")}
          />

          {/* Defects card — inline stacked bar under the value row */}
          <StatCard
            label="Total Defects" icon={BarChart3}
            value={totalDefects}
            onClick={() => setActiveModal("defects")}
          >
            {totalDefects > 0 && (
              <div className="flex h-1.5 w-full rounded-full overflow-hidden gap-px mt-2">
                {CLASS_CONFIG.map(c => {
                  const count = classSummary[c.key] ?? 0;
                  if (count === 0) return null;
                  return (
                    <div key={c.key} className={cn("h-full transition-all", c.bg)}
                         style={{ width: `${(count / totalDefects) * 100}%` }}
                         title={`${c.label}: ${count}`} />
                  );
                })}
              </div>
            )}
          </StatCard>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">

          {/* Jobs list */}
          <div className="lg:col-span-2 space-y-3">
            {deleteError && (
              <div className="flex items-center gap-2 p-3 mb-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-600 dark:text-red-400">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {deleteError}
                <button onClick={() => setDeleteError(null)} className="ml-auto shrink-0"><X className="w-3.5 h-3.5" /></button>
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Inspection Jobs
                </h2>
                {jobs.length > 0 && (
                  <button onClick={toggleSelectAll}
                    className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition cursor-pointer">
                    {allSelected ? "Deselect all" : "Select all"}
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                {selectedJobIds.size > 0 && (
                  <button
                    onClick={() => openDeleteModal({ type: "jobs", ids: [...selectedJobIds] })}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Delete Selected ({selectedJobIds.size})</span>
                    <span className="sm:hidden">{selectedJobIds.size}</span>
                  </button>
                )}
                <Link
                  href={`/upload?site_id=${site_id}`}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">New Job</span>
                </Link>
              </div>
            </div>

            {jobs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400 bg-white dark:bg-[#161616] rounded-2xl border border-gray-200 dark:border-gray-800">
                <Building2 className="w-8 h-8 mb-2 opacity-40" />
                <p className="text-sm">No jobs yet</p>
                <Link href={`/upload?site_id=${site_id}`} className="mt-3 text-xs text-blue-600 dark:text-blue-400 underline">
                  Start the first inspection
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {jobs.map(job => (
                  <JobCard
                    key={job.job_id}
                    job={job}
                    selected={selectedJobIds.has(job.job_id)}
                    onSelect={toggleSelect}
                    onDeleteRequest={(id) => openDeleteModal({ type: "job", id })}
                    classBreakdown={jobClassMap[job.job_id]}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Location</h2>
            {site.address ? (
              <LocationDisplayMap address={site.address} />
            ) : (
              <button
                onClick={() => setEditingAddress(true)}
                className="w-full h-24 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 flex flex-col items-center justify-center gap-1.5 text-gray-400 hover:border-blue-400 hover:text-blue-500 transition cursor-pointer"
              >
                <MapPin className="w-5 h-5" />
                <span className="text-xs">Add location</span>
              </button>
            )}

            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider pt-2">
              Defects by Floor
            </h2>
            <div className="bg-white dark:bg-[#161616] rounded-2xl border border-gray-200 dark:border-gray-800 p-4 space-y-3">
              {totalDefects === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">No defects detected yet</p>
              ) : (
                Object.entries(floorSummary).sort(([, a], [, b]) => b - a).map(([floor, count]) => (
                  <div key={floor}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-gray-700 dark:text-gray-300 font-medium">{floor}</span>
                      <span className="text-gray-500 dark:text-gray-400">{count} defect{count !== 1 ? "s" : ""}</span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                      <div className="h-full rounded-full bg-blue-500 transition-all"
                           style={{ width: `${(count / maxFloorCount) * 100}%` }} />
                    </div>
                  </div>
                ))
              )}
              {totalDefects > 0 && (
                <Link href={`/sites/${site_id}/items`}
                  className="flex items-center justify-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline pt-2 border-t border-gray-100 dark:border-gray-800">
                  View all defects <ChevronRight className="w-3 h-3" />
                </Link>
              )}
            </div>

            {/* Danger zone */}
            <div className="bg-white dark:bg-[#161616] rounded-2xl border border-red-100 dark:border-red-900/40 p-4 space-y-3">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Danger Zone</p>
              {jobs.length > 0 && (
                <button onClick={() => openDeleteModal({ type: "jobs", ids: jobs.map(j => j.job_id) })}
                  className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition cursor-pointer">
                  <Trash2 className="w-4 h-4" />Delete all jobs
                </button>
              )}
              <button onClick={() => openDeleteModal({ type: "site" })}
                className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition cursor-pointer">
                <Trash2 className="w-4 h-4" />Delete this site
              </button>
              <p className="text-xs text-gray-400">Deleting the site does not delete its jobs.</p>
            </div>
          </div>
        </div>
      </main>

      {/* ── Stat card modals ── */}
      {activeModal === "inspector" && (
        <InspectorModal
          allInspectors={allInspectors}
          jobInspectorMap={jobInspectorMap}
          siteInspectorNames={siteInspectorNames}
          onAdd={handleAddInspector}
          onRemove={handleRemoveInspector}
          onClose={() => setActiveModal(null)}
          saving={savingInspector}
        />
      )}
      {activeModal === "created" && (
        <CreatedModal site={site} jobs={jobs} onClose={() => setActiveModal(null)} />
      )}
      {activeModal === "jobs" && (
        <JobsModal jobs={jobs} siteId={site_id} onClose={() => setActiveModal(null)} />
      )}
      {activeModal === "defects" && (
        <DefectsModal
          total={totalDefects}
          classSummary={classSummary}
          floorSummary={floorSummary}
          siteId={site_id}
          onClose={() => setActiveModal(null)}
        />
      )}

      {/* ── Edit address dialog ── */}
      {editingAddress && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => { if (!savingAddress) setEditingAddress(false); }}>
          <div className="w-full max-w-2xl bg-white dark:bg-[#161616] rounded-2xl border border-gray-200 dark:border-gray-800 shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
              <h2 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <MapPin className="w-4 h-4 text-blue-500" />Update Location
              </h2>
              <button onClick={() => setEditingAddress(false)} disabled={savingAddress}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition cursor-pointer disabled:opacity-40">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6">
              <LocationPickerMap onConfirm={(address) => handleAddressSave(address)} />
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirmation modal ── */}
      {pendingDelete && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => { if (!deleting) { setPendingDelete(null); setDeleteError(null); } }}>
          <div className="w-full max-w-sm bg-white dark:bg-[#161616] rounded-2xl border border-gray-200 dark:border-gray-800 shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-red-50 dark:bg-red-950/40 flex items-center justify-center shrink-0">
                  <Trash2 className="w-3.5 h-3.5 text-red-500" />
                </div>
                <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                  {pendingDelete.type === "job"  && "Delete Job"}
                  {pendingDelete.type === "jobs" && `Delete ${(pendingDelete as { type: "jobs"; ids: string[] }).ids.length} Job${(pendingDelete as { type: "jobs"; ids: string[] }).ids.length !== 1 ? "s" : ""}`}
                  {pendingDelete.type === "site" && "Delete Site"}
                </h2>
              </div>
              <button onClick={() => { setPendingDelete(null); setDeleteError(null); }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-6 py-5">
              {pendingDelete.type === "job" && (
                <>
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    Delete job <span className="font-mono font-semibold text-gray-900 dark:text-white">{(pendingDelete as { type: "job"; id: string }).id.slice(0, 8)}…</span>?
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">All uploaded files and detection results will be permanently removed.</p>
                </>
              )}
              {pendingDelete.type === "jobs" && (
                <>
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    Delete <span className="font-semibold text-gray-900 dark:text-white">{(pendingDelete as { type: "jobs"; ids: string[] }).ids.length} job{(pendingDelete as { type: "jobs"; ids: string[] }).ids.length !== 1 ? "s" : ""}</span>?
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">All files and detection results for the selected jobs will be permanently removed.</p>
                </>
              )}
              {pendingDelete.type === "site" && (
                <>
                  <p className="text-sm text-gray-700 dark:text-gray-300">Delete site <span className="font-semibold text-gray-900 dark:text-white">{site?.name}</span>?</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">The site record will be removed. Existing jobs will not be affected.</p>
                </>
              )}
            </div>
            <div className="flex items-center gap-3 px-6 py-4 border-t border-gray-100 dark:border-gray-800">
              <button onClick={() => { setPendingDelete(null); setDeleteError(null); }}
                className="flex-1 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition cursor-pointer">
                Cancel
              </button>
              <button onClick={handleConfirmDelete}
                className="flex-1 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition cursor-pointer">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
