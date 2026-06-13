"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import AppNav from "@/components/AppNav";
import { cn } from "@/lib/utils";
import ImagePreviewModal from "@/components/upload/ImagePreviewModal";
import FileResultCard from "@/components/upload/FileResultCard";
import CarouselResultView from "@/components/upload/CarouselResultView";
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

  // Load available sites on mount
  useEffect(() => {
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
    <div className="min-h-screen bg-gray-50 dark:bg-[#14171e]">
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
          siteAddress={availableSites.find(s => s.site_id === activeSiteId)?.address || undefined}
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

      <AppNav />

      <main className="max-w-7xl mx-auto px-3 sm:px-6 pt-16 pb-6">
        <div className="mb-4">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">New Inspection Job</h2>
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
                    <><Upload className="w-4 h-4" /> <span className="hidden sm:inline">Upload &amp; </span>Validate</>
                  )}
                </button>

                {canProceed && (
                  <button
                    id="btn-proceed-preprocessing"
                    onClick={handleProceed}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition"
                  >
                    Proceed
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
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
