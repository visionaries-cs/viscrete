"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Building2, Plus, Layers, Loader2, AlertCircle,
  MapPin, User, Calendar, ChevronRight, Trash2, ExternalLink, X,
  ImageIcon, AlertTriangle, LogOut,
} from "lucide-react";
import { ModeToggle } from "@/components/ui/mode-toggle";
import { getSupabase } from "@/lib/supabase";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { cn } from "@/lib/utils";
import {
  getSite, getJobsForSite, getSiteItems, deleteSite, deleteJob,
  type SiteResponse, type JobStatusResponse,
} from "@/lib/api";

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

const STATUS_COLORS: Record<string, string> = {
  created:      "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  validating:   "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  validated:    "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  failed:       "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  preprocessing:"bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  preprocessed: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  detecting:    "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  detected:     "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  reporting:    "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  completed:    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
};

// ─── Defect Breakdown Card ────────────────────────────────────────────────────

const CLASS_CONFIG: { key: string; label: string; color: string; bg: string }[] = [
  { key: "cracks",   label: "Cracks",   color: "bg-red-500",    bg: "bg-red-500" },
  { key: "spalling", label: "Spalling", color: "bg-yellow-500", bg: "bg-yellow-500" },
  { key: "peeling",  label: "Peeling",  color: "bg-orange-500", bg: "bg-orange-500" },
  { key: "algae",    label: "Algae",    color: "bg-green-500",  bg: "bg-green-500" },
];

