'use client';

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  detectJob,
  generateReport,
  type DetectResponse,
  type Detection,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  AlertCircle,
  Download,
  Grid3x3,
  ChevronDown,
  Box,
  Tag,
  Layers,
  ImageIcon,
  FileText,
} from "lucide-react";
import SettingsIcon from '@mui/icons-material/Settings';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';

// ─── Types / Helpers ──────────────────────────────────────────────────────────

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "https://viscrete-core.shares.zrok.io";

type Severity = "Low" | "Medium" | "High";

const REDIRECT_STATUSES = new Set(["detected", "reporting", "completed"]);

function severityBadge(s: Severity | undefined) {
  if (!s) return null;
  const cls = {
    Low: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    Medium: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    High: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  }[s];
  return (
    <span className={cn("px-2 py-0.5 rounded-full text-[11px] font-bold", cls)}>{s}</span>
  );
}

const defectBorderColor: Record<string, string> = {
  cracks: 'border-red-500',
  spalling: 'border-yellow-500',
  peeling: 'border-orange-500',
  algae: 'border-green-500',
  staining: 'border-purple-500',
};

const defectBgColor: Record<string, string> = {
  cracks: 'bg-red-500/20',
  spalling: 'bg-yellow-500/20',
  peeling: 'bg-orange-500/20',
  algae: 'bg-green-500/20',
  staining: 'bg-purple-500/20',
};

