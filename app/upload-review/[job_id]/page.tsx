"use client";

import { useState, useCallback, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  API_BASE_URL,
  getAuthHeaders,
  getJob,
  overrideFile,
  updateLocation,
  type FileStatusItem,
  type LocationUpdateRequest,
} from "@/lib/api";
import LocationPickerModal, {
  type LocationPickerResult,
} from "@/components/LocationPickerModal";
import ImagePreviewModal from "@/components/upload/ImagePreviewModal";
import { useFileUrl } from "@/hooks/useSignedUrl";
import { Button } from "@/components/ui/button";
import AppNav from "@/components/AppNav";
import { ErrorAlert } from "@/components/ui/ErrorAlert";
import { ListSkeleton } from "@/components/ui/skeleton";
import {
  ArrowRight,
  Filter,
  MapPin,
  MapPinOff,
  Image as ImageIcon,
  Layers,
  Loader2,
  CheckSquare,
  Square,
  Map,
  RotateCcw,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FileRow extends FileStatusItem {
  hasGps: boolean;
}

type FilterType = "all" | "gps" | "no-gps";

// Which modal is open: "batch" | "select" | file_id string (single)
type ModalContext = "batch" | "select" | string | null;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Convert a LocationPickerResult into a PATCH payload for updateLocation(). */
function toPayload(result: LocationPickerResult): LocationUpdateRequest {
  const p: LocationUpdateRequest = {};
  if (result.latitude != null && result.longitude != null) {
    p.latitude  = result.latitude;
    p.longitude = result.longitude;
    if (result.altitude != null) p.altitude = result.altitude;
  }
  if (result.location_label) p.location_label = result.location_label;
  return p;
}

// Mirrors BLUR_THRESHOLD in backend/app/services/input/validate.py (file records don't carry it)
const BLUR_THRESHOLD = 20;

function Thumbnail({ fileId, alt, onOpen }: { fileId: string; alt: string; onOpen: () => void }) {
  const url = useFileUrl(fileId);
  return (
    <button
      onClick={e => { e.stopPropagation(); onOpen(); }}
      className="shrink-0 w-12 h-12 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-800 bg-gray-100 dark:bg-gray-900 flex items-center justify-center hover:ring-2 hover:ring-blue-500 transition cursor-pointer"
      title="View image"
      aria-label={`View ${alt}`}
    >
      {url
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={url} alt={alt} loading="lazy" className="w-full h-full object-cover" />
        : <ImageIcon className="w-4 h-4 text-gray-400" />}
    </button>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function UploadReviewPage() {
  const params  = useParams();
  const jobId   = params.job_id as string;
  const router  = useRouter();

  // ── File list ───────────────────────────────────────────────────────────────
  const [files,      setFiles]      = useState<FileRow[]>([]);
  const [isLoading,  setIsLoading]  = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [jobStatus,  setJobStatus]  = useState<string | null>(null);
  // For failed jobs: true when preprocessing already finished, so the retry goes to detection
  const [preprocessDone, setPreprocessDone] = useState(false);

  const loadFiles = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const job = await getJob(jobId) as Awaited<ReturnType<typeof getJob>> & { files?: FileStatusItem[] };
      const items = job.files ?? [];
      setJobStatus(job.status);
      if (job.status === "failed") {
        const res = await fetch(`${API_BASE_URL}/api/v1/jobs/${encodeURIComponent(jobId)}/preprocess`, { headers: await getAuthHeaders() });
        setPreprocessDone(res.ok);
      }
      setFiles(items.map(f => {
        const gps_data = f.gps_data ?? (f.gps_latitude != null && f.gps_longitude != null
          ? { latitude: f.gps_latitude, longitude: f.gps_longitude, altitude: f.gps_altitude ?? null }
          : null);
        return { ...f, gps_data, hasGps: gps_data != null || !!f.location_label };
      }));
    } catch (e: unknown) {
      setFetchError(e instanceof Error ? e.message : "Failed to load files");
    } finally {
      setIsLoading(false);
    }
  }, [jobId]);

  useEffect(() => { loadFiles(); }, [loadFiles]);

  // "Use anyway" on a file that failed the blur check
  const [overridingId, setOverridingId] = useState<string | null>(null);
  async function handleOverride(fileId: string) {
    setOverridingId(fileId);
    setSaveError(null);
    try {
      await overrideFile(jobId, fileId);
      await loadFiles(); // job status is re-evaluated server-side
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : "Couldn't accept the file");
    } finally {
      setOverridingId(null);
    }
  }

  // ── Filter + selection ──────────────────────────────────────────────────────
  const [filterType,  setFilterType]  = useState<FilterType>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const eligibleFiles  = files.filter(f => !f.hasGps);
  const allBatchDisabled = eligibleFiles.length === 0;

  const visibleFiles = files.filter(f => {
    if (filterType === "gps")    return f.hasGps;
    if (filterType === "no-gps") return !f.hasGps;
    return true;
  });

  function toggleSelect(id: string) {
    const file = files.find(f => f.file_id === id);
    if (!file || file.hasGps) return;
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const selectAllEligible = () =>
    setSelectedIds(new Set(eligibleFiles.map(f => f.file_id)));
  const clearSelection = () => setSelectedIds(new Set());

  const [previewId, setPreviewId] = useState<string | null>(null);
  const previewFile = files.find(f => f.file_id === previewId) ?? null;

  // ── Modal state ─────────────────────────────────────────────────────────────
  const [modalCtx,    setModalCtx]    = useState<ModalContext>(null);
  const [saving,      setSaving]      = useState(false);
  const [saveError,   setSaveError]   = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<ModalContext>(null); // which context last succeeded

  const modalFile = typeof modalCtx === "string" && modalCtx !== "batch" && modalCtx !== "select"
    ? files.find(f => f.file_id === modalCtx) ?? null
    : null;

  /** Called when the user confirms a location in any context */
  async function handleConfirm(result: LocationPickerResult) {
    const payload = toPayload(result);
    // Guard: must have at least coords or label
    if (!payload.latitude && !payload.location_label) return;

    // Capture selected IDs before clearSelection() is called below
    const capturedSelectedIds = new Set(selectedIds);

    setSaving(true);
    setSaveError(null);
    try {
      if (modalCtx === "batch") {
        // Batch — omit file_ids; backend updates all files missing location
        await updateLocation(jobId, payload);
      } else if (modalCtx === "select") {
        await updateLocation(jobId, { ...payload, file_ids: [...selectedIds] });
        clearSelection();
      } else if (typeof modalCtx === "string") {
        // Single file
        await updateLocation(jobId, { ...payload, file_ids: [modalCtx] });
      }
      setSaveSuccess(modalCtx);
      setModalCtx(null);

      // The backend PATCH only writes to metadata.json — the jobs DB record is not
      // updated, so re-fetching via loadFiles() would return stale null GPS data.
      // Optimistically apply the saved location directly to local state instead.
      const newGpsData = payload.latitude != null && payload.longitude != null
        ? { latitude: payload.latitude, longitude: payload.longitude, altitude: payload.altitude ?? null }
        : null;
      const newLabel = payload.location_label ?? null;

      setFiles(prev => prev.map(f => {
        const isTargeted =
          modalCtx === "batch"  ? !f.hasGps :
          modalCtx === "select" ? capturedSelectedIds.has(f.file_id) :
          f.file_id === modalCtx;
        if (!isTargeted) return f;
        const updatedGps    = newGpsData ?? f.gps_data ?? null;
        const updatedLabel  = newLabel   ?? f.location_label ?? null;
        return {
          ...f,
          gps_data:      updatedGps,
          location_label: updatedLabel,
          hasGps: (updatedGps?.latitude != null && updatedGps?.longitude != null) || !!updatedLabel,
        };
      }));
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setSaving(false);
    }
  }

  // ── Stats ───────────────────────────────────────────────────────────────────
  const totalImages   = files.length;
  const withGps       = files.filter(f => f.hasGps).length;
  const withoutGps    = totalImages - withGps;
  const completionPct = totalImages > 0 ? Math.round((withGps / totalImages) * 100) : 0;

  const validCount = files.filter(f => f.status !== "invalid").length;
  const isFailed   = jobStatus === "failed";
  const nextAction =
    isFailed && preprocessDone ? { label: "Retry detection",     href: `/detect/${jobId}` } :
    isFailed                   ? { label: "Retry preprocessing", href: `/preprocess/${jobId}` } :
                                 { label: "Proceed",             href: `/preprocess/${jobId}` };
  const canProceed = !isLoading && !fetchError && validCount > 0 && jobStatus !== "validating";

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#14171e]">

      {/* ── Location picker modal (shared across all three modes) ──────────── */}
      {modalCtx !== null && (
        <LocationPickerModal
          title={
            modalCtx === "batch"  ? `Batch — apply to all ${withoutGps} files without location` :
            modalCtx === "select" ? `Apply to ${selectedIds.size} selected file${selectedIds.size !== 1 ? "s" : ""}` :
            modalFile?.filename   ?? "Set Location"
          }
          onConfirm={handleConfirm}
          onClose={() => { setModalCtx(null); setSaveError(null); }}
        />
      )}

      {previewFile && (
        <ImagePreviewModal
          result={{
            file_id:         previewFile.file_id,
            filename:        previewFile.filename,
            is_valid:        previewFile.status !== "invalid",
            laplacian_score: previewFile.laplacian_score ?? 0,
            blur_threshold:  BLUR_THRESHOLD,
            is_blurry:       (previewFile.laplacian_score ?? 0) < BLUR_THRESHOLD,
            gps_data:        previewFile.gps_data,
            location_label:  previewFile.location_label,
          }}
          onClose={() => setPreviewId(null)}
        />
      )}

      {/* ── Saving overlay (blocks double-submit while PATCH is in flight) ─── */}
      {saving && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="flex items-center gap-3 bg-white dark:bg-[#161616] rounded-2xl px-6 py-4 shadow-xl border border-gray-200 dark:border-gray-800">
            <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Saving location…</span>
          </div>
        </div>
      )}

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <AppNav
        back="/inspection"
        section="upload review"
        title="Upload Review"
        subtitle="Verify GPS data and assign missing locations"
        actions={
          <Button
          className="bg-blue-600 hover:bg-blue-700 text-white border-blue-600 border font-semibold cursor-pointer"
          disabled={!canProceed}
          onClick={() => router.push(nextAction.href)}
        >
          {nextAction.label}
          {isFailed ? <RotateCcw className="w-4 h-4 ml-2" /> : <ArrowRight className="w-4 h-4 ml-2" />}
        </Button>
        }
      />

      <div className="max-w-7xl mx-auto px-6 py-8">
        {!isLoading && !fetchError && (isFailed || validCount === 0) && (
          <div className={cn(
            "mb-6 rounded-xl border px-4 py-3 text-sm",
            isFailed
              ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300"
              : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300",
          )}>
            {files.length === 0 ? (
              <>No files were uploaded for this job. <a href="/upload" className="underline font-semibold">Start a new upload</a>.</>
            ) : validCount === 0 ? (
              <>Every file failed the blur check. Press <b>Use anyway</b> on a file to continue with it.</>
            ) : preprocessDone ? (
              <>Detection failed for this job. Press <b>Retry detection</b> to run it again.</>
            ) : (
              <>This job failed. Press <b>Retry preprocessing</b> to run it again with the {validCount} usable file{validCount !== 1 ? "s" : ""}.</>
            )}
          </div>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── Left: file list ──────────────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-4">

            {/* Filter + count */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-400" />
                <div className="flex gap-1">
                  {(["all", "gps", "no-gps"] as FilterType[]).map(t => (
                    <button
                      key={t}
                      onClick={() => setFilterType(t)}
                      className={cn(
                        "flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer",
                        filterType === t
                          ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900"
                          : "bg-white dark:bg-[#161616] border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:border-gray-400",
                      )}
                    >
                      {t === "gps"    && <MapPin    className="w-3 h-3" />}
                      {t === "no-gps" && <MapPinOff className="w-3 h-3" />}
                      {t === "all" ? "All" : t === "gps" ? "With Location" : "No Location"}
                    </button>
                  ))}
                </div>
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                {visibleFiles.length} / {totalImages} files
              </span>
            </div>

            {/* Select-toggle toolbar */}
            {eligibleFiles.length > 0 && (
              <div className="flex items-center gap-3 px-4 py-2.5 bg-white dark:bg-[#161616] rounded-xl border border-gray-200 dark:border-gray-800">
                <button
                  onClick={selectedIds.size === eligibleFiles.length ? clearSelection : selectAllEligible}
                  className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition cursor-pointer"
                >
                  {selectedIds.size === eligibleFiles.length
                    ? <CheckSquare className="w-4 h-4 text-blue-500" />
                    : <Square      className="w-4 h-4" />}
                  {selectedIds.size === eligibleFiles.length ? "Deselect all" : "Select all no-GPS"}
                </button>
                {selectedIds.size > 0 && (
                  <>
                    <span className="text-gray-300 dark:text-gray-700">|</span>
                    <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                      {selectedIds.size} selected
                    </span>
                    <button
                      onClick={clearSelection}
                      className="text-xs text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition cursor-pointer ml-auto"
                    >
                      Clear
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Error from save */}
            <ErrorAlert error={saveError} title="Couldn't save the location" onDismiss={() => setSaveError(null)} />

            {/* File rows */}
            {isLoading ? (
              <ListSkeleton rows={5} label="Loading files…" />
            ) : fetchError ? (
              <ErrorAlert error={fetchError} title="Couldn't load the files" onRetry={loadFiles} />
            ) : visibleFiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                <ImageIcon className="w-10 h-10 mb-3 opacity-50" />
                <p className="text-sm">No files match this filter</p>
              </div>
            ) : (
              <div className="space-y-2">
                {visibleFiles.map(file => {
                  const isSelected = selectedIds.has(file.file_id);
                  const canSelect  = !file.hasGps;
                  return (
                    <div
                      key={file.file_id}
                      onClick={() => canSelect && toggleSelect(file.file_id)}
                      className={cn(
                        "flex items-center gap-4 px-4 py-3 rounded-xl border transition",
                        canSelect ? "cursor-pointer" : "cursor-default",
                        isSelected
                          ? "bg-blue-50 border-blue-300 dark:bg-blue-950/30 dark:border-blue-700"
                          : "bg-white border-gray-200 hover:border-gray-300 dark:bg-[#161616] dark:border-gray-800 dark:hover:border-gray-700",
                      )}
                    >
                      {/* Checkbox / GPS icon */}
                      <div className="shrink-0">
                        {canSelect
                          ? isSelected
                              ? <CheckSquare className="w-4 h-4 text-blue-500" />
                              : <Square      className="w-4 h-4 text-gray-300 dark:text-gray-600" />
                          : <MapPin className="w-4 h-4 text-emerald-500" />
                        }
                      </div>

                      <Thumbnail fileId={file.file_id} alt={file.filename} onOpen={() => setPreviewId(file.file_id)} />

                      {/* Filename + coords */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {file.filename}
                        </p>
                        {file.gps_data?.latitude != null && file.gps_data?.longitude != null ? (
                          <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5 font-mono">
                            {file.gps_data.latitude.toFixed(6)}, {file.gps_data.longitude.toFixed(6)}
                            {file.gps_data.altitude != null && ` · ${file.gps_data.altitude.toFixed(1)} m`}
                          </p>
                        ) : file.location_label ? (
                          <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5 truncate">
                            {file.location_label}
                          </p>
                        ) : (
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">No location</p>
                        )}
                      </div>

                      {/* Badge + single-edit button */}
                      <div className="shrink-0 flex items-center gap-2">
                        {file.status === "invalid" && (
                          <button
                            onClick={e => { e.stopPropagation(); handleOverride(file.file_id); }}
                            disabled={overridingId !== null}
                            className="bg-red-600 hover:bg-red-700 text-white border-red-600 px-2 py-0.5 rounded-full text-[11px] font-bold border transition cursor-pointer disabled:opacity-50"
                            title="This image failed the blur check. Use it anyway?"
                          >
                            {overridingId === file.file_id ? "Saving…" : "Blurry · Use anyway"}
                          </button>
                        )}
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-[11px] font-bold",
                          file.hasGps
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                            : "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
                        )}>
                          {file.hasGps ? (file.gps_data?.latitude != null ? "GPS" : "Label") : "No GPS"}
                        </span>
                        {!file.hasGps && (
                          <button
                            onClick={e => { e.stopPropagation(); setModalCtx(file.file_id); setSaveError(null); }}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:text-blue-400 dark:hover:bg-blue-950/30 transition cursor-pointer"
                            title="Set location"
                          >
                            <Map className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Right: summary + action panels ───────────────────────────── */}
          <div className="space-y-5">

            {/* Summary */}
            <div className="bg-white dark:bg-[#161616] rounded-2xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-4">
                Summary
              </h2>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="border border-gray-200 dark:border-gray-800 rounded-xl p-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
                    <ImageIcon className="w-3.5 h-3.5" /> Total
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalImages}</p>
                </div>
                <div className="border border-gray-200 dark:border-gray-800 rounded-xl p-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-emerald-500" /> Located
                  </p>
                  <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{withGps}</p>
                </div>
                <div className="border border-gray-200 dark:border-gray-800 rounded-xl p-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
                    <MapPinOff className="w-3.5 h-3.5 text-orange-500" /> No Location
                  </p>
                  <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{withoutGps}</p>
                </div>
                <div className="border border-gray-200 dark:border-gray-800 rounded-xl p-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Coverage</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{completionPct}%</p>
                </div>
              </div>
              <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1.5">
                <div
                  className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500"
                  style={{ width: `${completionPct}%` }}
                />
              </div>
            </div>

            {/* Select-toggle panel — visible when ≥1 file selected */}
            {selectedIds.size > 0 && (
              <div className="bg-white dark:bg-[#161616] rounded-2xl border border-blue-300 dark:border-blue-700 p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-1">
                  <CheckSquare className="w-4 h-4 text-blue-500 shrink-0" />
                  <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                    {selectedIds.size} File{selectedIds.size !== 1 ? "s" : ""} Selected
                  </h2>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                  Assign the same location to all selected files.
                </p>
                {saveSuccess === "select" && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 mb-3">
                    Location applied to selected files.
                  </p>
                )}
                <Button
                  className="bg-blue-600 hover:bg-blue-700 text-white border-blue-600 w-full border font-semibold cursor-pointer"
                  onClick={() => { setModalCtx("select"); setSaveError(null); setSaveSuccess(null); }}
                >
                  <Map className="w-4 h-4 mr-2" />
                  Set Location for Selected
                </Button>
              </div>
            )}

            {/* Batch panel */}
            <div className="bg-white dark:bg-[#161616] rounded-2xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <Layers className="w-4 h-4 text-gray-500 shrink-0" />
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Batch Apply</h2>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                {allBatchDisabled
                  ? "All files already have a location — nothing to update."
                  : `Applies one location to all ${withoutGps} file${withoutGps !== 1 ? "s" : ""} missing a location.`
                }
              </p>
              {saveSuccess === "batch" && (
                <p className="text-xs text-emerald-600 dark:text-emerald-400 mb-3">
                  Batch location applied successfully.
                </p>
              )}
              <Button
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 border border-gray-400 dark:bg-gray-800/60 dark:hover:bg-gray-800 dark:text-gray-200 dark:border-gray-600 font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                onClick={() => { setModalCtx("batch"); setSaveError(null); setSaveSuccess(null); }}
                disabled={allBatchDisabled}
              >
                <Map className="w-4 h-4 mr-2" />
                Set Location for All
              </Button>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