function DefectBreakdownCard({ total, classSummary }: { total: number; classSummary: Record<string, number> }) {
  const present = CLASS_CONFIG.filter(c => (classSummary[c.key] ?? 0) > 0);

  return (
    <div className="bg-white dark:bg-[#161616] rounded-xl border border-gray-200 dark:border-gray-800 p-4 flex flex-col gap-2">
      <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Defects</p>
      <div className="flex items-center gap-2">
        <Layers className="w-4 h-4 text-gray-400 shrink-0" />
        <span className="text-sm font-semibold text-gray-900 dark:text-white">{total}</span>
      </div>

      {total > 0 ? (
        <>
          {/* Stacked bar */}
          <div className="flex h-2 w-full rounded-full overflow-hidden gap-px">
            {CLASS_CONFIG.map(c => {
              const count = classSummary[c.key] ?? 0;
              if (count === 0) return null;
              const pct = (count / total) * 100;
              return (
                <div
                  key={c.key}
                  className={cn("h-full transition-all", c.bg)}
                  style={{ width: `${pct}%` }}
                  title={`${c.label}: ${count}`}
                />
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-x-2 gap-y-0.5">
            {present.map(c => (
              <span key={c.key} className="inline-flex items-center gap-1 text-[10px] text-gray-500 dark:text-gray-400">
                <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", c.bg)} />
                {classSummary[c.key]}
              </span>
            ))}
          </div>
        </>
      ) : (
        <div className="h-2 w-full rounded-full bg-gray-100 dark:bg-gray-800" />
      )}
    </div>
  );
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
      {/* Checkbox */}
      <button
        onClick={() => onSelect(job.job_id)}
        className="shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition cursor-pointer"
        style={{
          borderColor: selected ? "#3b82f6" : undefined,
          backgroundColor: selected ? "#3b82f6" : undefined,
        }}
        aria-label={selected ? "Deselect job" : "Select job"}
      >
        {selected && (
          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 8">
            <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      {/* Card body — navigates to job */}
      <Link href={href} className="flex-1 min-w-0 flex items-center justify-between gap-4">
        {/* Left: name + meta + bar */}
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

          {/* Stacked bar + legend */}
          {hasBreakdown && (
            <div className="mt-2 space-y-1">
              {/* Bar */}
              <div className="flex h-1.5 w-full rounded-full overflow-hidden gap-px">
                {CLASS_CONFIG.map(c => {
                  const count = classBreakdown[c.key] ?? 0;
                  if (count === 0) return null;
                  return (
                    <div
                      key={c.key}
                      className={cn("h-full transition-all", c.bg)}
                      style={{ width: `${(count / total) * 100}%` }}
                      title={`${c.label}: ${count}`}
                    />
                  );
                })}
              </div>
              {/* Legend */}
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

        {/* Right: status + date + chevron */}
        <div className="flex items-center gap-3 shrink-0">
          <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", STATUS_COLORS[job.status] ?? STATUS_COLORS.created)}>
            {job.status}
          </span>
          <span className="text-xs text-gray-400 hidden sm:block">{formatDate(job.created_at)}</span>
          <ChevronRight className="w-4 h-4 text-gray-300 dark:text-gray-600 group-hover:text-blue-500 transition" />
        </div>
      </Link>

      {/* Delete button */}
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

// ─── Page ─────────────────────────────────────────────────────────────────────

type PendingDelete =
  | { type: "job";  id: string }
  | { type: "jobs"; ids: string[] }
  | { type: "site" };

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

  useEffect(() => {
    load();
  }, [site_id]);

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
      const byJob: Record<string, Record<string, number>> = {};
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
    setDeleting(true);
    setDeleteError(null);
    try {
      if (pendingDelete.type === "job") {
        await deleteJob(pendingDelete.id);
        setJobs(prev => prev.filter(j => j.job_id !== (pendingDelete as { type: "job"; id: string }).id));
        setSelectedJobIds(prev => { const n = new Set(prev); n.delete((pendingDelete as { type: "job"; id: string }).id); return n; });
        setPendingDelete(null);
      } else if (pendingDelete.type === "jobs") {
        const ids = (pendingDelete as { type: "jobs"; ids: string[] }).ids;
        await Promise.all(ids.map(id => deleteJob(id)));
        setJobs(prev => prev.filter(j => !ids.includes(j.job_id)));
        setSelectedJobIds(new Set());
        setPendingDelete(null);
      } else {
        await deleteSite(site_id);
        router.push("/inspection");
      }
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Deletion failed. Please try again.");
    } finally {
      setDeleting(false);
    }
  }

  const totalDefects = Object.values(floorSummary).reduce((a, b) => a + b, 0);
  const maxFloorCount = Math.max(...Object.values(floorSummary), 1);
  const allSelected = jobs.length > 0 && selectedJobIds.size === jobs.length;

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

  const inspectorLabel =
    [...new Set(jobs.map(j => j.inspector_name).filter(Boolean))].join(", ") ||
    site.inspector_name ||
    "—";

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a]">
      {/* Header */}
      <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-[#111]">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/inspection" className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-gray-900 dark:text-white truncate">{site.name}</h1>
            {site.address && (
              <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                <MapPin className="w-3 h-3" />{site.address}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/sites/${site_id}/items`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 hover:border-blue-300 dark:hover:border-blue-700 transition"
            >
              <Layers className="w-4 h-4" />
              View All Defects
            </Link>
            {email && (
              <span className="hidden sm:block text-xs text-gray-400 dark:text-gray-500 font-mono truncate max-w-[180px]">
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

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">

        {/* Site Info */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Inspector", value: inspectorLabel, icon: User },
            { label: "Created",   value: formatDate(site.created_at), icon: Calendar },
            { label: "Jobs",      value: String(jobs.length), icon: ExternalLink },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="bg-white dark:bg-[#161616] rounded-xl border border-gray-200 dark:border-gray-800 p-4">
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">{label}</p>
              <div className="flex items-center gap-2">
                <Icon className="w-4 h-4 text-gray-400 shrink-0" />
                <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">{value}</span>
              </div>
            </div>
          ))}

          {/* Defect breakdown card */}
          <DefectBreakdownCard total={totalDefects} classSummary={classSummary} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Jobs */}
          <div className="lg:col-span-2 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Inspection Jobs
                </h2>
                {/* Select-all toggle */}
                {jobs.length > 0 && (
                  <button
                    onClick={toggleSelectAll}
                    className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition cursor-pointer"
                  >
                    {allSelected ? "Deselect all" : "Select all"}
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                {/* Delete selected */}
                {selectedJobIds.size > 0 && (
                  <button
                    onClick={() => openDeleteModal({ type: "jobs", ids: [...selectedJobIds] })}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete Selected ({selectedJobIds.size})
                  </button>
                )}
                <Link
                  href={`/upload?site_id=${site_id}`}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  New Job
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

          {/* Floor Summary */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Defects by Floor
            </h2>
            <div className="bg-white dark:bg-[#161616] rounded-2xl border border-gray-200 dark:border-gray-800 p-4 space-y-3">
              {totalDefects === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">No defects detected yet</p>
              ) : (
                Object.entries(floorSummary)
                  .sort(([, a], [, b]) => b - a)
                  .map(([floor, count]) => (
                    <div key={floor}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-gray-700 dark:text-gray-300 font-medium">{floor}</span>
                        <span className="text-gray-500 dark:text-gray-400">{count} defect{count !== 1 ? "s" : ""}</span>
                      </div>
                      <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-blue-500 transition-all"
                          style={{ width: `${(count / maxFloorCount) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))
              )}
              {totalDefects > 0 && (
                <Link
                  href={`/sites/${site_id}/items`}
                  className="flex items-center justify-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline pt-2 border-t border-gray-100 dark:border-gray-800"
                >
                  View all defects <ChevronRight className="w-3 h-3" />
                </Link>
              )}
            </div>

            {/* Danger zone */}
            <div className="bg-white dark:bg-[#161616] rounded-2xl border border-red-100 dark:border-red-900/40 p-4 space-y-3">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Danger Zone</p>
              {jobs.length > 0 && (
                <button
                  onClick={() => openDeleteModal({ type: "jobs", ids: jobs.map(j => j.job_id) })}
                  className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete all jobs
                </button>
              )}
              <button
                onClick={() => openDeleteModal({ type: "site" })}
                className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                Delete this site
              </button>
              <p className="text-xs text-gray-400">Deleting the site does not delete its jobs.</p>
            </div>
          </div>
        </div>
      </main>

      {/* ── Delete confirmation modal ── */}
      {pendingDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => { if (!deleting) { setPendingDelete(null); setDeleteError(null); } }}
        >
          <div
            className="w-full max-w-sm bg-white dark:bg-[#161616] rounded-2xl border border-gray-200 dark:border-gray-800 shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
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
              <button
                onClick={() => { setPendingDelete(null); setDeleteError(null); }}
                disabled={deleting}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition cursor-pointer disabled:opacity-40"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5">
              {pendingDelete.type === "job" && (
                <>
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    Delete job <span className="font-mono font-semibold text-gray-900 dark:text-white">{(pendingDelete as { type: "job"; id: string }).id.slice(0, 8)}…</span>?
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    All uploaded files and detection results will be permanently removed.
                  </p>
                </>
              )}
              {pendingDelete.type === "jobs" && (
                <>
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    Delete <span className="font-semibold text-gray-900 dark:text-white">{(pendingDelete as { type: "jobs"; ids: string[] }).ids.length} job{(pendingDelete as { type: "jobs"; ids: string[] }).ids.length !== 1 ? "s" : ""}</span>?
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    All files and detection results for the selected jobs will be permanently removed.
                  </p>
                </>
              )}
              {pendingDelete.type === "site" && (
                <>
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    Delete site <span className="font-semibold text-gray-900 dark:text-white">{site?.name}</span>?
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    The site record will be removed. Existing jobs will not be affected.
                  </p>
                </>
              )}
              {deleteError && (
                <p className="mt-3 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
                  {deleteError}
                </p>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center gap-3 px-6 py-4 border-t border-gray-100 dark:border-gray-800">
              <button
                onClick={() => { setPendingDelete(null); setDeleteError(null); }}
                disabled={deleting}
                className="flex-1 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition cursor-pointer disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="flex-1 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