const defectLabelBg: Record<string, string> = {
  cracks: 'bg-red-500',
  spalling: 'bg-yellow-500',
  peeling: 'bg-orange-500',
  algae: 'bg-green-500',
  staining: 'bg-purple-500',
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ResultPage() {
  const params = useParams();
  const jobId = params.job_id as string;
  const router = useRouter();

  // Detection state
  const [isRunning, setIsRunning] = useState(false);
  const [hasRun, setHasRun] = useState(false);
  const [detectData, setDetectData] = useState<DetectResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsDetection, setNeedsDetection] = useState(false);

  // Report state
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportGenerated, setReportGenerated] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  // The actual API response is flat (api.ts types are outdated):
  // { job_id, file_id, total_defects, detections[], annotated_paths[] }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const flatData = detectData as any;
  const flatDetections: Detection[] = flatData?.detections ?? [];

  // Derived counts — use flat detections since total_defect_counts may not exist
  const totalDefectCount: number = flatData?.total_defects ?? flatData?.total_defect_count ?? 0;
  const cracksCount   = flatDetections.filter(d => d.defect_type === 'cracks').length;
  const spallingCount = flatDetections.filter(d => d.defect_type === 'spalling').length;
  const peelingCount  = flatDetections.filter(d => d.defect_type === 'peeling').length;
  const algaeCount    = flatDetections.filter(d => d.defect_type === 'algae').length;
  const stainCount    = flatDetections.filter(d => d.defect_type === 'staining').length;

  // Image carousel state
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0, naturalWidth: 0, naturalHeight: 0 });

  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Overlay toggles
  const [showBoundingBoxes, setShowBoundingBoxes] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [showColorOverlay, setShowColorOverlay] = useState(false);

  // Per-class visibility
  const allDefectClasses = ['cracks', 'spalling', 'peeling', 'algae', 'staining'] as const;
  type DefectClass = typeof allDefectClasses[number];
  const [visibleDefects, setVisibleDefects] = useState<Set<DefectClass>>(new Set(allDefectClasses));
  const toggleDefectClass = (cls: DefectClass) =>
    setVisibleDefects(prev => {
      const next = new Set(prev);
      next.has(cls) ? next.delete(cls) : next.add(cls);
      return next;
    });

  // Project info from job status
  const [projectName, setProjectName] = useState("—");
  const [modelName] = useState("YOLOv11-STRUCTURAL.pt");
  const [projectDate, setProjectDate] = useState("—");

  // ── Init: check job status, then run detection ──────────────────────────────

  useEffect(() => {
    async function init() {
      try {
        const res = await fetch(`${API_BASE_URL}/api/v1/jobs/${encodeURIComponent(jobId)}`);
        if (res.ok) {
          const job = await res.json();
          if (job.site_name) setProjectName(job.site_name);
          if (job.created_at) {
            setProjectDate(new Date(job.created_at).toLocaleString("en-PH", {
              month: "long", day: "numeric", year: "numeric",
              hour: "numeric", minute: "2-digit",
            }));
          }
          if (REDIRECT_STATUSES.has(job.status)) {
            // Already detected — fetch cached results directly
            await fetchCachedResults();
            if (job.status === "completed") {
              setReportGenerated(true);
            }
            return;
          }
          if (job.status === "preprocessed") {
            setNeedsDetection(true);
            return;
          }
        }
      } catch {
        // Fall through and attempt detection
      }
      runDetection();
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
      setHasRun(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load detection results");
    } finally {
      setIsRunning(false);
    }
  }

  async function runDetection() {
    setIsRunning(true);
    setHasRun(false);
    setError(null);
    try {
      const data = await detectJob(jobId);
      setDetectData(data);
      setHasRun(true);
    } catch (e: unknown) {
      if (e instanceof Error && e.message.includes("404")) {
        setError("Job not found.");
      } else {
        setError(e instanceof Error ? e.message : "Detection failed");
      }
    } finally {
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

  async function handleDownloadPdf() {
    setIsDownloading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/jobs/${encodeURIComponent(jobId)}/report/pdf`);
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
    window.open(`${API_BASE_URL}/api/v1/jobs/${encodeURIComponent(jobId)}/report/pdf`, "_blank");
  }

  // ── Image carousel ──────────────────────────────────────────────────────────

  // annotated_paths is the authoritative list of images from the flat API response
  const annotatedPaths: string[] = flatData?.annotated_paths ?? [];
  const totalImages = annotatedPaths.length;

  const goToPrevious = () => setCurrentImageIndex(prev => (prev === 0 ? totalImages - 1 : prev - 1));
  const goToNext = () => setCurrentImageIndex(prev => (prev === totalImages - 1 ? 0 : prev + 1));

  const handleImageLoad = () => {
    const image = imageRef.current;
    if (!image) return;
    setImageDimensions({
      width: image.width,
      height: image.height,
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
    });
  };

  // Derive processed image path from annotated path:
  // e.g. "uuid/annotated/file_annotated.jpg" → "uuid/processed/file.jpg"
  const currentAnnotatedPath = annotatedPaths[currentImageIndex];
  const currentImageSrc = currentAnnotatedPath
    ? `${API_BASE_URL}/static/${currentAnnotatedPath
        .replace('/annotated/', '/processed/')
        .replace(/_annotated(\.[^.]+)$/, '$1')}`
    : null;

  // Reset dimensions when the displayed image changes so stale overlays don't show
  useEffect(() => {
    setImageDimensions({ width: 0, height: 0, naturalWidth: 0, naturalHeight: 0 });
  }, [currentImageSrc]);

  useEffect(() => {
    const updateDimensions = () => {
      const image = imageRef.current;
      if (!image) return;
      setImageDimensions({
        width: image.width,
        height: image.height,
        naturalWidth: image.naturalWidth,
        naturalHeight: image.naturalHeight,
      });
    };
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  // API is flat — all detections belong to the job, not per-image
  // Filter by per-class visibility toggle
  const getCurrentDetections = (): Detection[] =>
    flatDetections.filter(d => visibleDefects.has(d.defect_type as DefectClass));

  // ── Compute actual rendered image rect inside the object-contain box ─────────
  // With object-contain, the img CSS box may be larger than the rendered content.
  // We need the rendered rect to position overlays correctly.
  const { width: cssW, height: cssH, naturalWidth, naturalHeight } = imageDimensions;
  const hasValidDimensions = cssW > 0 && cssH > 0 && naturalWidth > 0 && naturalHeight > 0;
  const naturalAspect = hasValidDimensions ? naturalWidth / naturalHeight : 1;
  const cssAspect = hasValidDimensions ? cssW / cssH : 1;
  const renderedW = hasValidDimensions
    ? (naturalAspect > cssAspect ? cssW : cssH * naturalAspect)
    : 0;
  const renderedH = hasValidDimensions
    ? (naturalAspect > cssAspect ? cssW / naturalAspect : cssH)
    : 0;
  const offsetX = (cssW - renderedW) / 2;
  const offsetY = (cssH - renderedH) / 2;
  const scaleX = renderedW > 0 ? renderedW / naturalWidth : 0;
  const scaleY = renderedH > 0 ? renderedH / naturalHeight : 0;

  // ── All detections (flat) for the defect table ──────────────────────────────
  const allDetections: Detection[] = flatDetections;

  // ── Severity counts ─────────────────────────────────────────────────────────
  const lowCount = allDetections.filter(d => d.severity === "Low").length;
  const midCount = allDetections.filter(d => d.severity === "Medium").length;
  const highCount = allDetections.filter(d => d.severity === "High").length;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col min-h-screen overflow-hidden">
      {/* HEADER */}
      <header className="bg-black dark:bg-black border-b border-gray-800">
        <div className="container mx-4 px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              className="text-white hover:text-gray-300 transition-colors cursor-pointer"
              onClick={() => router.back()}
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-white">DETECTION RESULTS</h1>
              <p className="text-sm text-gray-400">
                {projectName !== "—" ? `Detection Results for ${projectName}` : `Job: ${jobId}`}
              </p>
            </div>
          </div>
          <div className="flex flex-row gap-4 items-center justify-end">
            <h3 className="p-2 text-gray-400">
              <span className="flex items-center gap-1">
                <SettingsIcon fontSize="small" />
                {modelName}
              </span>
            </h3>
            <h3 className="p-2 text-gray-400">
              <span className="flex items-center gap-1">
                <CalendarMonthIcon fontSize="small" />
                {projectDate}
              </span>
            </h3>
          </div>
        </div>
      </header>

      {/* Loading */}
      {isRunning && (
        <div className="flex flex-col items-center justify-center flex-1 gap-4 text-gray-400 bg-gray-900">
          <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
          <p className="font-medium text-white">Running YOLOv11 inference…</p>
          <p className="text-sm">This may take a moment</p>
        </div>
      )}

      {/* Error */}
      {error && !isRunning && (
        <div className="flex flex-col items-center justify-center flex-1 gap-4 bg-gray-900 p-8">
          <div className="bg-red-950/30 border border-red-800 rounded-2xl p-6 max-w-md w-full">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-red-300 font-medium mb-2">{error}</p>
                {error.includes("not found") && (
                  <button onClick={() => router.push("/upload")} className="text-sm text-red-400 underline">
                    ← Back to Upload
                  </button>
                )}
                {!error.includes("not found") && (
                  <button onClick={runDetection} className="text-sm text-red-400 underline">
                    Retry Detection
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Needs Detection */}
      {needsDetection && !isRunning && !hasRun && (
        <div className="flex flex-col items-center justify-center flex-1 gap-6 bg-gray-900 p-8">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-8 max-w-md w-full text-center">
            <FileText className="w-10 h-10 text-blue-400 mx-auto mb-4" />
            <h2 className="text-white font-semibold text-lg mb-2">Ready for Detection</h2>
            <p className="text-gray-400 text-sm mb-6">
              Images have been preprocessed. Run the detection process to identify concrete defects.
            </p>
            <button
              onClick={() => { setNeedsDetection(false); runDetection(); }}
              className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold transition mx-auto"
            >
              Run Detection
            </button>
          </div>
        </div>
      )}

      {/* CONTENT */}
      {hasRun && detectData && (
        <div className="flex flex-1">
          {/* Main Image Viewer */}
          <div className="flex-1 bg-gray-900 flex flex-col">
            {/* Overlay Controls */}
            <div className="flex justify-center pt-6 px-8">
              <div className="bg-gray-950/90 backdrop-blur-sm border border-gray-700 rounded-lg px-6 py-3 flex flex-col gap-3">
                {/* Row 1 — overlay type toggles */}
                <div className="flex items-center gap-6">
                  <span className="text-gray-400 text-sm uppercase tracking-wider">Overlays</span>

                  {/* Bounding Boxes Toggle */}
                  <button
                    onClick={() => setShowBoundingBoxes(!showBoundingBoxes)}
                    className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors"
                  >
                    <div className={`w-10 h-6 rounded-full relative cursor-pointer transition-colors ${showBoundingBoxes ? 'bg-blue-500' : 'bg-gray-600'}`}>
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${showBoundingBoxes ? 'right-1' : 'left-1'}`} />
                    </div>
                    <Box className="w-5 h-5" />
                  </button>

                  {/* Labels Toggle */}
                  <button
                    onClick={() => setShowLabels(!showLabels)}
                    className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors"
                  >
                    <div className={`w-10 h-6 rounded-full relative cursor-pointer transition-colors ${showLabels ? 'bg-blue-500' : 'bg-gray-600'}`}>
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${showLabels ? 'right-1' : 'left-1'}`} />
                    </div>
                    <Tag className="w-5 h-5" />
                  </button>

                  {/* Heatmap Toggle */}
                  <button
                    onClick={() => setShowColorOverlay(!showColorOverlay)}
                    className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors"
                  >
                    <div className={`w-10 h-6 rounded-full relative cursor-pointer transition-colors ${showColorOverlay ? 'bg-blue-500' : 'bg-gray-600'}`}>
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${showColorOverlay ? 'right-1' : 'left-1'}`} />
                    </div>
                    <Layers className="w-5 h-5" />
                  </button>
                </div>

                {/* Row 2 — per-class toggles */}
                <div className="flex items-center gap-2 border-t border-gray-700 pt-3">
                  <span className="text-gray-500 text-xs uppercase tracking-wider mr-2">Classes</span>
                  {allDefectClasses.map(cls => {
                    const active = visibleDefects.has(cls);
                    const dot: Record<string, string> = {
                      cracks: 'bg-red-500', spalling: 'bg-yellow-500',
                      peeling: 'bg-orange-500', algae: 'bg-green-500', staining: 'bg-purple-500',
                    };
                    return (
                      <button
                        key={cls}
                        onClick={() => toggleDefectClass(cls)}
                        className={cn(
                          'flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer',
                          active
                            ? 'bg-gray-800 border-gray-500 text-white'
                            : 'bg-transparent border-gray-700 text-gray-500',
                        )}
                      >
                        <span className={cn('w-2 h-2 rounded-full', dot[cls], !active && 'opacity-40')} />
                        {cls.charAt(0).toUpperCase() + cls.slice(1)}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Image Carousel */}
            <div className="flex-1 flex flex-col p-8 min-h-0">
              <div className="bg-gray-800/30 border-2 border-dashed border-gray-700/50 rounded-lg mb-4 p-8" style={{ height: '480px' }}>
                {!currentImageSrc ? (
                  <div className="w-full h-full flex flex-col items-center justify-center">
                    <ImageIcon className="w-16 h-16 text-gray-600 mb-4" />
                    <p className="text-gray-500 text-lg">No image loaded</p>
                    <p className="text-gray-600 text-sm mt-2">Detection results will appear here</p>
                  </div>
                ) : (
                  <div className="relative w-full h-full overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      ref={imageRef}
                      key={currentImageSrc}
                      src={currentImageSrc}
                      alt={`Detection Result ${currentImageIndex + 1}`}
                      className="w-full h-full object-contain"
                      onLoad={handleImageLoad}
                    />
                    {/* Overlay container — positioned at the actual rendered image rect */}
                    {hasValidDimensions && (
                      <div
                        ref={containerRef}
                        className="absolute overflow-hidden pointer-events-none"
                        style={{ left: offsetX, top: offsetY, width: renderedW, height: renderedH }}
                      >
                        {getCurrentDetections().map((detection, index) => {
                          const { bounding_box, defect_type, confidence } = detection;
                          const { x1, y1, x2, y2 } = bounding_box;

                          const left = x1 * scaleX;
                          const top = y1 * scaleY;
                          const width = (x2 - x1) * scaleX;
                          const height = (y2 - y1) * scaleY;
                          const labelAbove = top > 30;

                          return (
                            <div key={index}>
                              <div
                                className={cn(
                                  "absolute pointer-events-none",
                                  showBoundingBoxes ? `border-2 ${defectBorderColor[defect_type] ?? 'border-white'}` : '',
                                  showColorOverlay ? (defectBgColor[defect_type] ?? 'bg-white/20') : '',
                                )}
                                style={{ left, top, width, height }}
                              />
                              {showLabels && (
                                <div
                                  className={cn(
                                    "absolute pointer-events-none px-2 py-1 text-xs text-white whitespace-nowrap",
                                    defectLabelBg[defect_type] ?? 'bg-white',
                                  )}
                                  style={{
                                    left,
                                    [labelAbove ? 'bottom' : 'top']: labelAbove
                                      ? renderedH - top + 4
                                      : top + height + 4,
                                  }}
                                >
                                  {defect_type.charAt(0).toUpperCase() + defect_type.slice(1)} • {Math.round(confidence * 100)}%
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

              {/* Carousel Controls */}
              {totalImages > 0 && (
                <div className="flex items-center justify-center gap-4">
                  <Button
                    onClick={goToPrevious}
                    variant="outline"
                    size="lg"
                    className="cursor-pointer bg-gray-800 border-gray-700 text-white hover:bg-gray-700 hover:text-white"
                  >
                    <ArrowLeft className="w-5 h-5 mr-2" />
                    Previous
                  </Button>
                  <div className="px-6 py-2 bg-gray-800/50 rounded-lg border border-gray-700">
                    <span className="text-white font-semibold">
                      {currentImageIndex + 1} / {totalImages}
                    </span>
                  </div>
                  <Button
                    onClick={goToNext}
                    variant="outline"
                    size="lg"
                    className="cursor-pointer bg-gray-800 border-gray-700 text-white hover:bg-gray-700 hover:text-white"
                  >
                    Next
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </div>
              )}

              {/* Defect Table */}
              {allDetections.length > 0 && (
                <div className="w-full mt-auto pt-10">
                  <div className="flex items-center gap-4 mb-3">
                    <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Defect Summary</h2>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium text-gray-300">{totalDefectCount} defect{totalDefectCount !== 1 ? "s" : ""} detected</span>
                      <span className="text-gray-600">•</span>
                      <span className="text-emerald-400 font-medium">{lowCount} Low</span>
                      <span className="text-gray-600">•</span>
                      <span className="text-amber-400 font-medium">{midCount} Medium</span>
                      <span className="text-gray-600">•</span>
                      <span className="text-red-400 font-medium">{highCount} High</span>
                    </div>
                  </div>
                  <div className="bg-gray-950 rounded-2xl border border-gray-800 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-800">
                            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Defect Type</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Confidence</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Severity</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Crack Width</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Area</th>
                          </tr>
                        </thead>
                        <tbody>
                          {allDetections.map((d, i) => (
                            <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-900/50 transition">
                              <td className="px-4 py-3 font-medium text-gray-200 capitalize">{d.defect_type}</td>
                              <td className="px-4 py-3 text-gray-300">{Math.round(d.confidence * 100)}%</td>
                              <td className="px-4 py-3">{severityBadge(d.severity)}</td>
                              <td className="px-4 py-3 text-gray-400">{d.crack_width_mm != null ? `${d.crack_width_mm.toFixed(1)} mm` : "—"}</td>
                              <td className="px-4 py-3 text-gray-400">{d.area_px != null ? `${d.area_px.toLocaleString()} px²` : "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Sidebar */}
          <div className="w-96 bg-gray-950 border-l border-gray-800 p-6 overflow-y-auto">
            {/* Defect Type Cards Grid */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="bg-blue-950/30 border border-blue-900/50 rounded-lg p-4">
                <div className="text-blue-400 text-3xl font-bold mb-1">{totalDefectCount}</div>
                <div className="text-blue-300 text-sm">Total Defects</div>
              </div>
              <div className="bg-red-950/30 border border-red-900/50 rounded-lg p-4">
                <div className="text-red-400 text-3xl font-bold mb-1">{cracksCount}</div>
                <div className="text-red-300 text-sm">Cracks</div>
              </div>
              <div className="bg-yellow-950/30 border border-yellow-900/50 rounded-lg p-4">
                <div className="text-yellow-400 text-3xl font-bold mb-1">{spallingCount}</div>
                <div className="text-yellow-300 text-sm">Spalling</div>
              </div>
              <div className="bg-orange-950/30 border border-orange-900/50 rounded-lg p-4">
                <div className="text-orange-400 text-3xl font-bold mb-1">{peelingCount}</div>
                <div className="text-orange-300 text-sm">Peeling</div>
              </div>
              <div className="bg-green-950/30 border border-green-900/50 rounded-lg p-4">
                <div className="text-green-400 text-3xl font-bold mb-1">{algaeCount}</div>
                <div className="text-green-300 text-sm">Algae</div>
              </div>
              <div className="bg-purple-950/30 border border-purple-900/50 rounded-lg p-4">
                <div className="text-purple-400 text-3xl font-bold mb-1">{stainCount}</div>
                <div className="text-purple-300 text-sm">Stain</div>
              </div>
            </div>

            <div className="w-full h-px bg-gray-800 mb-6" />

            {/* Severity breakdown */}
            <div className="mb-6">
              <div className="text-xs text-gray-400 uppercase mb-3 tracking-wider">Severity Breakdown</div>
              <div className="space-y-3">
                {([
                  { label: "Low",    count: lowCount,  bar: "bg-emerald-500", text: "text-emerald-400", track: "bg-emerald-950/50" },
                  { label: "Medium", count: midCount,  bar: "bg-amber-500",   text: "text-amber-400",   track: "bg-amber-950/50"   },
                  { label: "High",   count: highCount, bar: "bg-red-500",     text: "text-red-400",     track: "bg-red-950/50"     },
                ] as const).map(({ label, count, bar, text, track }) => {
                  const pct = totalDefectCount > 0 ? Math.round((count / totalDefectCount) * 100) : 0;
                  return (
                    <div key={label}>
                      <div className="flex items-center justify-between mb-1">
                        <span className={cn("text-sm font-medium", text)}>{label}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">{pct}%</span>
                          <span className={cn("px-2 py-0.5 rounded-full text-xs font-bold text-white", bar)}>{count}</span>
                        </div>
                      </div>
                      <div className={cn("w-full h-2 rounded-full overflow-hidden", track)}>
                        <div
                          className={cn("h-full rounded-full transition-all duration-500", bar)}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="w-full h-px bg-gray-800 mb-6" />

            {/* Report error */}
            {reportError && (
              <div className="flex items-center gap-2 p-3 bg-red-950/30 border border-red-800 rounded-xl text-sm text-red-400 mb-4">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {reportError}
              </div>
            )}

            {/* Export */}
            <div>
              <div className="text-xs text-gray-400 uppercase mb-4 tracking-wider">Export Report</div>

              {!reportGenerated ? (
                <Button
                  className="cursor-pointer w-full bg-[#ffcc00] hover:bg-[#ffdd57] text-black font-semibold mb-3"
                  onClick={handleGenerateReport}
                  disabled={isGenerating}
                >
                  {isGenerating ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating…</>
                  ) : (
                    <><FileText className="w-4 h-4 mr-2" /> Generate Report</>
                  )}
                </Button>
              ) : (
                <>
                  <Button
                    className="cursor-pointer w-full bg-[#ffcc00] hover:bg-[#ffdd57] text-black font-semibold mb-3"
                    onClick={handleDownloadPdf}
                    disabled={isDownloading}
                  >
                    {isDownloading ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Downloading…</>
                    ) : (
                      <><Download className="w-4 h-4 mr-2" /> Download PDF Report</>
                    )}
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="w-full cursor-pointer bg-black border-2 border-yellow-500 text-yellow-500 hover:bg-[#221f0c] hover:text-yellow-500">
                        <Grid3x3 className="w-4 h-4 mr-2" />
                        More Export Options
                        <ChevronDown className="w-4 h-4 ml-auto" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 bg-gray-900 border-gray-700">
                      <DropdownMenuItem
                        className="text-white hover:bg-gray-800 cursor-pointer"
                        onClick={handleViewPdf}
                      >
                        <FileText className="w-4 h-4 mr-2" />
                        <div>
                          <div className="font-semibold">View PDF</div>
                          <div className="text-xs text-gray-400">Open in new tab</div>
                        </div>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-white hover:bg-gray-800 cursor-pointer"
                        onClick={handleDownloadPdf}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        <div>
                          <div className="font-semibold">Download PDF</div>
                          <div className="text-xs text-gray-400">Visual inspection report</div>
                        </div>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <p className="text-xs text-center text-gray-400 mt-2">PDF includes annotated images & findings summary</p>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
