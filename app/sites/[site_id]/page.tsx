"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Plus, Layers, Loader2, AlertCircle,
  MapPin, Calendar, ChevronRight, Trash2, ExternalLink, X,
  LogOut, Pencil, Users, BarChart3,
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
import { SiteStatCard } from "@/components/sites/SiteStatCard";
import { JobCard } from "@/components/sites/JobCard";
import { InspectorModal } from "@/components/sites/InspectorModal";
import { CreatedModal } from "@/components/sites/CreatedModal";
import { JobsModal } from "@/components/sites/JobsModal";
import { DefectsModal } from "@/components/sites/DefectsModal";

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
      <div className="min-h-screen bg-gray-50 dark:bg-[#14171e] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error || !site) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#14171e] flex items-center justify-center p-6">
        <div className="text-center">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <p className="text-gray-700 dark:text-gray-300 mb-4">{error ?? "Site not found"}</p>
          <Link href="/inspection" className="text-sm text-blue-600 underline">Back to Sites</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#14171e]">
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
              <span className="truncate max-w-[160px] sm:max-w-xs">{site.address || 'Add location...'}</span>
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

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 items-start">

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
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">

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
                <AlertCircle className="w-8 h-8 mb-2 opacity-40" />
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