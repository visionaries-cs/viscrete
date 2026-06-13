'use client';

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  generateReport,
  patchRemarks,
  getJobStorageUrl,
  getAuthHeaders,
  type DetectResponse,
  type Detection,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  AlertCircle,
  Download,
  ChevronDown,
  Archive,
  Scan,
  Box,
  Tag,
  Layers,
  ImageIcon,
  FileText,
  ExternalLink,
  Table2,
  RefreshCw,
  X,
  Check,
  ZoomIn,
  MessageSquare,
  Settings,
  Calendar,
  LogOut,
  PanelLeft,
  PanelRight,
  Clock,
} from "lucide-react";
import { ModeToggle } from "@/components/ui/mode-toggle";
import { getSupabase } from "@/lib/supabase";
import { useCurrentUser } from "@/hooks/useCurrentUser";

// ─── Types / Helpers ──────────────────────────────────────────────────────────

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "https://viscrete-core.shares.zrok.io";

const REDIRECT_STATUSES = new Set(["detected", "reporting", "completed"]);

const defectBorderColor: Record<string, string> = {
  crack: 'border-red-500',
  spalling: 'border-yellow-500',
  peeling: 'border-orange-500',
  algae: 'border-green-500',
};

const defectBgColor: Record<string, string> = {
  crack: 'bg-red-500/20',
  spalling: 'bg-yellow-500/20',
  peeling: 'bg-orange-500/20',
  algae: 'bg-green-500/20',
};

