"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Plus, Layers, Loader2, AlertCircle,
  MapPin, Calendar, ChevronRight, Trash2, ExternalLink, X,
  Pencil, Users, BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getSite, getJobsForSite, getSiteItems, deleteSite, deleteJob, updateSite,
  type SiteResponse, type JobStatusResponse,
} from "@/lib/api";
import dynamic from "next/dynamic";
import { SiteStatCard } from "@/components/sites/SiteStatCard";
import { JobCard } from "@/components/sites/JobCard";
import { InspectorModal } from "@/components/sites/InspectorModal";
import { CreatedModal } from "@/components/sites/CreatedModal";
import { JobsModal } from "@/components/sites/JobsModal";
import { DefectsModal } from "@/components/sites/DefectsModal";
import AppNav from "@/components/AppNav";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState, ErrorState } from "@/components/app/StatePanel";
import { Button } from "@/components/ui/button";

const LocationDisplayMap = dynamic(() => import("@/components/LocationDisplayMap"), { ssr: false });
const LocationPickerMap  = dynamic(() => import("@/components/LocationPickerMap"),  { ssr: false });

function formatDate(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

const CLASS_CONFIG: { key: string; label: string; bg: string; border: string; text: string }[] = [
  { key: "cracks",   label: "Cracks",   bg: "bg-red-500",    border: "border-red-200 dark:border-red-900/50",   text: "text-red-600 dark:text-red-400" },
  { key: "spalling", label: "Spalling", bg: "bg-yellow-500", border: "border-yellow-200 dark:border-yellow-900/50", text: "text-yellow-600 dark:text-yellow-400" },
  { key: "peeling",  label: "Peeling",  bg: "bg-orange-500", border: "border-orange-200 dark:border-orange-900/50", text: "text-orange-600 dark:text-orange-400" },
  { key: "algae",    label: "Algae",    bg: "bg-green-500",  border: "border-green-200 dark:border-green-900/50",  text: "text-green-600 dark:text-green-400" },
];

type PendingDelete =
  | { type: "job";  id: string }
  | { type: "jobs"; ids: string[] }
  | { type: "site" };

type ActiveModal = "inspector" | "created" | "jobs" | "defects" | null;

export default function SiteDetailPage() {
  const { site_id } = useParams<{ site_id: string }>();
  const router = useRouter();

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
      <div className="app-page">
        <AppNav subtitle="Site overview" />
        <div className="page-container page-main flex min-h-[70vh] items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 size-5 animate-spin" />
          <span className="text-sm">Loading site…</span>
        </div>
      </div>
    );
  }

  if (error || !site) {
    return (
      <div className="app-page">
        <AppNav subtitle="Site overview" />
        <div className="page-container page-main">
          <ErrorState title="Could not open this site" description={error ?? "Site not found"} onRetry={load} />
          <Button variant="outline" className="mt-4" asChild>
            <Link href="/inspection"><ArrowLeft className="size-4" />Back to sites</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-page">
      <AppNav subtitle="Site overview" />

      <main className="page-container page-main space-y-7">
        <PageHeader
          eyebrow="Site overview"
          title={site.name}
          description={site.description || "Review inspection activity, defect distribution, and job progress for this location."}
          meta={
            <>
              <button onClick={() => setEditingAddress(true)} className="group inline-flex items-center gap-1.5 hover:text-primary">
                <MapPin className="size-3.5" />
                <span>{site.address || "Add site location"}</span>
                <Pencil className="size-3 opacity-50 group-hover:opacity-100" />
              </button>
              <span className="inline-flex items-center gap-1.5"><Calendar className="size-3.5" />Created {formatDate(site.created_at)}</span>
            </>
          }
          actions={
            <>
              <Button variant="outline" asChild className="flex-1 sm:flex-none">
                <Link href={`/sites/${site_id}/items`}><Layers className="size-4" />Defect register</Link>
              </Button>
              <Button asChild className="flex-1 sm:flex-none">
                <Link href={`/upload?site_id=${site_id}`}><Plus className="size-4" />New inspection</Link>
              </Button>
            </>
          }
        />

        <section className="grid grid-cols-2 items-start gap-3 sm:grid-cols-4 sm:gap-4" aria-label="Site summary">

          <SiteStatCard
            label="Inspectors" icon={Users}
            value={allInspectors.length > 0 ? allInspectors.length : "—"}
            onClick={() => setActiveModal("inspector")}
          />

          <SiteStatCard
            label="Created" icon={Calendar}
            value={formatDate(site.created_at)}
            onClick={() => setActiveModal("created")}
          />

          <SiteStatCard
            label="Jobs" icon={ExternalLink}
            value={jobs.length}
            onClick={() => setActiveModal("jobs")}
          />

          <SiteStatCard
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
          </SiteStatCard>
        </section>

        <div className="grid grid-cols-1 gap-7 lg:grid-cols-[minmax(0,1fr)_21rem]">

          <section className="min-w-0 space-y-3">
            {deleteError && (
              <div className="flex items-center gap-2 p-3 mb-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-600 dark:text-red-400">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {deleteError}
                <button onClick={() => setDeleteError(null)} className="ml-auto shrink-0"><X className="w-3.5 h-3.5" /></button>
              </div>
            )}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div>
                  <h2 className="text-base font-semibold text-foreground">Inspection jobs</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">{jobs.length} {jobs.length === 1 ? "job" : "jobs"} at this site</p>
                </div>
                {jobs.length > 0 && (
                  <button onClick={toggleSelectAll}
                    className="text-xs font-semibold text-primary hover:underline">
                    {allSelected ? "Clear selection" : "Select all"}
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                {selectedJobIds.size > 0 && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => openDeleteModal({ type: "jobs", ids: [...selectedJobIds] })}
                  >
                    <Trash2 className="size-4" />
                    <span className="hidden sm:inline">Delete selected ({selectedJobIds.size})</span>
                    <span className="sm:hidden">{selectedJobIds.size}</span>
                  </Button>
                )}
                <Button size="sm" asChild>
                  <Link href={`/upload?site_id=${site_id}`}><Plus className="size-4" />New job</Link>
                </Button>
              </div>
            </div>

            {jobs.length === 0 ? (
              <EmptyState
                icon={Layers}
                title="No inspections at this site"
                description="Start the first image inspection to create a baseline and begin tracking findings."
                actionLabel="Start inspection"
                onAction={() => router.push(`/upload?site_id=${site_id}`)}
              />
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
          </section>

          <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            <h2 className="section-kicker">Location</h2>
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

            <h2 className="section-kicker pt-2">
              Findings by floor
            </h2>
            <div className="surface-panel space-y-4 p-4">
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
                      <div className="h-full rounded-full bg-primary transition-all"
                           style={{ width: `${(count / maxFloorCount) * 100}%` }} />
                    </div>
                  </div>
                ))
              )}
              {totalDefects > 0 && (
                <Link href={`/sites/${site_id}/items`}
                  className="flex items-center justify-center gap-1 border-t pt-3 text-xs font-semibold text-primary hover:underline">
                  Open defect register <ChevronRight className="size-3" />
                </Link>
              )}
            </div>

            <div className="rounded-2xl border border-red-200/70 bg-card p-4 dark:border-red-900/50">
              <p className="section-kicker text-red-600 dark:text-red-300">Danger zone</p>
              <div className="mt-3 space-y-3">
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
              <p className="text-xs leading-5 text-muted-foreground">Deleting the site does not delete its jobs.</p>
              </div>
            </div>
          </aside>
        </div>
      </main>

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
                    Delete job <span className="font-mono font-semibold text-gray-900 dark:text-white">{(pendingDelete as { type: "job"; id: string }).id.slice(0, 8)}...</span>?
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
