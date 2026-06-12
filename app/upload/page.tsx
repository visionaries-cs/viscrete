"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useFileUrl } from "@/hooks/useSignedUrl";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  createJob,
  validateFiles,
  overrideFile,
  replaceFile,
  listJobs,
  deleteJob,
  updateLocation,
  listSites,
  createSite,
  type JobStatusResponse,
  type ValidationResult,
  type LocationUpdateRequest,
  type SiteResponse,
} from "@/lib/api";
import LocationPickerModal, {
  type LocationPickerResult,
} from "@/components/LocationPickerModal";
import {
  Upload,
  Loader2,
  CheckCircle2,
  XCircle,
  MapPin,
  MapPinOff,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Trash2,
  FileImage,
  Clock,
  AlertCircle,
  AlertTriangle,
  X,
  Map,
  Layers,
  CheckSquare,
  Square,
  FileText,
  Plus,
  LayoutList,
  GalleryHorizontal,
  RefreshCw,
  ShieldCheck,
  User,
  Building2,
} from "lucide-react";
import { ModeToggle } from "@/components/ui/mode-toggle";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return (bytes / Math.pow(k, i)).toFixed(1) + " " + sizes[i];
}

function toInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) return name;
  return words.map(w => w[0].toUpperCase()).join('');
}

