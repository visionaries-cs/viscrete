"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  createJob,
  validateFiles,
  listJobs,
  deleteJob,
  updateLocation,
  API_BASE_URL,
  type JobStatusResponse,
  type ValidationResult,
  type LocationUpdateRequest,
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
  FileVideo,
  Clock,
  AlertCircle,
  AlertTriangle,
  X,
  Map,
  Layers,
  CheckSquare,
  Square,
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

// ─── Component ───────────────────────────────────────────────────────────────

export default function UploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Form state
  const [siteName, setSiteName] = useState("");
  const [inspectorName, setInspectorName] = useState("");
  const [mediaType, setMediaType] = useState<"image" | "video">("image");

  // ── File state
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  // ── Upload / validation state
  const [isUploading, setIsUploading] = useState(false);
  const [validationResults, setValidationResults] = useState<ValidationResult[] | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [canProceed, setCanProceed] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);

  // ── Validation filters
  const [gpsFilter, setGpsFilter] = useState<"all" | "with" | "without">("all");
  const [blurFilter, setBlurFilter] = useState<"all" | "sharp" | "blurry">("all");
  const [resultsPage, setResultsPage] = useState(1);

  // ── Previous jobs
  const [jobs, setJobs] = useState<JobStatusResponse[]>([]);
  const [jobsPage, setJobsPage] = useState(1);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [jobsError, setJobsError] = useState<string | null>(null);
  const [deletingJobId, setDeletingJobId] = useState<string | null>(null);
  const [selectedJobIds, setSelectedJobIds] = useState<Set<string>>(new Set());
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);

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

  // Reset files when media type changes
  useEffect(() => {
    setFiles([]);
    setValidationResults(null);
    setCanProceed(false);
    setUploadError(null);
  }, [mediaType]);

  // Reset results page when filters or results change
  useEffect(() => { setResultsPage(1); }, [gpsFilter, blurFilter, validationResults]);

  // Load previous jobs on mount
  useEffect(() => {
    loadJobs();
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
    if (selectedJobIds.size === jobs.length) {
      setSelectedJobIds(new Set());
    } else {
      setSelectedJobIds(new Set(jobs.map(j => j.job_id)));
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
  const VIDEO_TYPES = ["video/mp4", "video/avi", "video/quicktime", "video/x-msvideo"];
  const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
  const MAX_VIDEO_BYTES = 500 * 1024 * 1024;

  function addFiles(fileList: FileList | null) {
    if (!fileList) return;
    const allowed = mediaType === "image" ? IMAGE_TYPES : VIDEO_TYPES;
    const maxSize = mediaType === "image" ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;

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
    setCanProceed(false);
  }

  function removeFile(idx: number) {
    setFiles(prev => prev.filter((_, i) => i !== idx));
    setValidationResults(null);
    setCanProceed(false);
  }

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
      const job = await createJob(mediaType, siteName.trim(), inspectorName.trim());
      setJobId(job.job_id);
      const results = await validateFiles(job.job_id, files);
      setValidationResults(results);
      const hasValid = results.some(r => r.is_valid);
      setCanProceed(hasValid);
      if (!hasValid) setUploadError("All files failed validation. Please upload different files.");
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

  // ── Pagination
  const totalPages = Math.max(1, Math.ceil(jobs.length / JOBS_PER_PAGE));
  const pagedJobs = jobs.slice((jobsPage - 1) * JOBS_PER_PAGE, jobsPage * JOBS_PER_PAGE);

  const highQualityCount = validationResults?.filter(r => r.laplacian_score >= r.blur_threshold).length ?? 0;
  const lowQualityCount = (validationResults?.length ?? 0) - highQualityCount;

  // ── Results pagination (derived after filteredResults)
  const totalResultsPages = Math.max(1, Math.ceil(filteredResults.length / RESULTS_PER_PAGE));
  const pagedResults = filteredResults.slice((resultsPage - 1) * RESULTS_PER_PAGE, resultsPage * RESULTS_PER_PAGE);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a]">
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
      <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-[#111]">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-3">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              <FileImage className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-gray-900 dark:text-white tracking-wide group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">VISCRETE</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">Concrete Defect Detection System</p>
            </div>
          </Link>
          <div className="ml-auto">
            <ModeToggle />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">New Inspection Job</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Fill in job details, upload files, and validate before preprocessing.</p>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* ── LEFT COLUMN ─────────────────────────────────────────── */}
          <div className="space-y-6">

            {/* Job Details Card */}
            <div className="bg-white dark:bg-[#161616] rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">Job Details</h3>

              <div className="space-y-4">
                <div>
                  <label htmlFor="siteName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Site Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="siteName"
                    type="text"
                    placeholder="e.g. Magsaysay Bridge"
                    value={siteName}
                    onChange={e => setSiteName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  />
                </div>

                <div>
                  <label htmlFor="inspectorName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
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
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Media Type <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-3">
                    {(["image", "video"] as const).map(t => (
                      <label key={t} className={cn(
                        "flex-1 flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 cursor-pointer text-sm font-medium transition",
                        mediaType === t
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                          : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600"
                      )}>
                        <input
                          type="radio"
                          name="mediaType"
                          value={t}
                          checked={mediaType === t}
                          onChange={() => setMediaType(t)}
                          className="sr-only"
                        />
                        {t === "image" ? <FileImage className="w-4 h-4" /> : <FileVideo className="w-4 h-4" />}
                        {t === "image" ? "Images" : "Videos"}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Upload Area Card */}
            <div className="bg-white dark:bg-[#161616] rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">Upload Files</h3>

              {/* Drop Zone */}
              <div
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all",
                  isDragging
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
                    : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-gray-50 dark:bg-gray-900/50"
                )}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept={mediaType === "image" ? ".jpg,.jpeg,.png,.bmp,.tiff" : ".mp4,.avi,.mov"}
                  onChange={e => addFiles(e.target.files)}
                  className="hidden"
                />
                <Upload className={cn("w-10 h-10 mx-auto mb-3", isDragging ? "text-blue-500" : "text-gray-400")} />
                <p className="font-semibold text-gray-700 dark:text-gray-200 mb-1">
                  Drop {mediaType === "image" ? "images" : "videos"} here
                </p>
                <p className="text-sm text-gray-400 mb-2">or click to browse</p>
                <p className="text-xs text-gray-400">
                  {mediaType === "image"
                    ? "JPG, PNG, BMP, TIFF — max 20 MB each"
                    : "MP4, AVI, MOV — max 500 MB each"}
                </p>
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
                      <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-sm">
                        {mediaType === "image" ? <FileImage className="w-4 h-4 text-blue-400 shrink-0" /> : <FileVideo className="w-4 h-4 text-purple-400 shrink-0" />}
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
              <div className="mt-5 flex gap-3">
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

            {/* ── Previous Jobs ──────────────────────────────────────── */}
            <div className="bg-white dark:bg-[#161616] rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
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
                      checked={selectedJobIds.size === jobs.length && jobs.length > 0}
                      ref={el => { if (el) el.indeterminate = selectedJobIds.size > 0 && selectedJobIds.size < jobs.length; }}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded accent-blue-600 cursor-pointer"
                      aria-label="Select all jobs"
                    />
                    <span className="text-xs text-gray-400">
                      {selectedJobIds.size > 0 ? `${selectedJobIds.size} of ${jobs.length} selected` : `Select all (${jobs.length})`}
                    </span>
                  </div>

                  <div className="space-y-2">
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
                                {job.site_name ?? `Job ${job.job_id.slice(0, 8)}`}
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
                                {job.input_type === "image" ? <FileImage className="w-3 h-3" /> : <FileVideo className="w-3 h-3" />}
                                {job.input_type}
                              </span>
                              {job.file_count != null && (
                                <span>{job.file_count} file{job.file_count !== 1 ? "s" : ""}</span>
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
          </div>

          {/* ── RIGHT COLUMN — Validation Results ──────────────────── */}
          <div>
            {!validationResults && !isUploading ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-24 text-gray-400">
                <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-8 h-8 text-gray-300" />
                </div>
                <p className="font-medium text-gray-500 dark:text-gray-400">Validation results will appear here</p>
                <p className="text-sm mt-1 text-gray-400">Fill the form, add files, and click Upload & Validate</p>
              </div>
            ) : isUploading ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-24 gap-4">
                <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
                <p className="text-gray-500 dark:text-gray-400 font-medium">Validating files…</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Filters + Summary */}
                <div className="bg-white dark:bg-[#161616] rounded-2xl border border-gray-200 dark:border-gray-800 p-4 shadow-sm">
                  <div className="flex flex-wrap gap-4 mb-4">
                    {/* GPS filter */}
                    <div>
                      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mr-2">GPS</span>
                      {(["all", "with", "without"] as const).map(opt => (
                        <button
                          key={opt}
                          onClick={() => setGpsFilter(opt)}
                          className={cn(
                            "mr-1 px-2.5 py-1 rounded-full text-xs font-medium transition",
                            gpsFilter === opt
                              ? "bg-blue-600 text-white"
                              : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                          )}
                        >
                          {opt === "all" ? "All" : opt === "with" ? "With GPS" : "Without GPS"}
                        </button>
                      ))}
                    </div>
                    {/* Blur filter */}
                    <div>
                      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mr-2">Blur</span>
                      {(["all", "sharp", "blurry"] as const).map(opt => (
                        <button
                          key={opt}
                          onClick={() => setBlurFilter(opt)}
                          className={cn(
                            "mr-1 px-2.5 py-1 rounded-full text-xs font-medium transition",
                            blurFilter === opt
                              ? "bg-blue-600 text-white"
                              : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                          )}
                        >
                          {opt === "all" ? "All" : opt === "sharp" ? "High Quality" : "Low Quality"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Summary */}
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
                  <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 bg-white dark:bg-[#161616] rounded-xl border border-gray-200 dark:border-gray-800">
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

                {/* File cards */}
                {filteredResults.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">No files match the current filters.</p>
                ) : (
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
                            onPreview={() => setPreviewFilename(r.filename)}
                            onToggleSelect={isNoGps ? () => toggleSelectFilename(r.filename) : undefined}
                            onSetLocation={isNoGps ? () => { setModalCtx(r.filename); setSaveError(null); setSaveSuccess(null); } : undefined}
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
          </div>
        </div>
      </main>

      {/* ── Image Preview Modal ── */}
      {previewResult && (
        <ImagePreviewModal result={previewResult} onClose={() => setPreviewFilename(null)} />
      )}
    </div>
  );
}

// ─── Image Preview Modal ──────────────────────────────────────────────────────

function ImagePreviewModal({ result, onClose }: { result: ValidationResult; onClose: () => void }) {
  const isLowQuality = result.laplacian_score < result.blur_threshold;
  const imageUrl = result.original_path ? `${API_BASE_URL}/static/${result.original_path}` : null;

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
  onPreview,
  onToggleSelect,
  onSetLocation,
}: {
  result: ValidationResult;
  isNoGps?: boolean;
  isSelected?: boolean;
  displayCoords?: { lat: number; lng: number } | null;
  locationLabel?: string | null;
  onPreview: () => void;
  onToggleSelect?: () => void;
  onSetLocation?: () => void;
}) {
  const isLowQuality = result.laplacian_score < result.blur_threshold;
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
          result.is_valid
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

        <span className={cn(
          "shrink-0 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold",
          isLowQuality
            ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
            : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
        )}>
          {isLowQuality && <AlertTriangle className="w-2.5 h-2.5" />}
          {isLowQuality ? "Low" : "High"}
        </span>

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
    </div>
  );
}