const defectLabelBg: Record<string, string> = {
  crack: 'bg-red-500',
  spalling: 'bg-yellow-500',
  peeling: 'bg-orange-500',
  algae: 'bg-green-500',
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ResultPage() {
  const params = useParams();
  const jobId = params.job_id as string;
  const router = useRouter();
  const { email } = useCurrentUser();

  // Detection state
  const [isRunning, setIsRunning] = useState(false);
  const [hasRun, setHasRun] = useState(false);
  const [detectData, setDetectData] = useState<DetectResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (remarkDebounceRef.current) clearTimeout(remarkDebounceRef.current);
      if (remarkSavedTimerRef.current) clearTimeout(remarkSavedTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Report state
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportGenerated, setReportGenerated] = useState(false);
  const [needsRegenerate, setNeedsRegenerate] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isZipDownloading, setIsZipDownloading] = useState(false);
  const [csvGenerated, setCsvGenerated] = useState(false);

  // The actual API response is flat (api.ts types are outdated):
  // { job_id, file_id, total_defects, detections[], annotated_paths[] }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const flatData = detectData as any;
  const flatDetections: Detection[] = flatData?.detections ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const perfMetrics = (flatData?.performance_metrics ?? null) as {
    file_count: number;
    total_duration_sec: number;
    avg_duration_per_file_sec: number;
    job_size_mb: number;
    avg_cpu_percent: number;
  } | null;

  // Derive per-class counts from the detections array.
  // The API's total_defect_counts field is unreliable — counting from flatDetections is the ground truth.
  const cracksCount   = flatDetections.filter(d => d.defect_type === 'crack').length;
  const spallingCount = flatDetections.filter(d => d.defect_type === 'spalling').length;
  const peelingCount  = flatDetections.filter(d => d.defect_type === 'peeling').length;
  const algaeCount    = flatDetections.filter(d => d.defect_type === 'algae').length;
  const totalDefectCount: number = flatData?.total_defects ?? (cracksCount + spallingCount + peelingCount + algaeCount);

  // Image carousel state
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [defectPage, setDefectPage] = useState(0);
  const DEFECT_PAGE_SIZE = 5;

  // Table-level defect class filter — independent of the overlay filter
  const [tableVisibleDefects, setTableVisibleDefects] = useState<Set<string>>(new Set(['crack', 'spalling', 'peeling', 'algae']));
  const toggleTableDefectClass = (cls: string) => {
    setTableVisibleDefects(prev => {
      const next = new Set(prev);
      next.has(cls) ? next.delete(cls) : next.add(cls);
      return next;
    });
    setDefectPage(0);
  };
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0, naturalWidth: 0, naturalHeight: 0 });
  const [imageLoading, setImageLoading] = useState(false);
  // Original (full-res) dimensions of the current image — loaded in background
  // so bbox coordinates (which are in original pixel space) scale correctly
  // even when the display image is served at ?w=1280.
  const [origSize, setOrigSize] = useState<{ w: number; h: number } | null>(null);

  const [fileIdToCarouselIndex, setFileIdToCarouselIndex] = useState<Record<string, number>>({});
  const [fileIdToProcessedPath, setFileIdToProcessedPath] = useState<Record<string, string>>({});
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [highlightedDetection, setHighlightedDetection] = useState<Detection | null>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Per-defect inspector remarks
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [remarkSaving, setRemarkSaving] = useState(false);
  const [remarkSaved, setRemarkSaved] = useState(false);
  const [remarksChangedAfterReport, setRemarksChangedAfterReport] = useState(false);
  const remarkDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const remarkSavedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Lightbox
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  // Image comment modal
  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [commentDraft, setCommentDraft] = useState('');
  const [commentSelectedDefect, setCommentSelectedDefect] = useState<string | null>(null);
  const commentTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Per-class sensitivity selector
  type SensitivityLevel = 'conservative' | 'balanced' | 'aggressive';
  type SensMap = Record<string, SensitivityLevel>;
  const [sensitivity, setSensitivity] = useState<SensMap>({
    crack: 'balanced', spalling: 'balanced', peeling: 'balanced', algae: 'balanced',
  });
  const [readyToRun, setReadyToRun] = useState(false);
  const [sensitivityOpen, setSensitivityOpen] = useState(false);

  // Extract detection duration from detection response
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dur = (detectData as any)?.duration_sec;
    if (dur != null) setDetectionDurationSec(dur as number);
  }, [detectData]);

  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const carouselRef = useRef<HTMLDivElement>(null);

  // Overlay toggles
  type ViewMode = 'overlay' | 'yolo';
  const [viewMode, setViewMode] = useState<ViewMode>('overlay');
  const [showBoundingBoxes, setShowBoundingBoxes] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [showColorOverlay, setShowColorOverlay] = useState(false);

  // Per-class visibility
  const allDefectClasses = ['crack', 'spalling', 'peeling', 'algae'] as const;
  type DefectClass = typeof allDefectClasses[number];
  const [visibleDefects, setVisibleDefects] = useState<Set<DefectClass>>(new Set(allDefectClasses));
  const toggleDefectClass = (cls: DefectClass) =>
    setVisibleDefects(prev => {
      const next = new Set(prev);
      next.has(cls) ? next.delete(cls) : next.add(cls);
      return next;
    });

  // Pipeline timing
  const [preprocessDurationSec, setPreprocessDurationSec] = useState<number | null>(null);
  const [detectionDurationSec, setDetectionDurationSec] = useState<number | null>(null);

  // Performance metrics modal
  const [metricsOpen, setMetricsOpen] = useState(false);

  // Layout & sidebar scope
  const [sidebarSide, setSidebarSide] = useState<'left' | 'right'>('right');
  const [defectSummaryScope, setDefectSummaryScope] = useState<'current' | 'all'>('current');

  // Project info from job status
  const [projectName, setProjectName] = useState("—");
  const [modelName] = useState("YOLOv11-STRUCTURAL.pt");
  const [projectDate, setProjectDate] = useState("—");
  const [siteLocation, setSiteLocation] = useState<string | null>(null);

  type FileGpsEntry = { filename: string; gps_latitude: number | null; gps_longitude: number | null; location_label: string | null };
  const [fileGpsMap, setFileGpsMap] = useState<Record<string, FileGpsEntry>>({});

  // Auto-reload once on non-fatal errors (model likely just finished)
  useEffect(() => {
    if (!error || error.includes("not found")) return;
    const key = `viscrete_reloaded_${jobId}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    window.location.reload();
  }, [error, jobId]);

  // ── Init: check job status, then run detection ──────────────────────────────

  useEffect(() => {
    async function init() {
      try {
        const res = await fetch(`${API_BASE_URL}/api/v1/jobs/${encodeURIComponent(jobId)}`, { headers: await getAuthHeaders() });
        if (res.ok) {
          const job = await res.json();
          if (job.site_location) {
            setProjectName(job.site_location);
            setSiteLocation(job.site_location);
          }
          if (job.created_at) {
            setProjectDate(new Date(job.created_at).toLocaleString("en-PH", {
              month: "long", day: "numeric", year: "numeric",
              hour: "numeric", minute: "2-digit",
            }));
          }
          // Build file GPS map and carousel index map
          if (Array.isArray(job.files)) {
            const gpsMap: Record<string, FileGpsEntry> = {};
            const procByFileId: Record<string, string> = {};
            for (const f of job.files as Array<{ file_id: string; filename?: string; processed_path?: string | null; gps_latitude?: number; gps_longitude?: number; location_label?: string }>) {
              gpsMap[f.file_id] = {
                filename: f.filename ?? f.file_id,
                gps_latitude: f.gps_latitude ?? null,
                gps_longitude: f.gps_longitude ?? null,
                location_label: f.location_label ?? null,
              };
              if (f.processed_path) procByFileId[f.file_id] = f.processed_path;
            }
            setFileGpsMap(gpsMap);
            setFileIdToProcessedPath(procByFileId);
          }
          // Load any previously saved remarks
          if (job.remarks && typeof job.remarks === 'object') {
            setRemarks(job.remarks as Record<string, string>);
          }
          // Restore sensitivity levels from the last detection run
          if (job.per_class_sensitivity && typeof job.per_class_sensitivity === 'object') {
            setSensitivity(prev => ({ ...prev, ...(job.per_class_sensitivity as Record<string, SensitivityLevel>) }));
          }
          if (REDIRECT_STATUSES.has(job.status)) {
            // Already detected — fetch cached results directly
            await fetchCachedResults();
            // Non-blocking: fetch preprocessing timing for sidebar display
            getAuthHeaders().then(h => fetch(`${API_BASE_URL}/api/v1/jobs/${encodeURIComponent(jobId)}/preprocess`, { headers: h }))
              .then(r => r.ok ? r.json() : null)
              .catch(() => null)
              .then((pp: { pipeline_steps?: Array<{ duration_sec: number }> } | null) => {
                if (pp?.pipeline_steps?.length) {
                  const total = pp.pipeline_steps.reduce((s, step) => s + step.duration_sec, 0);
                  setPreprocessDurationSec(total);
                }
              });
            if (job.status === "completed") {
              if (job.pdf_path) {
                setReportGenerated(true);
              } else {
                setNeedsRegenerate(true);
              }
            }
            return;
          }
          if (job.status === "detecting") {
            // Detection is already in-progress on the backend — poll until resolved
            pollForDetection();
            return;
          }
          if (job.status === "preprocessed") {
            setReadyToRun(true);
            return;
          }
        }
      } catch {
        // Fall through and show selector
      }
      setReadyToRun(true);
    }
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchCachedResults() {
    setIsRunning(true);
    setError(null);
    try {
      const { getDetectResults } = await import("@/lib/api");
      const data = await getDetectResults(jobId);
      setDetectData(data);
      setDefectPage(0);
      setHasRun(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load detection results");
    } finally {
      setIsRunning(false);
    }
  }

  function pollForDetection() {
    setIsPolling(true);
    setIsRunning(true);
    setError(null);

    const tick = async () => {
      if (!mountedRef.current) return;
      try {
        const res = await fetch(`${API_BASE_URL}/api/v1/jobs/${encodeURIComponent(jobId)}`, { headers: await getAuthHeaders() });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const job = await res.json();
        if (!mountedRef.current) return;

        if (REDIRECT_STATUSES.has(job.status)) {
          setIsPolling(false);
          if (job.status === "completed") {
            if (job.pdf_path) {
              setReportGenerated(true);
            } else {
              setNeedsRegenerate(true);
            }
          }
          await fetchCachedResults();
          return;
        }
        if (job.status === "detecting") {
          setTimeout(tick, 2000);
          return;
        }
        if (job.status === "failed") {
          setIsPolling(false);
          setIsRunning(false);
          setError("Detection failed on the server.");
          return;
        }
        setIsPolling(false);
        setIsRunning(false);
        setError(`Unexpected job status: ${job.status}`);
      } catch (e: unknown) {
        if (!mountedRef.current) return;
        setIsPolling(false);
        setIsRunning(false);
        setError(e instanceof Error ? e.message : "Failed to poll job status");
      }
    };

    tick();
  }

  async function runDetection(sens?: SensMap) {
    const activeSens = sens ?? sensitivity;
    setIsRunning(true);
    setReadyToRun(false);
    setHasRun(false);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (activeSens.crack)    params.set('crack',    activeSens.crack);
      if (activeSens.spalling) params.set('spalling', activeSens.spalling);
      if (activeSens.peeling)  params.set('peeling',  activeSens.peeling);
      if (activeSens.algae)    params.set('algae',    activeSens.algae);
      const query = params.size > 0 ? `?${params.toString()}` : '';
      const res = await fetch(
        `${API_BASE_URL}/api/v1/jobs/${encodeURIComponent(jobId)}/detect${query}`,
        { method: "POST", headers: await getAuthHeaders() }
      );
      if (!mountedRef.current) return;
      if (res.status === 404) { setError("Job not found."); setIsRunning(false); return; }
      if (!res.ok && res.status !== 409) { setError(`Detection failed (HTTP ${res.status})`); setIsRunning(false); return; }
      // Clear stale remarks — def_ids will change after re-detection
      setRemarks({});
      setRemarksChangedAfterReport(false);
      // 202 = inference started; 409 = already detecting — poll until resolved
      pollForDetection();
    } catch (e: unknown) {
      if (!mountedRef.current) return;
      setError(e instanceof Error ? e.message : "Detection failed");
      setIsRunning(false);
    }
  }

  // ── Report generation ───────────────────────────────────────────────────────

  async function handleGenerateReport() {
    setReportError(null);
    setIsGenerating(true);
    try {
      await generateReport(jobId);
      setReportGenerated(true);
    } catch (e: unknown) {
      setReportError(e instanceof Error ? e.message : "Failed to generate report");
    } finally {
      setIsGenerating(false);
    }
  }

  function openImageComment() {
    if (!currentFileId) return;
    const key = `img-${currentFileId}`;
    setCommentDraft(remarks[key] ?? '');
    setCommentSelectedDefect(null);
    setCommentModalOpen(true);
    setTimeout(() => commentTextareaRef.current?.focus(), 50);
  }

  function handleCommentDefectSelect(defId: string) {
    const mention = `[${defId}] `;
    setCommentSelectedDefect(defId);
    setCommentDraft(prev => {
      if (prev.includes(mention)) return prev;
      // Strip any existing [DEF-XXX] mention at the start and replace
      const stripped = prev.replace(/^\[DEF-\d+\]\s*/, '');
      return mention + stripped;
    });
    setTimeout(() => {
      const ta = commentTextareaRef.current;
      if (!ta) return;
      ta.focus();
      ta.setSelectionRange(ta.value.length, ta.value.length);
    }, 20);
  }

  function saveImageComment() {
    if (!currentFileId) return;
    const key = `img-${currentFileId}`;
    handleRemarkChange(key, commentDraft);
    setCommentModalOpen(false);
  }

  function handleRemarkChange(defId: string, value: string) {
    setRemarks(prev => ({ ...prev, [defId]: value }));
    if (reportGenerated) setRemarksChangedAfterReport(true);
    if (remarkSaved) setRemarkSaved(false);
    if (remarkDebounceRef.current) clearTimeout(remarkDebounceRef.current);
    remarkDebounceRef.current = setTimeout(async () => {
      setRemarkSaving(true);
      try {
        await patchRemarks(jobId, { [defId]: value });
        setRemarkSaved(true);
        if (remarkSavedTimerRef.current) clearTimeout(remarkSavedTimerRef.current);
        remarkSavedTimerRef.current = setTimeout(() => setRemarkSaved(false), 2000);
      } finally {
        setRemarkSaving(false);
      }
    }, 500);
  }

  async function handleRegenerateReport() {
    setReportError(null);
    setIsGenerating(true);
    try {
      await generateReport(jobId, true);
      setReportGenerated(true);
      setNeedsRegenerate(false);
      setRemarksChangedAfterReport(false);
    } catch (e: unknown) {
      setReportError(e instanceof Error ? e.message : "Failed to regenerate report");
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleDownloadPdf() {
    setIsDownloading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/jobs/${encodeURIComponent(jobId)}/report`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `inspection-report-${jobId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      setReportError(e instanceof Error ? e.message : "Failed to download PDF");
    } finally {
      setIsDownloading(false);
    }
  }

  function handleViewPdf() {
    window.open(`/report/${jobId}`, '_blank', 'noopener,noreferrer');
  }

  function handleDownloadCsv() {
    const headers = ['Defect Type', 'Confidence', 'Severity', 'Crack Width (mm)', 'Area (px²)'];
    const rows = flatDetections.map((d: Detection) => [
      d.defect_type,
      `${Math.round(d.confidence * 100)}%`,
      d.severity ?? '',
      d.crack_width_mm != null ? d.crack_width_mm.toFixed(1) : '',
      d.area_px != null ? String(d.area_px) : '',
    ]);
    const csv = [headers, ...rows].map(r => r.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inspection-report-${jobId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setCsvGenerated(true);
  }

  async function handleDownloadAnnotatedZip() {
    if (!annotatedPaths.length) return;
    setIsZipDownloading(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/v1/jobs/${encodeURIComponent(jobId)}/annotated-images.zip`,
        { headers: await getAuthHeaders() },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `annotated-${jobId.slice(0, 8)}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      setReportError(e instanceof Error ? e.message : 'Failed to download ZIP');
    } finally {
      setIsZipDownloading(false);
    }
  }

  // ── Image carousel ──────────────────────────────────────────────────────────

  const annotatedPaths: string[] = flatData?.annotated_paths ?? [];
  const totalImages = annotatedPaths.length;

  // Extract file_id from an annotated storage key like "{job_id}/annotated/{file_id}_annotated.jpg"
  function fileIdFromAnnotatedPath(path: string): string {
    return (path.split('/').pop() ?? '').split('_annotated')[0];
  }

  // Rebuild fileIdToCarouselIndex from annotated_paths so table-row clicks navigate
  // to the correct carousel slot (annotated_paths only contains files with detections,
  // so positional index from job.files would be misaligned).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const idxMap: Record<string, number> = {};
    annotatedPaths.forEach((path, idx) => {
      const fid = fileIdFromAnnotatedPath(path);
      if (fid) idxMap[fid] = idx;
    });
    setFileIdToCarouselIndex(idxMap);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [annotatedPaths.join(',')]);

  // Fetch signed URLs for both view modes: annotated (YOLO plot) + processed (overlay)
  useEffect(() => {
    if (!jobId || !annotatedPaths.length) return;
    const keysToFetch = new Set<string>();
    annotatedPaths.forEach((annotatedPath) => {
      keysToFetch.add(annotatedPath);
      const fid = fileIdFromAnnotatedPath(annotatedPath);
      const processedKey = (fid && fileIdToProcessedPath[fid])
        ? fileIdToProcessedPath[fid]
        : annotatedPath.replace('/annotated/', '/processed/').replace(/_annotated(\.[^.]+)$/, '$1');
      keysToFetch.add(processedKey);
    });
    Promise.all(
      [...keysToFetch].map(async key => {
        try { return [key, await getJobStorageUrl(jobId, key)] as [string, string]; }
        catch { return null; }
      })
    ).then(pairs => {
      const valid = pairs.filter(Boolean) as [string, string][];
      if (valid.length) setSignedUrls(prev => ({ ...prev, ...Object.fromEntries(valid) }));
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, annotatedPaths, fileIdToProcessedPath]);

  const goToPrevious = () => setCurrentImageIndex(prev => (prev === 0 ? totalImages - 1 : prev - 1));
  const goToNext = () => setCurrentImageIndex(prev => (prev === totalImages - 1 ? 0 : prev + 1));

  function highlightDetection(det: Detection) {
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    setHighlightedDetection(det);
    highlightTimerRef.current = setTimeout(() => setHighlightedDetection(null), 2500);
  }

  const handleImageLoad = () => {
    const image = imageRef.current;
    if (!image) return;
    setImageLoading(false);
    setImageDimensions({
      width:        image.width,
      height:       image.height,
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
    });
  };

  const currentAnnotatedPath = annotatedPaths[currentImageIndex];

  const currentImageSrc = currentAnnotatedPath
    ? (() => {
        if (viewMode === 'yolo') return signedUrls[currentAnnotatedPath] ?? null;
        const fid = fileIdFromAnnotatedPath(currentAnnotatedPath);
        const processedKey = (fid && fileIdToProcessedPath[fid])
          ? fileIdToProcessedPath[fid]
          : currentAnnotatedPath.replace('/annotated/', '/processed/').replace(/_annotated(\.[^.]+)$/, '$1');
        return signedUrls[processedKey] ?? null;
      })()
    : null;

  // Reset dimensions and mark loading when the displayed image changes
  useEffect(() => {
    setImageDimensions({ width: 0, height: 0, naturalWidth: 0, naturalHeight: 0 });
    if (currentImageSrc) setImageLoading(true);
  }, [currentImageSrc]);

  // Prefetch adjacent images using already-resolved signed URLs
  useEffect(() => {
    if (totalImages < 2) return;
    const indices = [
      (currentImageIndex + 1) % totalImages,
      (currentImageIndex - 1 + totalImages) % totalImages,
    ];
    for (const idx of indices) {
      const path = annotatedPaths[idx];
      if (!path) continue;
      const fid = fileIdFromAnnotatedPath(path);
      const processedKey = (fid && fileIdToProcessedPath[fid])
        ? fileIdToProcessedPath[fid]
        : path.replace('/annotated/', '/processed/').replace(/_annotated(\.[^.]+)$/, '$1');
      for (const key of [path, processedKey]) {
        const src = signedUrls[key];
        if (src) { const img = new Image(); img.src = src; }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentImageIndex, totalImages, signedUrls]);

  // ResizeObserver — fires after every layout change to the img element
  // (window.resize misses flex-layout reflows and gives stale dimensions)
  useEffect(() => {
    const image = imageRef.current;
    if (!image) return;
    const ro = new ResizeObserver(() => {
      // naturalWidth is 0 until the image data is loaded; skip until then
      if (!image.complete || !image.naturalWidth) return;
      setImageDimensions({
        width:        image.width,
        height:       image.height,
        naturalWidth: image.naturalWidth,
        naturalHeight: image.naturalHeight,
      });
    });
    ro.observe(image);
    return () => ro.disconnect();
  }, [currentImageSrc]);

  // Load original (full-res) dimensions in background so overlay scale factors
  // use the original coordinate space, not the downscaled ?w=1280 dimensions.
  useEffect(() => {
    if (!currentImageSrc) { setOrigSize(null); return; }
    setOrigSize(null);
    const fullResUrl = currentImageSrc.replace(/\?w=\d+$/, '');
    const img = new Image();
    img.onload = () => setOrigSize({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = fullResUrl;
  }, [currentImageSrc]);

  // Resolve the file_id of whichever image is currently shown — extracted
  // directly from the annotated path so it stays correct even when only a
  // subset of files have detections.
  const currentFileId = currentAnnotatedPath
    ? (fileIdFromAnnotatedPath(currentAnnotatedPath) || (flatData?.file_id ?? null))
    : (flatData?.file_id ?? null);

  // While a highlight is active, show only that exact detection (reference equality).
  // Otherwise filter by current image and visible defect classes.
  const getCurrentDetections = (): Detection[] => {
    // In YOLO mode the image already has annotations burned in — only show the
    // interactive highlight pulse, nothing else.
    if (viewMode === 'yolo') {
      return highlightedDetection ? flatDetections.filter(d => d === highlightedDetection) : [];
    }
    if (highlightedDetection) {
      return flatDetections.filter(d => d === highlightedDetection);
    }
    return flatDetections.filter(d => {
      if (!visibleDefects.has(d.defect_type as DefectClass)) return false;
      // Filter by file_id
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const detFileId = (d as any).file_id ?? (annotatedPaths.length === 1 ? flatData?.file_id : undefined);
      if (currentFileId && detFileId && detFileId !== currentFileId) return false;
      return true;
    });
  };

  // ── Compute actual rendered image rect inside the object-contain box ─────────
  // With object-contain, the img CSS box may be larger than the rendered content.
  // We need the rendered rect to position overlays correctly.
  const { width: cssW, height: cssH, naturalWidth, naturalHeight } = imageDimensions;
  const hasValidLayout = cssW > 0 && cssH > 0 && naturalWidth > 0 && naturalHeight > 0;
  // Overlays additionally require origSize so bbox coords (original pixel space)
  // scale correctly even when the display image is downscaled via ?w=.
  const hasValidDimensions = hasValidLayout && !!origSize;
  const naturalAspect = hasValidLayout ? naturalWidth / naturalHeight : 1;
  const cssAspect = hasValidLayout ? cssW / cssH : 1;
  const renderedW = hasValidLayout
    ? (naturalAspect > cssAspect ? cssW : cssH * naturalAspect)
    : 0;
  const renderedH = hasValidLayout
    ? (naturalAspect > cssAspect ? cssW / naturalAspect : cssH)
    : 0;
  const offsetX = (cssW - renderedW) / 2;
  const offsetY = (cssH - renderedH) / 2;
  // Use original (full-res) dims for scale so bbox coords map to original pixel space.
  const scaleX = renderedW > 0 && origSize ? renderedW / origSize.w : 0;
  const scaleY = renderedH > 0 && origSize ? renderedH / origSize.h : 0;

  // ── All detections (flat) for the defect table ──────────────────────────────
  const allDetections: Detection[] = flatDetections;

  // ── Scoped detections for sidebar summary + table (current image vs all) ─────
  const currentFileDetections = flatDetections.filter((d) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fid = (d as any).file_id ?? (totalImages <= 1 ? flatData?.file_id : undefined);
    return totalImages <= 1 || fid === currentFileId;
  });
  const scopedDetections = defectSummaryScope === 'current' ? currentFileDetections : flatDetections;
  const scopedTotal    = scopedDetections.length;
  const scopedCrack    = scopedDetections.filter(d => d.defect_type === 'crack').length;
  const scopedSpalling = scopedDetections.filter(d => d.defect_type === 'spalling').length;
  const scopedPeeling  = scopedDetections.filter(d => d.defect_type === 'peeling').length;
  const scopedAlgae    = scopedDetections.filter(d => d.defect_type === 'algae').length;
  const tableFilteredDetections = scopedDetections.filter(d => tableVisibleDefects.has(d.defect_type));

  // ── Location resolution — builds composite display segments ────────────────
  type ResolvedLocation = {
    siteLabel: string;
    geo: { lat: number; lng: number } | null;
    locationLabel: string | null;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function resolveDefectLocation(detection: any): ResolvedLocation | null {
    if (!siteLocation) return null;
    const loc = detection.location;
    const isSingleFile = Object.keys(fileGpsMap).length <= 1;
    const fileId = detection.file_id ?? (isSingleFile ? flatData?.file_id : undefined);
    const file = fileId ? fileGpsMap[fileId] : undefined;

    // GPS segment: defect-level geo → file-level GPS → omit
    let geo: { lat: number; lng: number } | null = null;
    if (loc?.type === 'geo' && loc.latitude != null && loc.longitude != null) {
      geo = { lat: loc.latitude, lng: loc.longitude };
    } else if (file?.gps_latitude != null && file?.gps_longitude != null) {
      geo = { lat: file.gps_latitude, lng: file.gps_longitude };
    }

    return {
      siteLabel: siteLocation,
      geo,
      locationLabel: file?.location_label ?? null,
    };
  }

  // ── Lightbox Escape key listener ─────────────────────────────────────────────
  useEffect(() => {
    if (!lightboxSrc) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setLightboxSrc(null); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [lightboxSrc]);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col min-h-screen overflow-hidden bg-gray-50 dark:bg-[#14171e]">
      {/* HEADER */}
      <header className="fixed top-0 left-0 right-0 z-50
                         border-b border-gray-200 dark:border-gray-800
                         bg-white/80 dark:bg-gray-950/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-3 flex items-center justify-between gap-2 sm:gap-4">
          {/* Left — brand + back + title */}
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <Link href="/" className="flex items-center gap-2 select-none shrink-0">
              <span className="text-sm font-bold font-mono tracking-tight
                               bg-gradient-to-r from-[#2ca75d] to-[#0da6f2]
                               bg-clip-text text-transparent">
                viscrete
              </span>
            </Link>
            <div className="border-l border-gray-200 dark:border-gray-800 pl-2 sm:pl-4 flex items-center gap-2 sm:gap-3 min-w-0">
              <button
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors cursor-pointer shrink-0"
                onClick={() => router.push('/upload')}
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="min-w-0">
                <h1 className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white tracking-wide truncate">
                  <span className="hidden sm:inline">DETECTION </span>RESULTS
                </h1>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {projectName !== "—" ? projectName : `Job: ${jobId.slice(0, 8)}`}
                </p>
              </div>
            </div>
          </div>
          {/* Right — export controls + model + date + toggle */}
          <div className="flex items-center gap-1.5 sm:gap-2 text-xs text-gray-500 dark:text-gray-400 shrink-0">
            <span className="hidden lg:flex items-center gap-1">
              <Settings className="w-4 h-4" />
              {modelName}
            </span>
            <span className="hidden md:flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {projectDate}
            </span>
            {email && (
              <span className="hidden lg:block text-xs text-gray-400 dark:text-gray-500 font-mono truncate max-w-[160px]">
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
      {/* Spacer for fixed header */}
      <div className="h-12 shrink-0" />

      {/* Pre-detection sensitivity selector */}
      {readyToRun && !isRunning && !hasRun && (
        <div className="flex flex-col items-center justify-center flex-1 bg-gray-100 dark:bg-gray-900 p-6">
          <div className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 w-full max-w-lg overflow-hidden">
            {/* Header */}
            <div className="px-6 pt-6 pb-4 border-b border-gray-100 dark:border-gray-800">
              <h2 className="text-base font-bold text-gray-900 dark:text-white">Detection Sensitivity</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Set how aggressively the model flags each defect class before running inference.
              </p>
            </div>
            {/* 2-column × 2-row grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-x divide-gray-100 dark:divide-gray-800">
              {([
                { cls: 'crack',    label: 'Crack',    dot: 'bg-red-500' },
                { cls: 'spalling', label: 'Spalling', dot: 'bg-yellow-500' },
                { cls: 'peeling',  label: 'Peeling',  dot: 'bg-orange-500' },
                { cls: 'algae',    label: 'Algae',    dot: 'bg-green-500' },
              ] as const).map(({ cls, label, dot }) => (
                <div key={cls} className="p-4 flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <span className={cn('w-2 h-2 rounded-full shrink-0', dot)} />
                    <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{label}</span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {(['conservative','balanced','aggressive'] as const).map(level => {
                      const active = sensitivity[cls] === level;
                      const activeStyle: Record<string,string> = {
                        conservative: 'bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-950/40 dark:border-blue-400 dark:text-blue-300',
                        balanced:     'bg-emerald-50 border-emerald-500 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-400 dark:text-emerald-300',
                        aggressive:   'bg-orange-50 border-orange-500 text-orange-700 dark:bg-orange-950/40 dark:border-orange-400 dark:text-orange-300',
                      };
                      const levelDesc: Record<string,string> = {
                        conservative: 'High confidence only',
                        balanced:     'Standard detection',
                        aggressive:   'Maximum coverage',
                      };
                      return (
                        <button
                          key={level}
                          onClick={() => setSensitivity(prev => ({ ...prev, [cls]: level }))}
                          className={cn(
                            'w-full text-left px-3 py-2 rounded-lg border text-xs transition cursor-pointer',
                            active
                              ? activeStyle[level]
                              : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-900',
                          )}
                        >
                          <span className="font-semibold capitalize">{level}</span>
                          {active && <span className="ml-2 opacity-70">— {levelDesc[level]}</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800">
              {error && (
                <div className="flex items-center gap-2 mb-3 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
                  <AlertCircle className="w-4 h-4 shrink-0" />{error}
                </div>
              )}
              <button
                onClick={() => runDetection(sensitivity)}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold transition cursor-pointer"
              >
                Run Detection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading */}
      {isRunning && (
        <div className="flex flex-col items-center justify-center flex-1 gap-4 bg-gray-100 dark:bg-gray-900 text-gray-500 dark:text-gray-400">
          <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
          <p className="font-medium text-gray-900 dark:text-white">
            {isPolling ? "Detection in progress…" : "Running YOLOv11 inference…"}
          </p>
          <p className="text-sm">
            {isPolling ? "Waiting for the backend to finish" : "This may take a moment"}
          </p>
        </div>
      )}

      {/* Error — only shown when there are no results to display */}
      {error && !isRunning && !hasRun && (
        <div className="flex flex-col items-center justify-center flex-1 gap-4 bg-gray-100 dark:bg-gray-900 p-8">
          <div className="bg-red-50 border border-red-200 dark:bg-red-950/30 dark:border-red-800 rounded-2xl p-6 max-w-md w-full">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-red-700 dark:text-red-300 font-medium mb-2">{error}</p>
                {error.includes("not found") && (
                  <button onClick={() => router.push("/upload")} className="text-sm text-red-400 underline">
                    ← Back to Upload
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONTENT */}
      {hasRun && detectData && (
        <div className={cn("flex flex-1 flex-col lg:flex-row", sidebarSide === 'left' && "lg:flex-row-reverse")}>
          {/* Main Image Viewer */}
          <div className="flex-1 min-w-0 bg-gray-100 dark:bg-gray-900 flex flex-col">
            {/* Controls — two boxes side by side above the carousel */}
            <div className="flex flex-col sm:flex-row gap-3 pt-3 px-4 md:px-6">

              {/* Box 1 — Sensitivity */}
              <div className="bg-white/90 backdrop-blur-sm border border-gray-200 dark:bg-gray-950/90 dark:border-gray-700 rounded-lg px-4 py-3 flex flex-col gap-2.5 flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Sensitivity</span>
                  {isRunning && <Loader2 className="w-3 h-3 animate-spin text-blue-500" />}
                </div>
                <div className="space-y-1.5">
                  {([
                    { cls: 'crack',    label: 'Crack',    dot: 'bg-red-500' },
                    { cls: 'spalling', label: 'Spalling', dot: 'bg-yellow-500' },
                    { cls: 'peeling',  label: 'Peeling',  dot: 'bg-orange-500' },
                    { cls: 'algae',    label: 'Algae',    dot: 'bg-green-500' },
                  ] as const).map(({ cls, label, dot }) => (
                    <div key={cls} className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 w-14 shrink-0">
                        <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', dot)} />
                        <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">{label}</span>
                      </div>
                      <div className="flex flex-1 gap-1">
                        {(['conservative','balanced','aggressive'] as const).map(level => {
                          const active = sensitivity[cls] === level;
                          const activeStyle: Record<string,string> = {
                            conservative: 'bg-green-50 border-green-500 text-green-700 dark:bg-green-950/40 dark:border-green-600 dark:text-green-400',
                            balanced:     'bg-green-50 border-green-500 text-green-700 dark:bg-green-950/40 dark:border-green-600 dark:text-green-400',
                            aggressive:   'bg-green-50 border-green-500 text-green-700 dark:bg-green-950/40 dark:border-green-600 dark:text-green-400',
                          };
                          return (
                            <button
                              key={level}
                              disabled={isRunning}
                              onClick={() => setSensitivity(prev => ({ ...prev, [cls]: level }))}
                              className={cn(
                                'flex-1 py-1 rounded text-[10px] font-semibold border transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed capitalize',
                                active
                                  ? activeStyle[level]
                                  : 'border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 hover:border-gray-400 dark:hover:border-gray-500',
                              )}
                            >
                              {level.slice(0, 3)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  disabled={isRunning}
                  onClick={() => runDetection(sensitivity)}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-400 dark:bg-blue-950/40 dark:hover:bg-blue-950/60 dark:text-blue-400 dark:border-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-semibold transition cursor-pointer"
                >
                  {isRunning ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                  Re-run Detection
                </button>
                {Object.values(remarks).some(v => v) && (
                  <p className="text-[10px] text-amber-600 dark:text-amber-400 text-center">
                    Re-running will clear all saved notes.
                  </p>
                )}
              </div>

              {/* Box 2 — View / Overlays / Classes / Timing (open card, no wrapper close yet) */}
              <div className="bg-white/90 backdrop-blur-sm border border-gray-200 dark:bg-gray-950/90 dark:border-gray-700 rounded-lg px-4 py-3 flex flex-col gap-3 flex-1 min-w-0">
                {/* View mode segmented control */}
                <div className="flex items-center gap-3">
                  <span className="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider shrink-0">View</span>
                  <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-full p-0.5 gap-0.5">
                    <button
                      onClick={() => setViewMode('overlay')}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer',
                        viewMode === 'overlay'
                          ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                          : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200',
                      )}
                    >
                      <Layers className="w-3.5 h-3.5" />
                      Viscrete Overlay
                    </button>
                    <button
                      onClick={() => setViewMode('yolo')}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer',
                        viewMode === 'yolo'
                          ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                          : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200',
                      )}
                    >
                      <Scan className="w-3.5 h-3.5" />
                      YOLO Plot
                    </button>
                  </div>
                </div>

                {/* Overlay toggles + class pills — only relevant in overlay mode */}
                {viewMode === 'overlay' ? (
                <>
                <div className="flex items-center flex-wrap gap-x-4 gap-y-2 border-t border-gray-100 dark:border-gray-800 pt-2.5">
                  <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 shrink-0">Overlays</span>
                  <button
                    onClick={() => setShowBoundingBoxes(!showBoundingBoxes)}
                    className="flex items-center gap-2 text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white transition-colors"
                  >
                    <div className={`w-8 h-5 rounded-full relative cursor-pointer transition-colors ${showBoundingBoxes ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
                      <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${showBoundingBoxes ? 'right-0.5' : 'left-0.5'}`} />
                    </div>
                    <Box className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setShowLabels(!showLabels)}
                    className="flex items-center gap-2 text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white transition-colors"
                  >
                    <div className={`w-8 h-5 rounded-full relative cursor-pointer transition-colors ${showLabels ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
                      <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${showLabels ? 'right-0.5' : 'left-0.5'}`} />
                    </div>
                    <Tag className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setShowColorOverlay(!showColorOverlay)}
                    className="flex items-center gap-2 text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white transition-colors"
                  >
                    <div className={`w-8 h-5 rounded-full relative cursor-pointer transition-colors ${showColorOverlay ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
                      <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${showColorOverlay ? 'right-0.5' : 'left-0.5'}`} />
                    </div>
                    <Layers className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex items-center gap-2 flex-wrap border-t border-gray-100 dark:border-gray-800 pt-2.5">
                  <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 shrink-0">Classes</span>
                  {allDefectClasses.map(cls => {
                    const active = visibleDefects.has(cls);
                    const dot: Record<string, string> = {
                      crack: 'bg-red-500', spalling: 'bg-yellow-500',
                      peeling: 'bg-orange-500', algae: 'bg-green-500',
                    };
                    return (
                      <button
                        key={cls}
                        onClick={() => toggleDefectClass(cls)}
                        className={cn(
                          'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer',
                          active
                            ? 'bg-gray-100 border-gray-400 text-gray-900 dark:bg-gray-800 dark:border-gray-500 dark:text-white'
                            : 'bg-transparent border-gray-300 text-gray-400 dark:border-gray-700 dark:text-gray-500',
                        )}
                      >
                        <span className={cn('w-1.5 h-1.5 rounded-full', dot[cls], !active && 'opacity-40')} />
                        {cls.charAt(0).toUpperCase() + cls.slice(1)}
                      </button>
                    );
                  })}
                </div>
                </>
                ) : (
                  <p className="text-xs text-gray-400 dark:text-gray-500 border-t border-gray-100 dark:border-gray-800 pt-2.5">
                    Annotations are rendered directly by YOLO. Click a row in the defect table to highlight a specific detection.
                  </p>
                )}

                {/* Pipeline timing */}
                {(preprocessDurationSec != null || detectionDurationSec != null) && (
                  <div className="flex items-center gap-2 border-t border-gray-100 dark:border-gray-800 pt-2.5 flex-wrap">
                    <Clock className="w-3 h-3 text-gray-400 dark:text-gray-500 shrink-0" />
                    {preprocessDurationSec != null && (
                      <span className="text-[10px] font-mono text-gray-500 dark:text-gray-400">
                        Pre: <span className="font-semibold text-gray-700 dark:text-gray-300">{preprocessDurationSec.toFixed(1)}s</span>
                      </span>
                    )}
                    {preprocessDurationSec != null && detectionDurationSec != null && (
                      <span className="text-gray-300 dark:text-gray-600">·</span>
                    )}
                    {detectionDurationSec != null && (
                      <span className="text-[10px] font-mono text-gray-500 dark:text-gray-400">
                        Det: <span className="font-semibold text-gray-700 dark:text-gray-300">{detectionDurationSec.toFixed(1)}s</span>
                      </span>
                    )}
                    {preprocessDurationSec != null && detectionDurationSec != null && (
                      <span className="ml-auto text-[10px] font-mono font-bold text-blue-600 dark:text-blue-400">
                        {(preprocessDurationSec + detectionDurationSec).toFixed(1)}s total
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Image Carousel */}
            <div ref={carouselRef} className="flex-1 flex flex-col pt-3 px-4 md:px-6 pb-4 md:pb-6 min-h-0">

              {/* ── Image carousel ───────────────────────────────────────────── */}
              {(
              <>
              <div className="bg-gray-200/40 border-2 border-dashed border-gray-300 dark:bg-gray-800/30 dark:border-gray-700/50 rounded-lg mb-4 p-8" style={{ height: 'clamp(280px, 50vh, 480px)' }}>
                {!currentImageSrc ? (
                  <div className="w-full h-full flex flex-col items-center justify-center">
                    <ImageIcon className="w-16 h-16 text-gray-400 dark:text-gray-600 mb-4" />
                    <p className="text-gray-500 text-lg">No image loaded</p>
                    <p className="text-gray-400 dark:text-gray-600 text-sm mt-2">Detection results will appear here</p>
                  </div>
                ) : (
                  <div className="relative w-full h-full">
                    {/* Loading spinner */}
                    {imageLoading && (
                      <div className="absolute inset-0 flex items-center justify-center z-10">
                        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                      </div>
                    )}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      ref={imageRef}
                      key={currentImageSrc}
                      src={currentImageSrc}
                      alt={`Detection Result ${currentImageIndex + 1}`}
                      decoding="async"
                      fetchPriority="high"
                      className={cn("w-full h-full object-contain transition-opacity cursor-pointer", imageLoading ? "opacity-0" : "opacity-100")}
                      onLoad={handleImageLoad}
                      onError={() => setImageLoading(false)}
                      onClick={() => !imageLoading && openImageComment()}
                    />
                    {/* Corner controls — zoom button + comment indicator */}
                    {!imageLoading && (
                      <div className="absolute top-2 right-2 flex items-center gap-1.5">
                        {/* Comment indicator */}
                        {currentFileId && remarks[`img-${currentFileId}`] && (
                          <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-black/50 text-white text-[10px] select-none pointer-events-none">
                            <MessageSquare className="w-3 h-3" />
                          </div>
                        )}
                        {/* Zoom button */}
                        <button
                          onClick={e => { e.stopPropagation(); !imageLoading && setLightboxSrc(currentImageSrc); }}
                          className="flex items-center gap-1 px-2 py-1 rounded-md bg-black/50 hover:bg-black/70 text-white text-[10px] transition cursor-pointer"
                          title="Zoom image"
                        >
                          <ZoomIn className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                    {/* Click-to-comment hint */}
                    {!imageLoading && (
                      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2 py-1 rounded-md bg-black/40 text-white text-[10px] pointer-events-none select-none opacity-60">
                        <MessageSquare className="w-3 h-3" /> Click image to add note
                      </div>
                    )}
                    {/* Overlay container — positioned at the actual rendered image rect.
                        No overflow-hidden so labels near the top edge aren't clipped. */}
                    {hasValidDimensions && !imageLoading && (
                      <div
                        ref={containerRef}
                        className="absolute pointer-events-none"
                        style={{ left: offsetX, top: offsetY, width: renderedW, height: renderedH }}
                      >
                        {getCurrentDetections().map((detection, index) => {
                          const { bounding_box, defect_type, confidence } = detection;
                          const { x1, y1, x2, y2 } = bounding_box;

                          // Clamp coords to image bounds — backend may return values
                          // slightly outside [0, original] due to model padding.
                          const cx1 = Math.max(0, Math.min(x1, origSize!.w));
                          const cy1 = Math.max(0, Math.min(y1, origSize!.h));
                          const cx2 = Math.max(0, Math.min(x2, origSize!.w));
                          const cy2 = Math.max(0, Math.min(y2, origSize!.h));

                          const left   = cx1 * scaleX;
                          const top    = cy1 * scaleY;
                          const width  = (cx2 - cx1) * scaleX;
                          const height = (cy2 - cy1) * scaleY;

                          // Place label above the box when there's room (top > 28px),
                          // otherwise below. Always anchor at the box's left edge;
                          // maxWidth clips text before it overflows the image boundary.
                          const labelAbove = top > 28;
                          const labelLeft  = Math.max(0, left);

                          const isHighlighted = !imageLoading && detection === highlightedDetection;

                          return (
                            <div key={index}>
                              {/* Bounding box */}
                              <div
                                className={cn(
                                  "absolute pointer-events-none",
                                  isHighlighted
                                    ? `border-[3px] animate-pulse ${defectBorderColor[defect_type] ?? 'border-white'} ${defectBgColor[defect_type] ?? 'bg-white/20'}`
                                    : cn(
                                        showBoundingBoxes ? `border-2 ${defectBorderColor[defect_type] ?? 'border-white'}` : '',
                                        showColorOverlay ? (defectBgColor[defect_type] ?? 'bg-white/20') : '',
                                      ),
                                )}
                                style={{ left, top, width, height }}
                              />
                              {/* Label */}
                              {showLabels && (
                                <div
                                  className={cn(
                                    "absolute pointer-events-none px-1.5 py-0.5 text-[11px] leading-tight font-semibold text-white rounded-sm whitespace-nowrap",
                                    defectLabelBg[defect_type] ?? 'bg-gray-700',
                                  )}
                                  style={{
                                    left: labelLeft,
                                    maxWidth: renderedW - labelLeft,
                                    overflow: 'hidden',
                                    ...(labelAbove
                                      ? { bottom: renderedH - top + 2 }
                                      : { top: top + height + 2 }),
                                  }}
                                >
                                  {defect_type.charAt(0).toUpperCase() + defect_type.slice(1)} {Math.round(confidence * 100)}%
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Filename label */}
              {currentAnnotatedPath && (
                <p className="text-center text-xs font-mono text-gray-500 dark:text-gray-400 mb-3 truncate">
                  {(currentFileId ? fileGpsMap[currentFileId]?.filename : undefined) ?? currentAnnotatedPath.split('/').pop()}
                </p>
              )}

              {/* Carousel Controls */}
              {totalImages > 0 && (
                <div className="flex items-center justify-center gap-4">
                  <Button
                    onClick={goToPrevious}
                    variant="outline"
                    size="lg"
                    className="cursor-pointer bg-white border-gray-300 text-gray-700 hover:bg-gray-50 hover:text-gray-900 dark:bg-gray-800 dark:border-gray-700 dark:text-white dark:hover:bg-gray-700 dark:hover:text-white"
                  >
                    <ArrowLeft className="w-5 h-5 mr-2" />
                    Previous
                  </Button>
                  <div className="px-6 py-2 bg-gray-100 rounded-lg border border-gray-200 dark:bg-gray-800/50 dark:border-gray-700">
                    <span className="text-gray-900 dark:text-white font-semibold">
                      {currentImageIndex + 1} / {totalImages}
                    </span>
                  </div>
                  <Button
                    onClick={goToNext}
                    variant="outline"
                    size="lg"
                    className="cursor-pointer bg-white border-gray-300 text-gray-700 hover:bg-gray-50 hover:text-gray-900 dark:bg-gray-800 dark:border-gray-700 dark:text-white dark:hover:bg-gray-700 dark:hover:text-white"
                  >
                    Next
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </div>
              )}

              </>
              )}

            </div>
          </div>

          {/* Sidebar — left or right based on sidebarSide */}
          <div className={cn(
            "lg:w-96 xl:w-[28rem] bg-white border-t lg:border-t-0 border-gray-200 dark:bg-gray-950 dark:border-gray-800 p-4 sm:p-5 overflow-y-auto flex flex-col gap-4",
            sidebarSide === 'left' ? "lg:border-r" : "lg:border-l"
          )}>

            {/* Header: layout toggle + metrics */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-0.5 p-0.5 bg-gray-100 dark:bg-gray-800 rounded-lg">
                <button
                  onClick={() => setSidebarSide('left')}
                  title="Dock to left"
                  className={cn(
                    'p-1.5 rounded-md transition cursor-pointer',
                    sidebarSide === 'left'
                      ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
                  )}
                >
                  <PanelLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setSidebarSide('right')}
                  title="Dock to right"
                  className={cn(
                    'p-1.5 rounded-md transition cursor-pointer',
                    sidebarSide === 'right'
                      ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
                  )}
                >
                  <PanelRight className="w-3.5 h-3.5" />
                </button>
              </div>
              {perfMetrics && (
                <button
                  onClick={() => setMetricsOpen(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold
                             border border-gray-200 dark:border-gray-800
                             text-gray-600 dark:text-gray-400
                             hover:border-blue-300 dark:hover:border-blue-700 transition cursor-pointer"
                >
                  <ExternalLink className="w-3 h-3 shrink-0" />
                  Metrics
                </button>
              )}
            </div>

            {/* Compact defect count chips */}
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  { count: totalDefectCount, label: 'total',    bg: 'bg-blue-50 dark:bg-blue-950/30',    border: 'border-blue-200 dark:border-blue-900/50',    text: 'text-blue-700 dark:text-blue-400',    show: true },
                  { count: cracksCount,      label: 'crack',    bg: 'bg-red-50 dark:bg-red-950/30',      border: 'border-red-200 dark:border-red-900/50',      text: 'text-red-700 dark:text-red-400',      show: cracksCount > 0 },
                  { count: spallingCount,    label: 'spalling', bg: 'bg-yellow-50 dark:bg-yellow-950/30', border: 'border-yellow-200 dark:border-yellow-900/50', text: 'text-yellow-700 dark:text-yellow-400', show: spallingCount > 0 },
                  { count: peelingCount,     label: 'peeling',  bg: 'bg-orange-50 dark:bg-orange-950/30', border: 'border-orange-200 dark:border-orange-900/50', text: 'text-orange-700 dark:text-orange-400', show: peelingCount > 0 },
                  { count: algaeCount,       label: 'algae',    bg: 'bg-green-50 dark:bg-green-950/30',   border: 'border-green-200 dark:border-green-900/50',   text: 'text-green-700 dark:text-green-400',  show: algaeCount > 0 },
                ]
              ).map(({ count, label, bg, border, text, show }) => show ? (
                <span key={label} className={cn('flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border', bg, border, text)}>
                  <span className="font-bold tabular-nums">{count}</span>
                  <span className="font-medium">{label}</span>
                </span>
              ) : null)}
            </div>

            {/* Defect summary with scope toggle */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Summary</span>
                <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-full p-0.5 gap-0.5">
                  <button
                    onClick={() => { setDefectSummaryScope('current'); setDefectPage(0); }}
                    className={cn(
                      'px-2.5 py-0.5 rounded-full text-[10px] font-semibold transition-all cursor-pointer',
                      defectSummaryScope === 'current'
                        ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                    )}
                  >
                    Current
                  </button>
                  <button
                    onClick={() => { setDefectSummaryScope('all'); setDefectPage(0); }}
                    className={cn(
                      'px-2.5 py-0.5 rounded-full text-[10px] font-semibold transition-all cursor-pointer',
                      defectSummaryScope === 'all'
                        ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                    )}
                  >
                    All
                  </button>
                </div>
              </div>
              <div className="space-y-1">
                {(
                  [
                    { cls: 'crack',    label: 'Crack',    count: scopedCrack,    dot: 'bg-red-500' },
                    { cls: 'spalling', label: 'Spalling', count: scopedSpalling, dot: 'bg-yellow-500' },
                    { cls: 'peeling',  label: 'Peeling',  count: scopedPeeling,  dot: 'bg-orange-500' },
                    { cls: 'algae',    label: 'Algae',    count: scopedAlgae,    dot: 'bg-green-500' },
                  ] as const
                ).map(({ cls, label, count, dot }) => (
                  <div key={cls} className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
                    <div className="flex items-center gap-2">
                      <span className={cn('w-2 h-2 rounded-full shrink-0', dot)} />
                      <span className="text-xs text-gray-700 dark:text-gray-300">{label}</span>
                    </div>
                    <span className="text-xs font-bold font-mono tabular-nums text-gray-900 dark:text-white">{count}</span>
                  </div>
                ))}
                {defectSummaryScope === 'all' && (
                  <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50">
                    <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">Total</span>
                    <span className="text-xs font-bold font-mono tabular-nums text-blue-700 dark:text-blue-300">{scopedTotal}</span>
                  </div>
                )}
              </div>
              {defectSummaryScope === 'current' && totalImages > 1 && (
                <p className="mt-2 text-[10px] text-gray-400 dark:text-gray-500 text-center">
                  Image {currentImageIndex + 1} of {totalImages}
                </p>
              )}
            </div>

            {/* Defect table — driven by Current/All toggle above */}
            {allDetections.length > 0 && (<>
              <div className="bg-white border border-gray-200 dark:bg-gray-950 dark:border-gray-800 rounded-xl overflow-hidden">
                {/* Filter pills */}
                <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-800 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Filter</span>
                    {tableVisibleDefects.size < allDefectClasses.length && (
                      <button
                        onClick={() => { setTableVisibleDefects(new Set(['crack', 'spalling', 'peeling', 'algae'])); setDefectPage(0); }}
                        className="text-[10px] text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition cursor-pointer"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {allDefectClasses.map(cls => {
                      const active = tableVisibleDefects.has(cls);
                      const dot: Record<string, string> = {
                        crack: 'bg-red-500', spalling: 'bg-yellow-500',
                        peeling: 'bg-orange-500', algae: 'bg-green-500',
                      };
                      return (
                        <button
                          key={cls}
                          onClick={() => toggleTableDefectClass(cls)}
                          className={cn(
                            'flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border transition-all cursor-pointer',
                            active
                              ? 'bg-gray-100 border-gray-400 text-gray-900 dark:bg-gray-800 dark:border-gray-500 dark:text-white'
                              : 'bg-transparent border-gray-300 text-gray-400 dark:border-gray-700 dark:text-gray-500',
                          )}
                        >
                          <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', dot[cls], !active && 'opacity-40')} />
                          {cls.charAt(0).toUpperCase() + cls.slice(1)}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-800">
                        <th className="text-left px-2.5 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Type</th>
                        <th className="text-left px-2.5 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Conf</th>
                        <th className="text-left px-2.5 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                          <span className="flex items-center gap-1">
                            Note
                            {remarkSaving && <Loader2 className="w-2.5 h-2.5 animate-spin text-blue-500" />}
                            {!remarkSaving && remarkSaved && <Check className="w-2.5 h-2.5 text-emerald-500" />}
                          </span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {tableFilteredDetections.slice(defectPage * DEFECT_PAGE_SIZE, (defectPage + 1) * DEFECT_PAGE_SIZE).map((d, i) => {
                        const i_global = defectPage * DEFECT_PAGE_SIZE + i;
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const defId: string = (d as any).def_id ?? `DEF-${String(i_global + 1).padStart(3, '0')}`;
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const det = d as any;
                        const fileCount = Object.keys(fileIdToCarouselIndex).length;
                        const isSingleFile = fileCount <= 1;
                        const fileId = det.file_id ?? (isSingleFile ? flatData?.file_id : undefined);
                        const carouselIndex = isSingleFile
                          ? 0
                          : (fileId !== undefined ? (fileIdToCarouselIndex[fileId] ?? -1) : -1);
                        const isClickable = carouselIndex >= 0;
                        return (
                          <tr
                            key={i_global}
                            className={cn(
                              "border-b border-gray-100 dark:border-gray-800/50 transition",
                              isClickable
                                ? "hover:bg-blue-50 dark:hover:bg-blue-950/20 cursor-pointer"
                                : "hover:bg-gray-50 dark:hover:bg-gray-900/50"
                            )}
                            onClick={() => {
                              if (!isClickable) return;
                              setCurrentImageIndex(carouselIndex);
                              highlightDetection(d);
                              setTimeout(() => {
                                carouselRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                              }, 50);
                            }}
                          >
                            <td className="px-2.5 py-2 text-xs font-medium text-gray-800 dark:text-gray-200 capitalize whitespace-nowrap">{d.defect_type}</td>
                            <td className="px-2.5 py-2 text-xs text-gray-600 dark:text-gray-300 whitespace-nowrap">{Math.round(d.confidence * 100)}%</td>
                            <td className="px-2 py-1.5" onClick={e => e.stopPropagation()}>
                              <textarea
                                value={remarks[defId] ?? ''}
                                onChange={e => handleRemarkChange(defId, e.target.value)}
                                placeholder="Note…"
                                rows={1}
                                className="w-full px-2 py-1 rounded text-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 placeholder-gray-300 dark:placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-transparent transition resize-none"
                                style={{ minWidth: '80px' }}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {/* Pagination */}
                {tableFilteredDetections.length > DEFECT_PAGE_SIZE && (
                  <div className="flex items-center justify-between px-3 py-2 border-t border-gray-100 dark:border-gray-800">
                    <span className="text-[10px] text-gray-400 dark:text-gray-500">
                      {defectPage * DEFECT_PAGE_SIZE + 1}–{Math.min((defectPage + 1) * DEFECT_PAGE_SIZE, tableFilteredDetections.length)} of {tableFilteredDetections.length}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setDefectPage(p => Math.max(0, p - 1))}
                        disabled={defectPage === 0}
                        className="px-2 py-0.5 rounded text-[10px] font-medium transition text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                      >
                        ‹
                      </button>
                      <span className="px-1.5 text-[10px] text-gray-400 dark:text-gray-500">
                        {defectPage + 1}/{Math.ceil(tableFilteredDetections.length / DEFECT_PAGE_SIZE)}
                      </span>
                      <button
                        onClick={() => setDefectPage(p => Math.min(Math.ceil(tableFilteredDetections.length / DEFECT_PAGE_SIZE) - 1, p + 1))}
                        disabled={defectPage >= Math.ceil(tableFilteredDetections.length / DEFECT_PAGE_SIZE) - 1}
                        className="px-2 py-0.5 rounded text-[10px] font-medium transition text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                      >
                        ›
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Generate / Download Report */}
              <div className="flex items-center gap-1.5 pt-1">
                <button
                  onClick={reportGenerated ? handleDownloadPdf : needsRegenerate ? handleRegenerateReport : handleGenerateReport}
                  disabled={isGenerating || isDownloading}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold
                             bg-yellow-50 hover:bg-yellow-100 text-yellow-700 border border-yellow-400 dark:bg-yellow-950/40 dark:hover:bg-yellow-950/60 dark:text-yellow-400 dark:border-yellow-600 transition
                             disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {(isGenerating || isDownloading) ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                  ) : reportGenerated ? (
                    <Download className="w-3.5 h-3.5 shrink-0" />
                  ) : (
                    <FileText className="w-3.5 h-3.5 shrink-0" />
                  )}
                  {isGenerating ? 'Generating…' : isDownloading ? 'Downloading…' : reportGenerated ? 'Download PDF' : needsRegenerate ? 'Regenerate Report' : 'Generate Report'}
                </button>
                {/* More export options dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center px-2 py-2 rounded-lg text-xs
                                       border border-gray-200 dark:border-gray-700
                                       bg-white dark:bg-gray-900
                                       text-gray-600 dark:text-gray-400
                                       hover:bg-gray-50 dark:hover:bg-gray-800 transition cursor-pointer">
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 bg-white border-gray-200 dark:bg-gray-900 dark:border-gray-700">
                    <DropdownMenuLabel className="text-xs text-gray-400 dark:text-gray-500">PDF</DropdownMenuLabel>
                    <DropdownMenuItem
                      className="text-gray-800 hover:bg-gray-100 dark:text-white dark:hover:bg-gray-800 cursor-pointer"
                      onClick={reportGenerated ? handleDownloadPdf : needsRegenerate ? handleRegenerateReport : handleGenerateReport}
                    >
                      <FileText className="w-4 h-4 mr-2 shrink-0" />
                      <div>
                        <div className="font-semibold">{reportGenerated ? 'Download PDF Report' : needsRegenerate ? 'Regenerate PDF Report' : 'Generate PDF Report'}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{reportGenerated ? 'Annotated images & summary' : needsRegenerate ? 'PDF was missing — regenerate it' : 'Create the inspection PDF'}</div>
                      </div>
                    </DropdownMenuItem>
                    {reportGenerated && (
                      <DropdownMenuItem
                        className="text-gray-800 hover:bg-gray-100 dark:text-white dark:hover:bg-gray-800 cursor-pointer"
                        onClick={handleViewPdf}
                      >
                        <ExternalLink className="w-4 h-4 mr-2 shrink-0" />
                        <div>
                          <div className="font-semibold">View PDF Report</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">Open in report viewer</div>
                        </div>
                      </DropdownMenuItem>
                    )}
                    {reportGenerated && (
                      <DropdownMenuItem
                        className="text-gray-800 hover:bg-gray-100 dark:text-white dark:hover:bg-gray-800 cursor-pointer"
                        onClick={handleRegenerateReport}
                        disabled={isGenerating}
                      >
                        <RefreshCw className="w-4 h-4 mr-2 shrink-0" />
                        <div>
                          <div className="font-semibold">Regenerate PDF</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">Re-create with updated notes</div>
                        </div>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator className="bg-gray-100 dark:bg-gray-800" />
                    <DropdownMenuLabel className="text-xs text-gray-400 dark:text-gray-500">CSV</DropdownMenuLabel>
                    <DropdownMenuItem
                      className="text-gray-800 hover:bg-gray-100 dark:text-white dark:hover:bg-gray-800 cursor-pointer"
                      onClick={handleDownloadCsv}
                    >
                      <Table2 className="w-4 h-4 mr-2 shrink-0" />
                      <div>
                        <div className="font-semibold">{csvGenerated ? 'Download CSV Report' : 'Generate CSV Report'}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Defect data as spreadsheet</div>
                      </div>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-gray-100 dark:bg-gray-800" />
                    <DropdownMenuLabel className="text-xs text-gray-400 dark:text-gray-500">Images</DropdownMenuLabel>
                    <DropdownMenuItem
                      className="text-gray-800 hover:bg-gray-100 dark:text-white dark:hover:bg-gray-800 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={handleDownloadAnnotatedZip}
                      disabled={!annotatedPaths.length || isZipDownloading}
                    >
                      {isZipDownloading ? (
                        <Loader2 className="w-4 h-4 mr-2 shrink-0 animate-spin" />
                      ) : (
                        <Archive className="w-4 h-4 mr-2 shrink-0" />
                      )}
                      <div>
                        <div className="font-semibold">Download Annotated Images</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">All annotated images as .zip</div>
                      </div>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </>)}

            {/* Remarks changed warning */}
            {remarksChangedAfterReport && (
              <div className="flex items-center gap-2 p-2.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg text-xs text-amber-700 dark:text-amber-400">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span className="flex-1">Notes updated after report was generated.</span>
                <button
                  onClick={handleRegenerateReport}
                  disabled={isGenerating}
                  className="underline hover:no-underline shrink-0 cursor-pointer disabled:opacity-50"
                >
                  Regenerate
                </button>
              </div>
            )}

            {/* Report error */}
            {reportError && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 dark:bg-red-950/30 dark:border-red-800 rounded-xl text-xs text-red-600 dark:text-red-400">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {reportError}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Performance Metrics Modal */}
      {metricsOpen && perfMetrics && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setMetricsOpen(false)}
        >
          <div
            className="w-full max-w-sm bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
              <h2 className="text-sm font-bold text-gray-900 dark:text-white tracking-wide">
                System Performance
              </h2>
              <button
                onClick={() => setMetricsOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Metrics rows */}
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {[
                { label: "Files Processed", value: String(perfMetrics.file_count) },
                { label: "Total Time",       value: `${perfMetrics.total_duration_sec.toFixed(2)}s` },
                { label: "Avg per File",     value: `${perfMetrics.avg_duration_per_file_sec.toFixed(2)}s` },
                { label: "Job Size",         value: `${perfMetrics.job_size_mb.toFixed(1)} MB` },
                { label: "Avg CPU",          value: `${perfMetrics.avg_cpu_percent.toFixed(1)}%` },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between px-6 py-3">
                  <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
                  <span className="text-xs font-mono font-semibold text-gray-900 dark:text-white tabular-nums">
                    {value}
                  </span>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800">
              <button
                onClick={() => setMetricsOpen(false)}
                className="w-full py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-sm font-semibold
                           text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700
                           transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image comment modal */}
      {commentModalOpen && currentFileId && (
        <div
          className="fixed inset-0 z-[55] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setCommentModalOpen(false)}
        >
          <div
            className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-md mx-4 flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-blue-500 shrink-0" />
                <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">Image Note</span>
                {fileGpsMap[currentFileId]?.filename && (
                  <span className="text-xs text-gray-400 dark:text-gray-500 font-mono truncate max-w-[160px]">
                    {fileGpsMap[currentFileId].filename}
                  </span>
                )}
              </div>
              <button
                onClick={() => setCommentModalOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Defect selector */}
            {currentFileDetections.length > 0 && (
              <div className="px-4 pt-3 pb-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">Mention a defect (optional)</p>
                <div className="flex flex-wrap gap-1.5">
                  {currentFileDetections.map((d, i) => {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const defId: string = (d as any).def_id ?? `DEF-${String(i + 1).padStart(3, '0')}`;
                    const dot: Record<string, string> = {
                      crack: 'bg-red-500', spalling: 'bg-yellow-500',
                      peeling: 'bg-orange-500', algae: 'bg-green-500',
                    };
                    const active = commentSelectedDefect === defId;
                    return (
                      <button
                        key={defId}
                        onClick={() => handleCommentDefectSelect(defId)}
                        className={cn(
                          'flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border transition cursor-pointer',
                          active
                            ? 'bg-blue-50 border-blue-400 text-blue-700 dark:bg-blue-950/40 dark:border-blue-500 dark:text-blue-300'
                            : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-500',
                        )}
                      >
                        <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', dot[d.defect_type])} />
                        [{defId}] {d.defect_type} {Math.round(d.confidence * 100)}%
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Textarea */}
            <div className="px-4 pt-3 pb-4">
              <textarea
                ref={commentTextareaRef}
                value={commentDraft}
                onChange={e => setCommentDraft(e.target.value)}
                placeholder={currentFileDetections.length > 0 ? "Select a defect above to mention it, or write a general note…" : "Write a note about this image…"}
                rows={4}
                className="w-full px-3 py-2 rounded-lg text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-800 dark:text-gray-200 placeholder-gray-300 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition resize-none"
              />
              <div className="flex items-center justify-end gap-2 mt-2">
                <button
                  onClick={() => setCommentModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={saveImageComment}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition cursor-pointer"
                >
                  Save Note
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightboxSrc && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-sm"
          onClick={() => setLightboxSrc(null)}
        >
          <button
            onClick={() => setLightboxSrc(null)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxSrc}
            alt="Zoomed detection result"
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