function formatDate(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function routeForJob(job: JobStatusResponse): string {
  const s = job.status;
  if (["preprocessing", "preprocessed"].includes(s))
    return `/preprocess/${job.job_id}`;
  if (["detecting", "detected", "reporting", "completed"].includes(s))
    return `/results/${job.job_id}`;
  return `/upload`; // created / validating / validated / failed
}

const STATUS_COLORS: Record<string, string> = {
  created: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  validating: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  validated: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  failed: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  preprocessing: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  preprocessed: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  detecting: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  detected: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  reporting: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
};

const JOBS_PER_PAGE = 5;
const RESULTS_PER_PAGE = 12;

// ─── Site Picker Modal ────────────────────────────────────────────────────────

function SitePickerModal({
  open,
  sites,
  sitesLoading,
  onConfirm,
  onClose,
  onCreateSite,
}: {
  open: boolean;
  sites: SiteResponse[];
  sitesLoading: boolean;
  onConfirm: (site: SiteResponse) => void;
  onClose: () => void;
  onCreateSite: (name: string) => Promise<SiteResponse>;
}) {
  const [selectedId, setSelectedId] = useState("");
  const [createName, setCreateName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset local state whenever modal opens
  const [lastOpen, setLastOpen] = useState(false);
  if (open && !lastOpen) { setSelectedId(""); setCreateName(""); setError(null); setLastOpen(true); }
  if (!open && lastOpen) { setLastOpen(false); }

  if (!open) return null;

  async function handleCreate() {
    if (!createName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const site = await onCreateSite(createName.trim());
      onConfirm(site);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create site");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#161616] rounded-2xl border border-gray-200 dark:border-gray-700 shadow-2xl w-full max-w-sm">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Inspection Site</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">

          {/* Select existing */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Select an existing site
            </label>
            {sitesLoading ? (
              <div className="flex items-center gap-2 text-xs text-gray-400 py-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                Loading sites…
              </div>
            ) : (
              <select
                value={selectedId}
                onChange={e => setSelectedId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              >
                <option value="">— Choose a site —</option>
                {sites.map(s => (
                  <option key={s.site_id} value={s.site_id}>
                    {s.name}{s.address ? ` · ${s.address}` : ""}
                  </option>
                ))}
              </select>
            )}
            {sites.length === 0 && !sitesLoading && (
              <p className="text-xs text-gray-400 mt-1">No sites yet — create one below.</p>
            )}
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
            <span className="text-xs text-gray-400">or create new</span>
            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
          </div>

          {/* Create new */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
              New site name
            </label>
            <input
              type="text"
              placeholder="e.g. Rizal Hall Block A"
              value={createName}
              onChange={e => setCreateName(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleCreate(); } }}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            />
            <button
              type="button"
              onClick={handleCreate}
              disabled={!createName.trim() || creating}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold transition"
            >
              {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              {creating ? "Creating…" : "Create & Select"}
            </button>
          </div>

          {error && (
            <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />{error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 pb-5">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-xs text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!selectedId}
            onClick={() => {
              const site = sites.find(s => s.site_id === selectedId) ?? null;
              if (site) onConfirm(site);
            }}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white transition"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

function UploadPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const siteId = searchParams.get("site_id");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Form state
  const [siteName, setSiteName] = useState("");
  const [inspectorName, setInspectorName] = useState("");
  const [floor, setFloor] = useState("");

  // ── Site linkage
  const [activeSiteId, setActiveSiteId] = useState<string | null>(siteId);
  const [availableSites, setAvailableSites] = useState<SiteResponse[]>([]);
  const [sitesLoading, setSitesLoading] = useState(false);
  const [sitePickerOpen, setSitePickerOpen] = useState(false);

  // ── File state
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  // ── Upload / validation state
  const [isUploading, setIsUploading] = useState(false);
  const [validationResults, setValidationResults] = useState<ValidationResult[] | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  // fileActionLoading: tracks in-progress override/replace per file_id
  const [fileActionLoading, setFileActionLoading] = useState<Record<string, 'override' | 'replace'>>({});

  // ── Validation filters
  const [gpsFilter, setGpsFilter] = useState<"all" | "with" | "without">("all");
  const [blurFilter, setBlurFilter] = useState<"all" | "sharp" | "blurry">("all");
  const [resultsPage, setResultsPage] = useState(1);

  // ── Results view mode
  const [viewMode, setViewMode] = useState<"list" | "carousel">("list");
  const [carouselIndex, setCarouselIndex] = useState(0);
  const filteredLengthRef = useRef(0);

  // ── Previous jobs
  const [jobs, setJobs] = useState<JobStatusResponse[]>([]);
  const [jobsPage, setJobsPage] = useState(1);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [jobsError, setJobsError] = useState<string | null>(null);
  const [deletingJobId, setDeletingJobId] = useState<string | null>(null);
  const [selectedJobIds, setSelectedJobIds] = useState<Set<string>>(new Set());
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);
  const [jobSearch, setJobSearch] = useState("");
  const [jobSort, setJobSort] = useState<"date_desc" | "date_asc" | "site_asc" | "site_desc" | "inspector_asc" | "inspector_desc">("date_desc");

  // ── Image preview modal — store filename so we always look up the live record
  const [previewFilename, setPreviewFilename] = useState<string | null>(null);
  const previewResult = previewFilename
    ? (validationResults ?? []).find(r => r.filename === previewFilename) ?? null
    : null;

  // ── Toast
  const [toast, setToast] = useState<{ msg: string; type: "error" | "warn" } | null>(null);

  // ── Location state
  // selectedFilenames: selection keys are filenames (file_id is optional on ValidationResult)
  // modalCtx: "batch" | "select" | filename string (single) | null
  const [selectedFilenames, setSelectedFilenames] = useState<Set<string>>(new Set());
  type ModalContext = "batch" | "select" | string | null;
  const [modalCtx, setModalCtx] = useState<ModalContext>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<ModalContext>(null);

  // Reset results page + carousel index when filters or results change
  useEffect(() => { setResultsPage(1); setCarouselIndex(0); }, [gpsFilter, blurFilter, validationResults]);
  // Reset jobs page when search/sort changes
  useEffect(() => { setJobsPage(1); }, [jobSearch, jobSort]);

  // Keyboard navigation for carousel mode — reads length from ref so the
  // effect doesn't depend on filteredResults (computed later in the body).
  useEffect(() => {
    if (viewMode !== "carousel") return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "ArrowLeft")  setCarouselIndex(i => Math.max(0, i - 1));
      if (e.key === "ArrowRight") setCarouselIndex(i => Math.min(filteredLengthRef.current - 1, i + 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [viewMode]);

  // Load previous jobs and available sites on mount
  useEffect(() => {
    loadJobs();
    (async () => {
      setSitesLoading(true);
      try {
        const data = await listSites();
        setAvailableSites(data);
        if (siteId) {
          const match = data.find(s => s.site_id === siteId);
          if (match) setSiteName(match.name);
        }
      } catch { /* site list is optional */ }
      finally { setSitesLoading(false); }
    })();
  }, []);

  async function loadJobs() {
    setJobsLoading(true);
    setJobsError(null);
    try {
      const data = await listJobs();
      // newest first
      setJobs(data.sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? "")));
    } catch (e: unknown) {
      setJobsError(e instanceof Error ? e.message : "Failed to load jobs");
    } finally {
      setJobsLoading(false);
    }
  }

  async function handleDeleteJob(e: React.MouseEvent, jobId: string) {
    e.stopPropagation();
    setDeletingJobId(jobId);
    try {
      await deleteJob(jobId);
      setJobs(prev => prev.filter(j => j.job_id !== jobId));
      setSelectedJobIds(prev => { const n = new Set(prev); n.delete(jobId); return n; });
      // Clamp page if needed after removal
      setJobsPage(prev => {
        const remaining = jobs.length - 1;
        const maxPage = Math.max(1, Math.ceil(remaining / JOBS_PER_PAGE));
        return Math.min(prev, maxPage);
      });
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Failed to delete job");
    } finally {
      setDeletingJobId(null);
    }
  }

  function toggleSelectJob(e: React.MouseEvent, jobId: string) {
    e.stopPropagation();
    setSelectedJobIds(prev => {
      const next = new Set(prev);
      next.has(jobId) ? next.delete(jobId) : next.add(jobId);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedJobIds.size === filteredSortedJobs.length) {
      setSelectedJobIds(new Set());
    } else {
      setSelectedJobIds(new Set(filteredSortedJobs.map(j => j.job_id)));
    }
  }

  async function handleBatchDelete() {
    if (selectedJobIds.size === 0) return;
    setIsBatchDeleting(true);
    const ids = Array.from(selectedJobIds);
    const results = await Promise.allSettled(ids.map(id => deleteJob(id)));
    const failed = results.filter(r => r.status === "rejected").length;
    if (failed > 0) showToast(`${failed} job${failed > 1 ? "s" : ""} could not be deleted`);
    setJobs(prev => prev.filter(j => !selectedJobIds.has(j.job_id)));
    setSelectedJobIds(new Set());
    setJobsPage(1);
    setIsBatchDeleting(false);
  }

  function showToast(msg: string, type: "error" | "warn" = "error") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }

  // ── Drag handlers
  const handleDragEnter = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(e.dataTransfer.files);
  };

  const IMAGE_TYPES = ["image/jpeg", "image/png", "image/bmp", "image/tiff"];
  const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

  function addFiles(fileList: FileList | null) {
    if (!fileList) return;
    const allowed = IMAGE_TYPES;
    const maxSize = MAX_IMAGE_BYTES;

    const valid: File[] = [];
    for (const f of Array.from(fileList)) {
      if (!allowed.includes(f.type)) {
        showToast(`${f.name}: unsupported type`, "warn");
        continue;
      }
      if (f.size > maxSize) {
        showToast(`${f.name} exceeds ${formatBytes(maxSize)} limit`, "warn");
        continue;
      }
      valid.push(f);
    }
    setFiles(prev => {
      const existing = new Set(prev.map(x => x.name + x.size));
      return [...prev, ...valid.filter(f => !existing.has(f.name + f.size))];
    });
    setValidationResults(null);
  }

  function removeFile(idx: number) {
    setFiles(prev => prev.filter((_, i) => i !== idx));
    setValidationResults(null);
  }

  // Derived: true once at least one file is valid (includes overridden files)
  const canProceed = !!(validationResults && validationResults.some(r => r.is_valid) && jobId && !isUploading);
  const replaceAccept = ".jpg,.jpeg,.png,.bmp,.tiff";

  const canUpload =
    siteName.trim().length > 0 &&
    inspectorName.trim().length > 0 &&
    files.length > 0 &&
    !isUploading;

  async function handleUpload() {
    setUploadError(null);
    setIsUploading(true);
    setValidationResults(null);
    try {
      const job = await createJob('image', siteName.trim(), inspectorName.trim(), activeSiteId, floor.trim() || null);
      setJobId(job.job_id);
      const results = await validateFiles(job.job_id, files);
      setValidationResults(results);
      const hasValid = results.some(r => r.is_valid);
      if (!hasValid) setUploadError("All files failed validation. Use 'Proceed Anyway' on individual files or replace them.");
      // Refresh previous jobs list
      loadJobs();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      if (msg.toLowerCase().includes("unavailable") || msg.toLowerCase().includes("fetch")) {
        showToast("Backend unavailable — is the server running?");
      } else {
        setUploadError(msg);
      }
    } finally {
      setIsUploading(false);
    }
  }

  function handleProceed() {
    if (jobId) router.push(`/preprocess/${encodeURIComponent(jobId)}`);
  }

  async function handleOverride(fileId: string) {
    if (!jobId) return;
    setFileActionLoading(prev => ({ ...prev, [fileId]: 'override' }));
    try {
      await overrideFile(jobId, fileId);
      setValidationResults(prev => prev ? prev.map(r =>
        r.file_id === fileId ? { ...r, is_valid: true, blur_override: true } : r
      ) : prev);
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Failed to override file');
    } finally {
      setFileActionLoading(prev => { const n = { ...prev }; delete n[fileId]; return n; });
    }
  }

  async function handleReplace(fileId: string, newFile: File) {
    if (!jobId) return;
    setFileActionLoading(prev => ({ ...prev, [fileId]: 'replace' }));
    try {
      const result = await replaceFile(jobId, fileId, newFile);
      setValidationResults(prev => prev ? prev.map(r =>
        r.file_id === fileId ? { ...result, file_id: fileId } : r
      ) : prev);
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Failed to replace file');
    } finally {
      setFileActionLoading(prev => { const n = { ...prev }; delete n[fileId]; return n; });
    }
  }

  // ── Location helpers ─────────────────────────────────────────────────────────

  function toLocationPayload(result: LocationPickerResult): LocationUpdateRequest {
    const p: LocationUpdateRequest = {};
    if (result.latitude != null && result.longitude != null) {
      p.latitude  = result.latitude;
      p.longitude = result.longitude;
      if (result.altitude != null) p.altitude = result.altitude;
    }
    if (result.location_label) p.location_label = result.location_label;
    return p;
  }

  // Optimistically apply a confirmed location into validationResults.
  // The backend PATCH only writes to metadata.json — re-fetching the job DB record
  // would return stale null GPS data, so we update local state directly.
  function applyLocationToResults(
    payload: LocationUpdateRequest,
    ctx: typeof modalCtx,
    capturedSelected: Set<string>,
  ) {
    const newGpsData = payload.latitude != null && payload.longitude != null
      ? { latitude: payload.latitude, longitude: payload.longitude, altitude: payload.altitude ?? null }
      : null;
    const newLabel = payload.location_label ?? null;

    setValidationResults(prev =>
      prev ? prev.map(r => {
        const isTargeted =
          ctx === "batch"  ? (r.gps_data?.latitude == null && r.gps == null && !r.location_label) :
          ctx === "select" ? capturedSelected.has(r.filename) :
          r.filename === ctx;
        if (!isTargeted) return r;
        const updatedGps   = newGpsData ?? r.gps_data ?? null;
        const updatedLabel = newLabel   ?? r.location_label ?? null;
        return { ...r, gps_data: updatedGps, location_label: updatedLabel };
      }) : prev
    );
  }

  // No-GPS eligible files — keyed by filename (file_id is optional on ValidationResult)
  const noGpsFilenames = (validationResults ?? [])
    .filter(r => r.gps_data?.latitude == null && r.gps == null && !r.location_label)
    .map(r => r.filename);

  const eligibleCount = noGpsFilenames.length;

  function toggleSelectFilename(filename: string) {
    setSelectedFilenames(prev => {
      const next = new Set(prev);
      next.has(filename) ? next.delete(filename) : next.add(filename);
      return next;
    });
  }

  function selectAllEligible() { setSelectedFilenames(new Set(noGpsFilenames)); }
  function clearSelection()    { setSelectedFilenames(new Set()); }

  // Resolve filenames → file_ids for the PATCH payload
  function fileIdsForFilenames(filenames: Iterable<string>): string[] {
    const all = validationResults ?? [];
    return [...filenames].flatMap(name => {
      const match = all.find(r => r.filename === name);
      return match?.file_id ? [match.file_id] : [];
    });
  }

  async function handleLocationConfirm(result: LocationPickerResult) {
    if (!jobId) return;
    const payload = toLocationPayload(result);
    if (!payload.latitude && !payload.location_label) return;

    // Capture before clearSelection() mutates the set
    const capturedSelected = new Set(selectedFilenames);

    setSaving(true);
    setSaveError(null);
    try {
      if (modalCtx === "batch") {
        await updateLocation(jobId, payload);
      } else if (modalCtx === "select") {
        const file_ids = fileIdsForFilenames(selectedFilenames);
        await updateLocation(jobId, { ...payload, ...(file_ids.length ? { file_ids } : {}) });
        clearSelection();
      } else if (typeof modalCtx === "string") {
        // modalCtx is a filename for single mode
        const file_ids = fileIdsForFilenames([modalCtx]);
        await updateLocation(jobId, { ...payload, ...(file_ids.length ? { file_ids } : {}) });
      }
      setSaveSuccess(modalCtx);
      setModalCtx(null);
      applyLocationToResults(payload, modalCtx, capturedSelected);
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setSaving(false);
    }
  }

  // ── Filter validation results
  const filteredResults = (validationResults ?? []).filter(r => {
    const hasGps = r.gps_data?.latitude != null || r.gps != null || !!r.location_label;
    if (gpsFilter === "with" && !hasGps) return false;
    if (gpsFilter === "without" && hasGps) return false;
    const isLowQuality = r.laplacian_score < r.blur_threshold;
    if (blurFilter === "sharp" && isLowQuality) return false;
    if (blurFilter === "blurry" && !isLowQuality) return false;
    return true;
  });

  filteredLengthRef.current = filteredResults.length;

  // ── Jobs filter + sort
  const getSite = (j: JobStatusResponse) => j.site_name ?? j.site_location ?? "";

  const filteredSortedJobs = jobs
    .filter(j => {
      if (!jobSearch.trim()) return true;
      const q = jobSearch.trim().toLowerCase();
      return getSite(j).toLowerCase().includes(q) ||
             (j.inspector_name ?? "").toLowerCase().includes(q);
    })
    .sort((a, b) => {
      switch (jobSort) {
        case "date_asc":  return (a.created_at ?? "").localeCompare(b.created_at ?? "");
        case "site_asc":  return getSite(a).localeCompare(getSite(b));
        case "site_desc": return getSite(b).localeCompare(getSite(a));
        case "inspector_asc":  return (a.inspector_name ?? "").localeCompare(b.inspector_name ?? "");
        case "inspector_desc": return (b.inspector_name ?? "").localeCompare(a.inspector_name ?? "");
        default: return (b.created_at ?? "").localeCompare(a.created_at ?? ""); // date_desc
      }
    });

  // ── Pagination
  const totalPages = Math.max(1, Math.ceil(filteredSortedJobs.length / JOBS_PER_PAGE));
  const pagedJobs = filteredSortedJobs.slice((jobsPage - 1) * JOBS_PER_PAGE, jobsPage * JOBS_PER_PAGE);

  const highQualityCount = validationResults?.filter(r => r.laplacian_score >= r.blur_threshold).length ?? 0;
  const lowQualityCount = (validationResults?.length ?? 0) - highQualityCount;

  // ── Results pagination (derived after filteredResults)
  const totalResultsPages = Math.max(1, Math.ceil(filteredResults.length / RESULTS_PER_PAGE));
  const pagedResults = filteredResults.slice((resultsPage - 1) * RESULTS_PER_PAGE, resultsPage * RESULTS_PER_PAGE);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a]">
      {/* Site Picker Modal */}
      <SitePickerModal
        open={sitePickerOpen}
        sites={availableSites}
        sitesLoading={sitesLoading}
        onClose={() => setSitePickerOpen(false)}
        onConfirm={site => {
          setActiveSiteId(site.site_id);
          setSiteName(site.name);
          setSitePickerOpen(false);
        }}
        onCreateSite={async name => {
          const site = await createSite({ name });
          setAvailableSites(prev => [site, ...prev]);
          return site;
        }}
      />

      {/* Toast */}
      {toast && (
        <div className={cn(
          "fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm font-medium transition-all",
          toast.type === "error"
            ? "bg-red-600 text-white"
            : "bg-amber-500 text-black"
        )}>
          <AlertCircle className="w-4 h-4 shrink-0" />
          {toast.msg}
        </div>
      )}

      {/* ── Location picker modal ── */}
      {modalCtx !== null && (
        <LocationPickerModal
          title={
            modalCtx === "batch"  ? `Batch — apply to all ${eligibleCount} files without location` :
            modalCtx === "select" ? `Apply to ${selectedFilenames.size} selected file${selectedFilenames.size !== 1 ? "s" : ""}` :
            modalCtx
          }
          onConfirm={handleLocationConfirm}
          onClose={() => { setModalCtx(null); setSaveError(null); }}
        />
      )}

      {/* ── Saving overlay ── */}
      {saving && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="flex items-center gap-3 bg-white dark:bg-[#161616] rounded-2xl px-6 py-4 shadow-xl border border-gray-200 dark:border-gray-800">
            <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Saving location…</span>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50
                         border-b border-gray-200 dark:border-gray-800
                         bg-white/80 dark:bg-[#111]/80 backdrop-blur-md">
        <div className="container max-w-7xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2 select-none">
            <span className="text-sm font-bold font-mono tracking-tight
                             bg-gradient-to-r from-[#2ca75d] to-[#0da6f2]
                             bg-clip-text text-transparent">
              viscrete
            </span>
            <span className="hidden sm:inline text-xs text-gray-400 dark:text-gray-500 font-mono">
              / concrete inspection
            </span>
          </Link>
          <ModeToggle />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-16 pb-6">
        <div className="mb-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">New Inspection Job</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Complete each step below to start the inspection pipeline.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[2fr_3fr] gap-4 items-start">

          {/* ── LEFT COLUMN ── */}
          <div className="flex flex-col gap-4">

            {/* Step 1 — Job Details */}
            <div className="bg-white dark:bg-[#161616] rounded-2xl border border-gray-200 dark:border-gray-800 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] font-bold shrink-0">1</span>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Job Details</h3>
              </div>

              <div className="space-y-3">
                <div>
                  <label htmlFor="siteName" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Site Name <span className="text-red-500">*</span>
                  </label>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setSitePickerOpen(true)}
                    onKeyDown={e => { if (e.key === "Enter" || e.key === " ") setSitePickerOpen(true); }}
                    className={cn(
                      "flex items-center gap-2 w-full px-3 py-2 rounded-lg border text-sm cursor-pointer transition select-none",
                      "border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1a1a1a]",
                      "hover:border-blue-400 dark:hover:border-blue-600",
                      "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
                      siteName ? "text-gray-900 dark:text-white" : "text-gray-400"
                    )}
                  >
                    <Building2 className="w-4 h-4 shrink-0 text-gray-400" />
                    <span className="flex-1 truncate">{siteName || "Select or create a site…"}</span>
                    <ChevronRight className="w-3.5 h-3.5 shrink-0 text-gray-400" />
                  </div>
                  {activeSiteId && (
                    <div className="flex items-center gap-1.5 mt-1.5 text-xs text-blue-600 dark:text-blue-400">
                      <CheckCircle2 className="w-3 h-3 shrink-0" />
                      <span>Linked to site</span>
                      <Link href={`/sites/${activeSiteId}`} className="underline hover:no-underline ml-0.5">View</Link>
                      <button
                        type="button"
                        onClick={() => { setActiveSiteId(null); setSiteName(""); }}
                        className="ml-auto text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  <label htmlFor="inspectorName" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Inspector Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="inspectorName"
                    type="text"
                    placeholder="e.g. Juan dela Cruz"
                    value={inspectorName}
                    onChange={e => setInspectorName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  />
                </div>

                <div>
                  <label htmlFor="floor" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Floor / Level <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <input
                    id="floor"
                    type="text"
                    placeholder="e.g. 3, Ground, Rooftop"
                    value={floor}
                    onChange={e => setFloor(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  />
                </div>

              </div>
            </div>

            {/* Step 2 — Upload & Validate */}
            <div className="bg-white dark:bg-[#161616] rounded-2xl border border-gray-200 dark:border-gray-800 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] font-bold shrink-0">2</span>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Upload & Validate</h3>
              </div>

              {/* Drop Zone */}
              <div
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all",
                  isDragging
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
                    : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-gray-50 dark:bg-[#111]/60"
                )}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".jpg,.jpeg,.png,.bmp,.tiff"
                  onChange={e => addFiles(e.target.files)}
                  className="hidden"
                />
                <Upload className={cn("w-10 h-10 mx-auto mb-3", isDragging ? "text-blue-500" : "text-gray-400")} />
                <p className="font-semibold text-gray-700 dark:text-gray-200 mb-1">
                  Drop images here
                </p>
                <p className="text-sm text-gray-400 mb-2">or click to browse</p>
                <p className="text-xs text-gray-400">JPG, PNG, BMP, TIFF — max 20 MB each</p>
              </div>

              {/* File list */}
              {files.length > 0 && (
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Selected files
                    </span>
                    <span className="text-xs font-medium text-gray-400 dark:text-gray-500">
                      {files.length} {files.length === 1 ? "file" : "files"}
                    </span>
                  </div>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {files.map((f, i) => (
                      <div key={i} className="rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 overflow-hidden">
                        <div className="flex items-center gap-3 px-3 py-2 text-sm">
                          <FileImage className="w-4 h-4 text-blue-400 shrink-0" />
                          <span className="flex-1 truncate text-gray-700 dark:text-gray-300">{f.name}</span>
                          <span className="text-gray-400 text-xs shrink-0">{formatBytes(f.size)}</span>
                          <button
                            onClick={e => { e.stopPropagation(); removeFile(i); }}
                            className="text-gray-400 hover:text-red-500 transition shrink-0"
                            aria-label="Remove file"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Upload error */}
              {uploadError && (
                <div className="mt-4 flex items-start gap-2 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
                  <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  {uploadError}
                </div>
              )}

              {/* Upload + Proceed buttons */}
              <div className="mt-4 flex gap-3">
                <button
                  id="btn-upload"
                  onClick={handleUpload}
                  disabled={!canUpload}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition",
                    canUpload
                      ? "bg-blue-600 hover:bg-blue-700 text-white"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed"
                  )}
                >
                  {isUploading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Validating…</>
                  ) : (
                    <><Upload className="w-4 h-4" /> Upload & Validate</>
                  )}
                </button>

                {canProceed && (
                  <button
                    id="btn-proceed-preprocessing"
                    onClick={handleProceed}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition"
                  >
                    Proceed to Preprocessing
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Previous Jobs — utility section, no step number */}
            <div className="bg-white dark:bg-[#161616] rounded-xl border border-gray-200 dark:border-gray-800 p-4 shadow-sm order-last lg:order-none">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Previous Jobs</h3>
                <div className="flex items-center gap-3">
                  {selectedJobIds.size > 0 && (
                    <button
                      onClick={handleBatchDelete}
                      disabled={isBatchDeleting}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-600 hover:bg-red-700 text-white transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      {isBatchDeleting
                        ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Deleting…</>
                        : <><Trash2 className="w-3.5 h-3.5" /> Delete {selectedJobIds.size} selected</>}
                    </button>
                  )}
                  <button onClick={loadJobs} className="text-xs text-blue-500 hover:underline">Refresh</button>
                </div>
              </div>

              {/* Search + Sort controls */}
              {!jobsLoading && !jobsError && jobs.length > 0 && (
                <div className="flex items-center gap-2 mb-3">
                  <input
                    type="text"
                    placeholder="Search site or inspector…"
                    value={jobSearch}
                    onChange={e => setJobSearch(e.target.value)}
                    className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg text-xs border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  />
                  <select
                    value={jobSort}
                    onChange={e => setJobSort(e.target.value as typeof jobSort)}
                    className="shrink-0 px-2 py-1.5 rounded-lg text-xs border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a1a1a] text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition cursor-pointer"
                  >
                    <option value="date_desc">Newest first</option>
                    <option value="date_asc">Oldest first</option>
                    <option value="site_asc">Site A → Z</option>
                    <option value="site_desc">Site Z → A</option>
                    <option value="inspector_asc">Inspector A → Z</option>
                    <option value="inspector_desc">Inspector Z → A</option>
                  </select>
                </div>
              )}

              {jobsLoading ? (
                <div className="flex items-center gap-2 text-gray-400 text-sm py-4">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading…
                </div>
              ) : jobsError ? (
                <p className="text-sm text-red-500">{jobsError}</p>
              ) : jobs.length === 0 ? (
                <p className="text-sm text-gray-400">No previous jobs found.</p>
              ) : (
                <>
                  {/* Select-all row */}
                  <div className="flex items-center gap-2 mb-2 px-1">
                    <input
                      type="checkbox"
                      checked={selectedJobIds.size === filteredSortedJobs.length && filteredSortedJobs.length > 0}
                      ref={el => { if (el) el.indeterminate = selectedJobIds.size > 0 && selectedJobIds.size < filteredSortedJobs.length; }}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded accent-blue-600 cursor-pointer"
                      aria-label="Select all jobs"
                    />
                    <span className="text-xs text-gray-400">
                      {selectedJobIds.size > 0
                        ? `${selectedJobIds.size} of ${filteredSortedJobs.length} selected`
                        : filteredSortedJobs.length < jobs.length
                          ? `${filteredSortedJobs.length} of ${jobs.length} jobs`
                          : `Select all (${jobs.length})`}
                    </span>
                  </div>
                  {filteredSortedJobs.length === 0 && (
                    <p className="text-xs text-gray-400 py-2 text-center">No jobs match your search.</p>
                  )}

                  <div className="space-y-2 overflow-y-auto max-h-52 pr-0.5">
                    {pagedJobs.map(job => {
                      const isSelected = selectedJobIds.has(job.job_id);
                      return (
                        <div
                          key={job.job_id}
                          onClick={() => router.push(routeForJob(job))}
                          className={cn(
                            "w-full flex items-center gap-3 px-3 py-3 rounded-xl border transition group cursor-pointer",
                            isSelected
                              ? "border-blue-400 dark:border-blue-600 bg-blue-50/60 dark:bg-blue-950/30"
                              : "border-gray-100 dark:border-gray-800 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-blue-50/50 dark:hover:bg-blue-950/20"
                          )}
                        >
                          {/* Checkbox */}
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            onClick={e => toggleSelectJob(e, job.job_id)}
                            className="w-4 h-4 rounded accent-blue-600 cursor-pointer shrink-0"
                            aria-label={`Select job ${job.job_id}`}
                          />

                          {/* Job info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                {job.site_name ?? job.site_location ?? `Job ${job.job_id.slice(0, 8)}`}
                              </span>
                              <span className={cn(
                                "px-2 py-0.5 rounded text-[11px] font-semibold shrink-0",
                                STATUS_COLORS[job.status] ?? "bg-gray-100 text-gray-600"
                              )}>
                                {job.status}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-gray-400">
                              <span className="flex items-center gap-1">
                                <FileImage className="w-3 h-3" />
                                {job.input_type}
                              </span>
                              {job.floor && (
                                <span className="flex items-center gap-1">
                                  <Layers className="w-3 h-3" />
                                  {job.floor}
                                </span>
                              )}
                              {job.file_count != null && (
                                <span>{job.file_count} file{job.file_count !== 1 ? "s" : ""}</span>
                              )}
                              {job.inspector_name && (
                                <span className="flex items-center gap-1">
                                  <User className="w-3 h-3" />
                                  {toInitials(job.inspector_name)}
                                </span>
                              )}
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatDate(job.created_at)}
                              </span>
                            </div>
                          </div>

                          <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-blue-500 transition shrink-0" />

                          {/* Individual delete */}
                          <button
                            onClick={e => handleDeleteJob(e, job.job_id)}
                            disabled={deletingJobId === job.job_id || isBatchDeleting}
                            className="ml-1 p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition shrink-0 disabled:opacity-40 cursor-pointer"
                            aria-label="Delete job"
                          >
                            {deletingJobId === job.job_id
                              ? <Loader2 className="w-4 h-4 animate-spin" />
                              : <Trash2 className="w-4 h-4" />}
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                      <button
                        onClick={() => setJobsPage(p => Math.max(1, p - 1))}
                        disabled={jobsPage === 1}
                        className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition"
                      >
                        <ChevronLeft className="w-4 h-4" /> Previous
                      </button>
                      <span className="text-xs text-gray-400">Page {jobsPage} of {totalPages}</span>
                      <button
                        onClick={() => setJobsPage(p => Math.min(totalPages, p + 1))}
                        disabled={jobsPage === totalPages}
                        className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition"
                      >
                        Next <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>

          </div>{/* end left column */}

          {/* ── RIGHT COLUMN — Step 3 ── */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] font-bold shrink-0">3</span>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Review & Proceed</h3>
            </div>

            {!validationResults && !isUploading ? (
              <div className="flex flex-col items-center justify-center text-center py-16 text-gray-400 bg-white dark:bg-[#161616] rounded-xl border border-dashed border-gray-200 dark:border-gray-800">
                <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3">
                  <CheckCircle2 className="w-6 h-6 text-gray-300" />
                </div>
                <p className="font-medium text-sm text-gray-500 dark:text-gray-400">Results appear here after validation</p>
                <p className="text-xs mt-1 text-gray-400">Complete steps 1 &amp; 2, then click Upload &amp; Validate</p>
              </div>
            ) : isUploading ? (
              <div className="flex flex-col items-center justify-center text-center py-16 gap-3 bg-white dark:bg-[#161616] rounded-xl border border-gray-200 dark:border-gray-800">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Validating files…</p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Filters + Summary */}
                <div className="bg-white dark:bg-[#161616] rounded-xl border border-gray-200 dark:border-gray-800 p-3 shadow-sm space-y-2">
                  {/* Row 1: GPS + Blur filters + view toggle */}
                  <div className="flex items-start gap-2">
                    {/* Filters group — wraps internally on narrow viewports */}
                    <div className="flex-1 min-w-0 flex items-center flex-wrap gap-2">
                      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider shrink-0">GPS</span>
                      {(["all", "with", "without"] as const).map(opt => (
                        <button
                          key={opt}
                          onClick={() => setGpsFilter(opt)}
                          className={cn(
                            "px-2.5 py-1 rounded-full text-xs font-medium transition shrink-0",
                            gpsFilter === opt
                              ? "bg-blue-600 text-white"
                              : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                          )}
                        >
                          {opt === "all" ? "All" : opt === "with" ? "With GPS" : "Without GPS"}
                        </button>
                      ))}
                      <span className="w-px h-4 bg-gray-200 dark:bg-gray-700 shrink-0 self-center" />
                      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider shrink-0">Blur</span>
                      {(["all", "sharp", "blurry"] as const).map(opt => (
                        <button
                          key={opt}
                          onClick={() => setBlurFilter(opt)}
                          className={cn(
                            "px-2.5 py-1 rounded-full text-xs font-medium transition shrink-0",
                            blurFilter === opt
                              ? "bg-blue-600 text-white"
                              : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                          )}
                        >
                          {opt === "all" ? "All" : opt === "sharp" ? "High Quality" : "Low Quality"}
                        </button>
                      ))}
                    </div>
                    {/* View toggle — always anchored to the right */}
                    <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-gray-100 dark:bg-gray-800 shrink-0">
                      <button
                        onClick={() => setViewMode("list")}
                        title="List view"
                        className={cn(
                          "p-1.5 rounded-md transition cursor-pointer",
                          viewMode === "list"
                            ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                            : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                        )}
                      >
                        <LayoutList className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setViewMode("carousel")}
                        title="Carousel view"
                        className={cn(
                          "p-1.5 rounded-md transition cursor-pointer",
                          viewMode === "carousel"
                            ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                            : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                        )}
                      >
                        <GalleryHorizontal className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Row 2: Summary */}
                  <div className="text-sm text-gray-600 dark:text-gray-300 flex flex-wrap gap-3">
                    <span className="font-medium">{validationResults!.length} files uploaded</span>
                    <span className="text-gray-300 dark:text-gray-600">•</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">{highQualityCount} High Quality</span>
                    <span className="text-gray-300 dark:text-gray-600">•</span>
                    <span className="text-amber-500 dark:text-amber-400 font-medium">{lowQualityCount} Low Quality</span>
                  </div>
                </div>

                {/* Location toolbar — only when files have no GPS */}
                {eligibleCount > 0 && (
                  <div className="flex flex-wrap items-center gap-2 px-3 py-2 bg-white dark:bg-[#161616] rounded-xl border border-gray-200 dark:border-gray-800">
                    {/* Select-all toggle */}
                    <button
                      onClick={selectedFilenames.size === eligibleCount ? clearSelection : selectAllEligible}
                      className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition cursor-pointer"
                    >
                      {selectedFilenames.size === eligibleCount
                        ? <CheckSquare className="w-4 h-4 text-blue-500" />
                        : <Square className="w-4 h-4" />}
                      {selectedFilenames.size === eligibleCount ? "Deselect all" : "Select all no-GPS"}
                    </button>

                    {selectedFilenames.size > 0 && (
                      <>
                        <span className="text-gray-300 dark:text-gray-700">|</span>
                        <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">{selectedFilenames.size} selected</span>
                        <button
                          onClick={() => { setModalCtx("select"); setSaveError(null); setSaveSuccess(null); }}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition cursor-pointer"
                        >
                          <Map className="w-3.5 h-3.5" /> Set Location for Selected
                        </button>
                        <button
                          onClick={clearSelection}
                          className="text-xs text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition cursor-pointer ml-auto"
                        >Clear</button>
                      </>
                    )}

                    <div className="ml-auto flex items-center gap-2">
                      {saveSuccess === "batch" && (
                        <span className="text-xs text-emerald-600 dark:text-emerald-400">Applied.</span>
                      )}
                      <button
                        onClick={() => { setModalCtx("batch"); setSaveError(null); setSaveSuccess(null); }}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-gray-900 hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 text-white transition cursor-pointer"
                      >
                        <Layers className="w-3.5 h-3.5" /> Set Location for All ({eligibleCount})
                      </button>
                    </div>
                  </div>
                )}

                {/* Save error */}
                {saveError && (
                  <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-300">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {saveError}
                    <button onClick={() => setSaveError(null)} className="ml-auto text-xs text-red-400 hover:text-red-600 cursor-pointer">Dismiss</button>
                  </div>
                )}

                {/* File cards — list or carousel */}
                {filteredResults.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">No files match the current filters.</p>
                ) : viewMode === "carousel" ? (() => {
                  const r = filteredResults[Math.min(carouselIndex, filteredResults.length - 1)];
                  const hasCoords = r.gps_data?.latitude != null || r.gps != null;
                  const isNoGps = !hasCoords && !r.location_label;
                  const displayCoords: { lat: number; lng: number } | null =
                    r.gps_data?.latitude != null
                      ? { lat: r.gps_data.latitude!, lng: r.gps_data.longitude! }
                      : r.gps ? { lat: r.gps.lat, lng: r.gps.lng }
                      : null;
                  return (
                    <CarouselResultView
                      result={r}
                      index={Math.min(carouselIndex, filteredResults.length - 1)}
                      total={filteredResults.length}
                      isNoGps={isNoGps}
                      isSelected={selectedFilenames.has(r.filename)}
                      displayCoords={displayCoords}
                      locationLabel={r.location_label ?? null}
                      replaceAccept={replaceAccept}
                      overrideLoading={fileActionLoading[r.file_id ?? ''] === 'override'}
                      replaceLoading={fileActionLoading[r.file_id ?? ''] === 'replace'}
                      onPrev={() => setCarouselIndex(i => Math.max(0, i - 1))}
                      onNext={() => setCarouselIndex(i => Math.min(filteredResults.length - 1, i + 1))}
                      onToggleSelect={isNoGps ? () => toggleSelectFilename(r.filename) : undefined}
                      onSetLocation={isNoGps ? () => { setModalCtx(r.filename); setSaveError(null); setSaveSuccess(null); } : undefined}
                      onOverride={r.file_id && !r.is_valid ? () => handleOverride(r.file_id!) : undefined}
                      onReplace={r.file_id && !r.is_valid ? (file) => handleReplace(r.file_id!, file) : undefined}
                    />
                  );
                })() : (
                  <>
                    <div className="space-y-1.5 max-h-[560px] overflow-y-auto pr-1">
                      {pagedResults.map((r, i) => {
                        const hasCoords = r.gps_data?.latitude != null || r.gps != null;
                        const isNoGps = !hasCoords && !r.location_label;
                        const isSelected = selectedFilenames.has(r.filename);
                        const displayCoords: { lat: number; lng: number } | null =
                          r.gps_data?.latitude != null
                            ? { lat: r.gps_data.latitude!, lng: r.gps_data.longitude! }
                            : r.gps ? { lat: r.gps.lat, lng: r.gps.lng }
                            : null;
                        const locationLabel: string | null = r.location_label ?? null;
                        return (
                          <FileResultCard
                            key={(resultsPage - 1) * RESULTS_PER_PAGE + i}
                            result={r}
                            isNoGps={isNoGps}
                            isSelected={isSelected}
                            displayCoords={displayCoords}
                            locationLabel={locationLabel}
                            replaceAccept={replaceAccept}
                            overrideLoading={fileActionLoading[r.file_id ?? ''] === 'override'}
                            replaceLoading={fileActionLoading[r.file_id ?? ''] === 'replace'}
                            onPreview={() => setPreviewFilename(r.filename)}
                            onToggleSelect={isNoGps ? () => toggleSelectFilename(r.filename) : undefined}
                            onSetLocation={isNoGps ? () => { setModalCtx(r.filename); setSaveError(null); setSaveSuccess(null); } : undefined}
                            onOverride={r.file_id && !r.is_valid ? () => handleOverride(r.file_id!) : undefined}
                            onReplace={r.file_id && !r.is_valid ? (file) => handleReplace(r.file_id!, file) : undefined}
                          />
                        );
                      })}
                    </div>
                    {totalResultsPages > 1 && (
                      <div className="flex items-center justify-between pt-2">
                        <button
                          onClick={() => setResultsPage(p => Math.max(1, p - 1))}
                          disabled={resultsPage === 1}
                          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition"
                        >
                          <ChevronLeft className="w-4 h-4" /> Previous
                        </button>
                        <span className="text-xs text-gray-400">
                          Page {resultsPage} of {totalResultsPages}
                          <span className="ml-1 text-gray-300 dark:text-gray-600">({filteredResults.length} files)</span>
                        </span>
                        <button
                          onClick={() => setResultsPage(p => Math.min(totalResultsPages, p + 1))}
                          disabled={resultsPage === totalResultsPages}
                          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition"
                        >
                          Next <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>{/* end right column */}
        </div>{/* end grid */}
      </main>

      {/* ── Image Preview Modal ── */}
      {previewResult && (
        <ImagePreviewModal result={previewResult} onClose={() => setPreviewFilename(null)} />
      )}
    </div>
  );
}

export default function UploadPage() {
  return (
    <Suspense>
      <UploadPageInner />
    </Suspense>
  );
}

// ─── Image Preview Modal ──────────────────────────────────────────────────────

function ImagePreviewModal({ result, onClose }: { result: ValidationResult; onClose: () => void }) {
  const isLowQuality = result.laplacian_score < result.blur_threshold;
  const imageUrl = useFileUrl(result.file_id ?? null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white dark:bg-[#161616] rounded-2xl border border-gray-200 dark:border-gray-800 shadow-2xl w-full max-w-lg overflow-hidden">

        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <span className="flex-1 text-sm font-semibold text-gray-800 dark:text-gray-100 truncate min-w-0">
            {result.filename}
          </span>
          <button
            onClick={onClose}
            className="shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Image */}
        <div className="bg-gray-100 dark:bg-gray-900 flex items-center justify-center" style={{ minHeight: 200, maxHeight: 320, overflow: "hidden" }}>
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt={result.filename} className="max-w-full object-contain" style={{ maxHeight: 320 }} />
          ) : (
            <div className="flex flex-col items-center gap-2 py-14 text-gray-400">
              <FileImage className="w-10 h-10" />
              <span className="text-xs">No preview available</span>
            </div>
          )}
        </div>

        {/* Metadata tiles */}
        <div className="grid grid-cols-3 gap-3 px-4 py-4">
          {/* Laplacian */}
          <div className="bg-gray-50 dark:bg-gray-900 rounded-xl px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1">Laplacian</p>
            <p className="font-mono font-semibold text-sm text-gray-800 dark:text-gray-100">{result.laplacian_score.toFixed(2)}</p>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">thresh: {result.blur_threshold.toFixed(2)}</p>
          </div>

          {/* Quality */}
          <div className="bg-gray-50 dark:bg-gray-900 rounded-xl px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1">Quality</p>
            <p className={cn("font-semibold text-sm flex items-center gap-1", isLowQuality ? "text-amber-500 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400")}>
              {isLowQuality && <AlertTriangle className="w-3.5 h-3.5 shrink-0" />}
              {isLowQuality ? "Low" : "High"}
            </p>
          </div>

          {/* GPS */}
          <div className="bg-gray-50 dark:bg-gray-900 rounded-xl px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1">GPS</p>
            {result.gps_data?.latitude != null ? (
              <p className="font-mono text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                {result.gps_data.latitude.toFixed(5)}<br />{result.gps_data.longitude!.toFixed(5)}
                {result.gps_data.altitude != null && <><br />{result.gps_data.altitude.toFixed(1)} m</>}
              </p>
            ) : result.gps ? (
              <p className="font-mono text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                {result.gps.lat.toFixed(5)}<br />{result.gps.lng.toFixed(5)}
              </p>
            ) : result.location_label ? (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 leading-relaxed">{result.location_label}</p>
            ) : (
              <p className="text-xs text-gray-400 dark:text-gray-500">No data</p>
            )}
          </div>
        </div>

        {/* Invalid reason */}
        {!result.is_valid && result.reason && (
          <div className="mx-4 mb-4 flex items-start gap-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 px-3 py-2 rounded-lg">
            <XCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            {result.reason}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── File Result Card ─────────────────────────────────────────────────────────

function FileResultCard({
  result,
  isNoGps = false,
  isSelected = false,
  displayCoords = null,
  locationLabel = null,
  replaceAccept = ".jpg,.jpeg,.png,.bmp,.tiff",
  overrideLoading = false,
  replaceLoading = false,
  onPreview,
  onToggleSelect,
  onSetLocation,
  onOverride,
  onReplace,
}: {
  result: ValidationResult;
  isNoGps?: boolean;
  isSelected?: boolean;
  displayCoords?: { lat: number; lng: number } | null;
  locationLabel?: string | null;
  replaceAccept?: string;
  overrideLoading?: boolean;
  replaceLoading?: boolean;
  onPreview: () => void;
  onToggleSelect?: () => void;
  onSetLocation?: () => void;
  onOverride?: () => void;
  onReplace?: (file: File) => void;
}) {
  const isLowQuality = result.laplacian_score < result.blur_threshold;
  const isActing = overrideLoading || replaceLoading;
  return (
    <div
      onClick={onToggleSelect ?? onPreview}
      className={cn(
        "bg-white dark:bg-[#161616] rounded-xl border px-3 py-2 transition cursor-pointer",
        isSelected
          ? "border-blue-400 dark:border-blue-600 bg-blue-50/60 dark:bg-blue-950/30"
          : result.is_valid
            ? "border-emerald-200 dark:border-emerald-900/60 hover:border-emerald-400 dark:hover:border-emerald-700"
            : "border-red-200 dark:border-red-900/60 hover:border-red-400 dark:hover:border-red-700"
      )}
    >
      {/* Single compact row */}
      <div className="flex items-center gap-2 min-w-0">
        {/* Checkbox for no-GPS files, otherwise valid/invalid icon */}
        {isNoGps ? (
          <div onClick={e => { e.stopPropagation(); onToggleSelect?.(); }} className="shrink-0 cursor-pointer">
            {isSelected
              ? <CheckSquare className="w-3.5 h-3.5 text-blue-500" />
              : <Square className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600" />}
          </div>
        ) : (
          result.blur_override
            ? <ShieldCheck className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            : result.is_valid
              ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              : <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
        )}

        <span
          className="flex-1 min-w-0 truncate text-xs font-medium text-gray-800 dark:text-gray-100"
          onClick={e => { e.stopPropagation(); onPreview(); }}
        >
          {result.filename}
        </span>

        <span className="shrink-0 font-mono text-[11px] text-gray-400 dark:text-gray-500">
          {result.laplacian_score.toFixed(1)}
          <span className="text-gray-300 dark:text-gray-700">/{result.blur_threshold.toFixed(1)}</span>
        </span>

        {result.blur_override ? (
          <span className="shrink-0 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
            <ShieldCheck className="w-2.5 h-2.5" /> Overridden
          </span>
        ) : (
          <span className={cn(
            "shrink-0 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold",
            isLowQuality
              ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
              : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
          )}>
            {isLowQuality && <AlertTriangle className="w-2.5 h-2.5" />}
            {isLowQuality ? "Low" : "High"}
          </span>
        )}

        {isNoGps ? (
          <>
            <span className="shrink-0 flex items-center gap-0.5 text-[11px] text-gray-300 dark:text-gray-700">
              <MapPinOff className="w-2.5 h-2.5 text-orange-400" /> No GPS
            </span>
            {onSetLocation && (
              <button
                onClick={e => { e.stopPropagation(); onSetLocation(); }}
                className="shrink-0 p-1 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:text-blue-400 dark:hover:bg-blue-950/30 transition cursor-pointer"
                title="Set location"
              >
                <Map className="w-3.5 h-3.5" />
              </button>
            )}
          </>
        ) : (
          <span className="shrink-0 flex items-center gap-0.5 text-[11px] text-gray-400 dark:text-gray-500">
            {displayCoords
              ? <><MapPin className="w-2.5 h-2.5 text-blue-400" />{displayCoords.lat.toFixed(3)}, {displayCoords.lng.toFixed(3)}</>
              : locationLabel
                ? <><MapPin className="w-2.5 h-2.5 text-emerald-400" /><span className="truncate max-w-[80px]">{locationLabel}</span></>
                : <span className="text-gray-300 dark:text-gray-700">No GPS</span>}
          </span>
        )}
      </div>

      {/* Error reason — indented below filename */}
      {!result.is_valid && result.reason && (
        <p className="mt-0.5 pl-5 text-[10px] text-red-500 dark:text-red-400 truncate">
          {result.reason}
        </p>
      )}

      {/* Action buttons for invalid files */}
      {!result.is_valid && (onOverride || onReplace) && (
        <div className="mt-1.5 pl-5 flex items-center gap-2" onClick={e => e.stopPropagation()}>
          {onOverride && (
            <button
              onClick={() => onOverride()}
              disabled={isActing}
              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/50 disabled:opacity-50 transition cursor-pointer"
            >
              {overrideLoading
                ? <Loader2 className="w-2.5 h-2.5 animate-spin" />
                : <ShieldCheck className="w-2.5 h-2.5" />}
              Proceed Anyway
            </button>
          )}
          {onReplace && (
            <label
              onClick={e => e.stopPropagation()}
              className={cn(
                "flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold transition",
                isActing
                  ? "bg-blue-50 text-blue-400 dark:bg-blue-950/20 dark:text-blue-600 opacity-50 cursor-not-allowed"
                  : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50 cursor-pointer"
              )}
            >
              <input
                type="file"
                accept={replaceAccept}
                className="hidden"
                disabled={isActing}
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) onReplace(f);
                  e.target.value = "";
                }}
              />
              {replaceLoading
                ? <Loader2 className="w-2.5 h-2.5 animate-spin" />
                : <RefreshCw className="w-2.5 h-2.5" />}
              Replace
            </label>
          )}
        </div>
      )}
    </div>
  );
}

// ─── CarouselResultView ───────────────────────────────────────────────────────

function CarouselResultView({
  result,
  index,
  total,
  isNoGps,
  isSelected,
  displayCoords,
  locationLabel,
  replaceAccept = ".jpg,.jpeg,.png,.bmp,.tiff",
  overrideLoading = false,
  replaceLoading = false,
  onPrev,
  onNext,
  onToggleSelect,
  onSetLocation,
  onOverride,
  onReplace,
}: {
  result: ValidationResult;
  index: number;
  total: number;
  isNoGps: boolean;
  isSelected: boolean;
  displayCoords: { lat: number; lng: number } | null;
  locationLabel: string | null;
  replaceAccept?: string;
  overrideLoading?: boolean;
  replaceLoading?: boolean;
  onPrev: () => void;
  onNext: () => void;
  onToggleSelect?: () => void;
  onSetLocation?: () => void;
  onOverride?: () => void;
  onReplace?: (file: File) => void;
}) {
  const [imgLoading, setImgLoading] = useState(true);
  const imageUrl = useFileUrl(result.file_id ?? null);

  useEffect(() => { setImgLoading(true); }, [imageUrl]);

  const isLowQuality = result.laplacian_score < result.blur_threshold;
  const sharpnessPct = Math.min(100, (result.laplacian_score / Math.max(result.blur_threshold, 1)) * 100);

  return (
    <div className="flex flex-col gap-3">
      {/* Image */}
      <div className="aspect-video bg-gray-900 rounded-xl overflow-hidden relative">
        {imageUrl ? (
          <>
            {imgLoading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-gray-600" />
              </div>
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={imageUrl}
              src={imageUrl}
              alt={result.filename}
              className={cn("w-full h-full object-contain transition-opacity duration-200", imgLoading ? "opacity-0" : "opacity-100")}
              onLoad={() => setImgLoading(false)}
              onError={() => setImgLoading(false)}
            />
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-gray-600">
            <FileImage className="w-12 h-12" />
            <span className="text-xs">No preview available</span>
          </div>
        )}
      </div>

      {/* Info card */}
      <div className={cn(
        "bg-white dark:bg-[#161616] rounded-xl border p-4 space-y-3",
        result.is_valid
          ? "border-emerald-200 dark:border-emerald-900/60"
          : "border-red-200 dark:border-red-900/60"
      )}>
        {/* Top row: status + quality badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn(
            "flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold",
            result.blur_override
              ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
              : result.is_valid
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
          )}>
            {result.blur_override
              ? <ShieldCheck className="w-3 h-3" />
              : result.is_valid
                ? <CheckCircle2 className="w-3 h-3" />
                : <XCircle className="w-3 h-3" />}
            {result.blur_override ? "Override accepted" : result.is_valid ? "Valid" : "Invalid"}
          </span>
          <span className={cn(
            "flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold",
            isLowQuality
              ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
              : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
          )}>
            {isLowQuality && <AlertTriangle className="w-3 h-3" />}
            {isLowQuality ? "Low Quality" : "High Quality"}
          </span>
          {isNoGps && onToggleSelect && (
            <button
              onClick={onToggleSelect}
              className="ml-auto flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white transition cursor-pointer"
            >
              {isSelected
                ? <CheckSquare className="w-3.5 h-3.5 text-blue-500" />
                : <Square className="w-3.5 h-3.5" />}
              Select
            </button>
          )}
        </div>

        {/* Filename */}
        <p className="text-sm font-semibold text-gray-900 dark:text-white truncate" title={result.filename}>
          {result.filename}
        </p>

        {/* Sharpness bar */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Sharpness</span>
            <span className="text-xs font-mono text-gray-600 dark:text-gray-300">
              {result.laplacian_score.toFixed(1)}
              <span className="text-gray-400 dark:text-gray-600"> / {result.blur_threshold.toFixed(1)}</span>
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all", isLowQuality ? "bg-amber-400" : "bg-emerald-500")}
              style={{ width: `${sharpnessPct}%` }}
            />
          </div>
        </div>

        {/* GPS / location */}
        <div className="flex items-center gap-2">
          {isNoGps ? (
            <>
              <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
                <MapPinOff className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                No GPS data
              </span>
              {onSetLocation && (
                <button
                  onClick={onSetLocation}
                  className="ml-auto flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition cursor-pointer"
                >
                  <Map className="w-3 h-3" /> Set Location
                </button>
              )}
            </>
          ) : displayCoords ? (
            <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
              <MapPin className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              {displayCoords.lat.toFixed(5)}, {displayCoords.lng.toFixed(5)}
            </span>
          ) : locationLabel ? (
            <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
              <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              {locationLabel}
            </span>
          ) : null}
        </div>

        {/* Reason if invalid */}
        {!result.is_valid && result.reason && (
          <p className="text-xs text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-950/30 rounded-lg px-3 py-2">
            {result.reason}
          </p>
        )}

        {/* Action buttons for invalid files */}
        {!result.is_valid && (onOverride || onReplace) && (
          <div className="flex items-center gap-3">
            {onOverride && (
              <button
                onClick={onOverride}
                disabled={overrideLoading || replaceLoading}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/50 disabled:opacity-50 transition cursor-pointer"
              >
                {overrideLoading
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <ShieldCheck className="w-3.5 h-3.5" />}
                Proceed Anyway
              </button>
            )}
            {onReplace && (
              <label className={cn(
                "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition",
                overrideLoading || replaceLoading
                  ? "bg-blue-50 text-blue-400 dark:bg-blue-950/20 dark:text-blue-600 opacity-50 cursor-not-allowed"
                  : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50 cursor-pointer"
              )}>
                <input
                  type="file"
                  accept={replaceAccept}
                  className="hidden"
                  disabled={overrideLoading || replaceLoading}
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) onReplace(f);
                    e.target.value = "";
                  }}
                />
                {replaceLoading
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <RefreshCw className="w-3.5 h-3.5" />}
                Replace File
              </label>
            )}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={onPrev}
          disabled={index === 0}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#161616] text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          <ChevronLeft className="w-4 h-4" /> Previous
        </button>
        <span className="text-xs font-mono text-gray-500 dark:text-gray-400">
          {index + 1} <span className="text-gray-300 dark:text-gray-700">/</span> {total}
        </span>
        <button
          onClick={onNext}
          disabled={index === total - 1}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#161616] text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          Next <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}