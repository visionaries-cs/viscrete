"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  createJob,
  validateFiles,
  listJobs,
  type JobStatusResponse,
  type ValidationResult,
} from "@/lib/api";
import {
  Upload,
  Loader2,
  CheckCircle2,
  XCircle,
  MapPin,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Trash2,
  FileImage,
  FileVideo,
  Clock,
  AlertCircle,
} from "lucide-react";

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

  // ── Previous jobs
  const [jobs, setJobs] = useState<JobStatusResponse[]>([]);
  const [jobsPage, setJobsPage] = useState(1);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [jobsError, setJobsError] = useState<string | null>(null);

  // ── Toast
  const [toast, setToast] = useState<{ msg: string; type: "error" | "warn" } | null>(null);

  // Reset files when media type changes
  useEffect(() => {
    setFiles([]);
    setValidationResults(null);
    setCanProceed(false);
    setUploadError(null);
  }, [mediaType]);

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

  // ── Filter validation results
  const filteredResults = (validationResults ?? []).filter(r => {
    const hasGps = r.gps != null;
    if (gpsFilter === "with" && !hasGps) return false;
    if (gpsFilter === "without" && hasGps) return false;
    if (blurFilter === "sharp" && r.is_blurry) return false;
    if (blurFilter === "blurry" && !r.is_blurry) return false;
    return true;
  });

  // ── Pagination
  const totalPages = Math.max(1, Math.ceil(jobs.length / JOBS_PER_PAGE));
  const pagedJobs = jobs.slice((jobsPage - 1) * JOBS_PER_PAGE, jobsPage * JOBS_PER_PAGE);

  const validCount = validationResults?.filter(r => r.is_valid).length ?? 0;
  const invalidCount = (validationResults?.length ?? 0) - validCount;

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

      {/* Header */}
      <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-[#111]">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
            <FileImage className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-gray-900 dark:text-white tracking-wide">VISCRETE</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">Concrete Defect Detection System</p>
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
                <div className="mt-4 space-y-2">
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
                <button onClick={loadJobs} className="text-xs text-blue-500 hover:underline">Refresh</button>
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
                  <div className="space-y-2">
                    {pagedJobs.map(job => (
                      <button
                        key={job.job_id}
                        onClick={() => router.push(routeForJob(job))}
                        className="w-full text-left flex items-center gap-3 px-3 py-3 rounded-xl border border-gray-100 dark:border-gray-800 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition group"
                      >
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
                      </button>
                    ))}
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
                          {opt === "all" ? "All" : opt.charAt(0).toUpperCase() + opt.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Summary */}
                  <div className="text-sm text-gray-600 dark:text-gray-300 flex flex-wrap gap-3">
                    <span className="font-medium">{validationResults!.length} files uploaded</span>
                    <span className="text-gray-300 dark:text-gray-600">•</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">{validCount} valid</span>
                    <span className="text-gray-300 dark:text-gray-600">•</span>
                    <span className="text-red-500 dark:text-red-400 font-medium">{invalidCount} invalid</span>
                  </div>
                </div>

                {/* File cards */}
                {filteredResults.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">No files match the current filters.</p>
                ) : (
                  filteredResults.map((r, i) => (
                    <FileResultCard key={i} result={r} />
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

// ─── File Result Card ─────────────────────────────────────────────────────────

function FileResultCard({ result }: { result: ValidationResult }) {
  return (
    <div className={cn(
      "bg-white dark:bg-[#161616] rounded-2xl border shadow-sm p-4 transition",
      result.is_valid
        ? "border-emerald-200 dark:border-emerald-900"
        : "border-red-200 dark:border-red-900"
    )}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <span className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate flex-1">
          {result.filename}
        </span>
        <span className={cn(
          "flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold shrink-0",
          result.is_valid
            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
            : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
        )}>
          {result.is_valid ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
          {result.is_valid ? "Valid" : "Invalid"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 dark:text-gray-400">
        <div>
          <span className="text-gray-400 dark:text-gray-500">Laplacian Score</span>
          <p className="font-medium text-gray-800 dark:text-gray-200">
            {result.laplacian_score.toFixed(1)}
            <span className="ml-1 text-gray-400 font-normal">(threshold: {result.blur_threshold.toFixed(1)})</span>
          </p>
        </div>
        <div>
          <span className="text-gray-400 dark:text-gray-500">Sharpness</span>
          <p className={cn("font-medium", result.is_blurry ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400")}>
            {result.is_blurry ? "Blurry" : "Sharp"}
          </p>
        </div>
        <div className="col-span-2">
          <span className="text-gray-400 dark:text-gray-500">GPS</span>
          <p className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-1">
            {result.gps
              ? <><MapPin className="w-3 h-3 text-blue-400" />{result.gps.lat.toFixed(4)}, {result.gps.lng.toFixed(4)}</>
              : "—"}
          </p>
        </div>
      </div>

      {!result.is_valid && result.reason && (
        <div className="mt-3 flex items-center gap-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 px-3 py-2 rounded-lg">
          <XCircle className="w-3.5 h-3.5 shrink-0" />
          {result.reason}
        </div>
      )}
    </div>
  );
}