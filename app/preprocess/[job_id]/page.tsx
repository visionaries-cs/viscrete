"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowLeft,
  ArrowRight,
  AlertCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  Terminal,
  Video,
  Copy,
  Trash2,
} from "lucide-react";
import { ModeToggle } from "@/components/ui/mode-toggle";

// ─── Types ────────────────────────────────────────────────────────────────────

type StepStatus = "pending" | "in_progress" | "completed" | "failed";
type LogLevel = "info" | "warning" | "error";

interface StepState {
  step: number;
  name: string;
  status: StepStatus;
  duration_sec: number | null;
  detail: string | null;
  progress: number | null;
  error: string | null;
}

interface TerminalLine {
  timestamp: string;
  step: number | null;
  name: string | null;
  level: LogLevel;
  message: string;
}

interface CompletedSummary {
  total_processed: number;
  pipeline_type: string;
  duration_sec: number;
}

interface FileStatusItem {
  file_id: string;
  filename: string;
  status: string;
  laplacian_score: number | null;
  original_path: string | null;
  processed_path: string | null;
}

interface JobStatus {
  job_id: string;
  status: string;
  input_type: "image" | "video";
  file_count: number;
  files: FileStatusItem[];
  preprocessing_result?: PreprocessResult | null;
}

interface PipelineStep {
  step: number;
  name: string;
  status: "completed" | "failed";
  duration_sec: number;
  detail: string;
}

interface ClusterInfo {
  cluster_id: number;
  representative_file_id: string;
  member_count: number;
  clahe_params: {
    clip_limit: number;
    tile_grid_size: [number, number];
    source: string;
  };
}

interface CiiScoreEntry {
  file_id: string;
  cii_score: number;
  original_contrast: number;
  processed_contrast: number;
}

interface PreprocessResult {
  job_id: string;
  status: string;
  pipeline_type: "image" | "video";
  total_processed: number;
  pipeline_steps: PipelineStep[];
  cluster_info: ClusterInfo[];
  cii_scores?: CiiScoreEntry[];
  output_video_path?: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "https://viscrete-core.shares.zrok.io";

const ALREADY_PREPROCESSED = new Set([
  "preprocessed",
  "detecting",
  "detected",
  "reporting",
  "completed",
]);

// Fallback step names used before pipeline_init fires or for already-done jobs
const IMAGE_STEPS = [
  "Feature Extraction",
  "Clustering",
  "IMOCS Optimization",
  "CLAHE Enhancement",
  "Bilateral Filter",
];
const VIDEO_STEPS = [
  "Frame Sampling",
  "Median Frame Construction",
  "IMOCS Optimization",
  "Frame Processing",
  "Save Output",
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getTimestamp(iso?: string): string {
  const d = iso ? new Date(iso) : new Date();
  return [d.getHours(), d.getMinutes(), d.getSeconds()]
    .map((v) => String(v).padStart(2, "0"))
    .join(":");
}

function formatTime(totalSecs: number): string {
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

function makePendingSteps(names: string[]): StepState[] {
  return names.map((name, i) => ({
    step: i + 1,
    name,
    status: "pending",
    duration_sec: null,
    detail: null,
    progress: null,
    error: null,
  }));
}

// ─── BeforeAfterToggle ────────────────────────────────────────────────────────

function BeforeAfterToggle({
  original,
  processed,
  label,
  ciiScore,
  originalContrast,
  processedContrast,
}: {
  original: string;
  processed: string;
  label: string;
  ciiScore?: number | null;
  originalContrast?: number | null;
  processedContrast?: number | null;
}) {
  const [showProcessed, setShowProcessed] = useState(false);
  const activeContrast = showProcessed ? processedContrast : originalContrast;

  return (
    <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800">
      <div className="px-3 py-2 bg-gray-50 dark:bg-gray-900 flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-gray-600 dark:text-gray-400 truncate min-w-0">
          {label}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          {ciiScore != null && (
            <div
              className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800"
              title={`Contrast Improvement Index\nOriginal contrast: ${originalContrast?.toFixed(6) ?? "—"}\nProcessed contrast: ${processedContrast?.toFixed(6) ?? "—"}`}
            >
              <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
                CII
              </span>
              <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 font-mono tabular-nums">
                {ciiScore.toFixed(2)}
              </span>
              {activeContrast != null && (
                <span className="text-[10px] text-emerald-500/70 dark:text-emerald-500/60 font-mono tabular-nums">
                  ({activeContrast.toFixed(4)})
                </span>
              )}
            </div>
          )}
          <div className="flex items-center gap-1 bg-gray-200 dark:bg-gray-700 rounded-lg p-0.5">
            <button
              onClick={() => setShowProcessed(false)}
              className={cn(
                "px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all",
                !showProcessed
                  ? "bg-white dark:bg-gray-900 text-gray-800 dark:text-white shadow-sm"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              )}
            >
              Original
            </button>
            <button
              onClick={() => setShowProcessed(true)}
              className={cn(
                "px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all",
                showProcessed
                  ? "bg-white dark:bg-gray-900 text-gray-800 dark:text-white shadow-sm"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              )}
            >
              Processed
            </button>
          </div>
        </div>
      </div>
      <div className="relative overflow-hidden bg-black" style={{ aspectRatio: "16/9" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={original}
          alt="Original"
          className={cn(
            "absolute inset-0 w-full h-full object-contain transition-opacity duration-300",
            showProcessed ? "opacity-0" : "opacity-100"
          )}
          draggable={false}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={processed}
          alt="Processed"
          className={cn(
            "absolute inset-0 w-full h-full object-contain transition-opacity duration-300",
            showProcessed ? "opacity-100" : "opacity-0"
          )}
          draggable={false}
        />
        <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/60 text-white text-[10px] font-semibold">
          {showProcessed ? "PROCESSED" : "ORIGINAL"}
        </div>
      </div>
    </div>
  );
}

// ─── ClusterCard ──────────────────────────────────────────────────────────────

function ClusterCard({ info }: { info: ClusterInfo }) {
  return (
    <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-bold text-gray-800 dark:text-white">
          Cluster {info.cluster_id}
        </span>
        <span
          className={cn(
            "px-2 py-0.5 rounded-full text-[11px] font-semibold",
            info.clahe_params.source === "imocs" ||
              info.clahe_params.source === "imocs_video_median"
              ? "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300"
              : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
          )}
        >
          {info.clahe_params.source === "imocs_video_median"
            ? "IMOCS Video"
            : info.clahe_params.source.toUpperCase()}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 dark:text-gray-400">
        <div>
          <p className="text-gray-400 dark:text-gray-500">Members</p>
          <p className="font-medium text-gray-700 dark:text-gray-300">
            {info.member_count} images
          </p>
        </div>
        <div>
          <p className="text-gray-400 dark:text-gray-500">CLAHE Clip</p>
          <p className="font-medium text-gray-700 dark:text-gray-300">
            {info.clahe_params.clip_limit.toFixed(2)}
          </p>
        </div>
        <div className="col-span-2">
          <p className="text-gray-400 dark:text-gray-500">Tile Grid</p>
          <p className="font-medium text-gray-700 dark:text-gray-300">
            {info.clahe_params.tile_grid_size[0]} ×{" "}
            {info.clahe_params.tile_grid_size[1]}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── VideoPlayer ──────────────────────────────────────────────────────────────

function VideoPlayer({
  src,
  totalFrames,
  steps,
}: {
  src: string;
  totalFrames: number;
  steps: PipelineStep[];
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const totalSec = steps.reduce((s, p) => s + p.duration_sec, 0);

  return (
    <div className="w-full">
      <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
        <Video className="w-4 h-4" />
        Preprocessed Video Output
      </h2>
      <div className="w-full bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div
          className="relative w-full bg-black flex items-center justify-center"
          style={{ minHeight: 320 }}
        >
          {isLoading && !hasError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-gray-400 z-10">
              <Loader2 className="w-8 h-8 animate-spin" />
              <span className="text-sm">Loading video…</span>
            </div>
          )}
          {hasError ? (
            <div className="flex flex-col items-center gap-3 py-12 px-6 text-gray-500 dark:text-gray-400 w-full">
              <Video className="w-12 h-12 text-gray-400 dark:text-gray-600" />
              <p className="text-sm font-medium">Video preview unavailable</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
                The browser could not load the video. Check that the path exists and the format is browser-compatible (H.264 MP4 recommended).
              </p>
              <code className="text-[10px] font-mono bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-3 py-1.5 rounded-lg break-all max-w-full">
                {src}
              </code>
              <a
                href={src}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-500 hover:underline"
              >
                Try opening directly ↗
              </a>
            </div>
          ) : (
            <video
              ref={videoRef}
              src={src}
              controls
              className="w-full max-h-[480px] object-contain"
              onLoadedData={() => setIsLoading(false)}
              onError={() => {
                setIsLoading(false);
                setHasError(true);
              }}
            />
          )}
        </div>
        <div className="grid grid-cols-3 divide-x divide-gray-100 dark:divide-gray-800 border-t border-gray-100 dark:border-gray-800">
          <div className="px-5 py-3">
            <p className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-0.5">
              Frames processed
            </p>
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
              {totalFrames}
            </p>
          </div>
          <div className="px-5 py-3">
            <p className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-0.5">
              Pipeline steps
            </p>
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
              {steps.length}
            </p>
          </div>
          <div className="px-5 py-3">
            <p className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-0.5">
              Total time
            </p>
            <p className="text-sm font-semibold font-mono text-gray-800 dark:text-gray-100">
              {totalSec.toFixed(2)}s
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── StepItem ─────────────────────────────────────────────────────────────────

function StepItem({ step, isLast }: { step: StepState; isLast: boolean }) {
  return (
    <div className="flex gap-4">
      {/* Icon + connector column */}
      <div className="flex flex-col items-center">
        <div
          className={cn(
            "w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0 transition-all duration-300",
            step.status === "pending" &&
              "border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950",
            step.status === "in_progress" &&
              "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 shadow-sm shadow-emerald-500/30",
            step.status === "completed" &&
              "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30",
            step.status === "failed" &&
              "border-red-500 bg-red-50 dark:bg-red-950/30"
          )}
        >
          {step.status === "pending" && (
            <span className="text-xs font-bold text-gray-400 dark:text-gray-600">
              {step.step}
            </span>
          )}
          {step.status === "in_progress" && (
            <Loader2 className="w-3.5 h-3.5 text-emerald-500 animate-spin" />
          )}
          {step.status === "completed" && (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          )}
          {step.status === "failed" && (
            <XCircle className="w-3.5 h-3.5 text-red-500" />
          )}
        </div>
        {!isLast && (
          <div
            className={cn(
              "w-px flex-1 min-h-[1.5rem] mt-1 transition-colors duration-500",
              step.status === "completed"
                ? "bg-emerald-400 dark:bg-emerald-600"
                : "bg-gray-200 dark:bg-gray-800"
            )}
          />
        )}
      </div>

      {/* Content column */}
      <div className={cn("flex-1 min-w-0", !isLast && "pb-5")}>
        <div className="flex items-start justify-between gap-2">
          <span
            className={cn(
              "text-sm font-semibold leading-5",
              step.status === "pending" &&
                "text-gray-400 dark:text-gray-600",
              step.status === "in_progress" &&
                "text-gray-900 dark:text-white",
              step.status === "completed" &&
                "text-gray-900 dark:text-white",
              step.status === "failed" &&
                "text-red-600 dark:text-red-400"
            )}
          >
            {step.name}
          </span>
          {step.status === "completed" && step.duration_sec != null && (
            <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500 shrink-0 mt-0.5 font-mono tabular-nums">
              <Clock className="w-3 h-3" />
              {step.duration_sec.toFixed(2)}s
            </span>
          )}
        </div>

        {step.status === "completed" && step.detail && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {step.detail}
          </p>
        )}

        {/* Video frame progress bar — only shown for in_progress steps with a percent */}
        {step.status === "in_progress" && step.progress != null && (
          <div className="mt-2 max-w-sm">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-gray-500 dark:text-gray-400 truncate min-w-0 mr-2">
                {step.detail || "Processing…"}
              </span>
              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 shrink-0 tabular-nums">
                {step.progress}%
              </span>
            </div>
            <div className="h-1.5 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${step.progress}%` }}
              />
            </div>
          </div>
        )}

        {step.status === "failed" && step.error && (
          <p className="text-xs text-red-500 dark:text-red-400 mt-0.5">
            {step.error}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── PreprocessingStepper ─────────────────────────────────────────────────────

function PreprocessingStepper({
  steps,
  completedSummary,
  elapsedSecs,
  isRunning,
}: {
  steps: StepState[];
  completedSummary: CompletedSummary | null;
  elapsedSecs: number;
  isRunning: boolean;
}) {
  if (steps.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-400 dark:text-gray-600 py-4">
        <Loader2 className="w-4 h-4 animate-spin" />
        Connecting to pipeline…
      </div>
    );
  }

  return (
    <div>
      {/* Vertical step list */}
      <div>
        {steps.map((step, i) => (
          <StepItem key={step.step} step={step} isLast={i === steps.length - 1} />
        ))}
      </div>

      {/* Elapsed timer while running */}
      {isRunning && (
        <div className="mt-4 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <Clock className="w-3.5 h-3.5" />
          <span>
            Elapsed:{" "}
            <span className="font-mono font-semibold text-gray-700 dark:text-gray-200 tabular-nums">
              {formatTime(elapsedSecs)}
            </span>
          </span>
        </div>
      )}

      {/* Summary card after completion */}
      {completedSummary && (
        <div className="mt-5 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
              Pipeline Complete
            </span>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
                Files Processed
              </p>
              <p className="text-2xl font-bold font-mono text-gray-900 dark:text-white tabular-nums">
                {completedSummary.total_processed}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
                Pipeline Type
              </p>
              <p className="text-sm font-bold text-gray-900 dark:text-white capitalize mt-1.5">
                {completedSummary.pipeline_type}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
                Total Duration
              </p>
              <p className="text-2xl font-bold font-mono text-gray-900 dark:text-white tabular-nums">
                {completedSummary.duration_sec.toFixed(2)}s
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── PreprocessingTerminal ────────────────────────────────────────────────────

function PreprocessingTerminal({ lines }: { lines: TerminalLine[] }) {
  const [collapsed, setCollapsed] = useState(false);
  const [visibleLines, setVisibleLines] = useState<TerminalLine[]>([]);
  const [copied, setCopied] = useState(false);
  const lastSyncedCountRef = useRef(0);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Sync new lines from parent into visibleLines
  useEffect(() => {
    if (lines.length > lastSyncedCountRef.current) {
      const newLines = lines.slice(lastSyncedCountRef.current);
      lastSyncedCountRef.current = lines.length;
      setVisibleLines((prev) => {
        const merged = [...prev, ...newLines];
        return merged.length > 500 ? merged.slice(merged.length - 500) : merged;
      });
    }
  }, [lines]);

  // Auto-scroll to bottom on new lines
  useEffect(() => {
    if (!collapsed) {
      logEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [visibleLines, collapsed]);

  function handleClear() {
    lastSyncedCountRef.current = lines.length;
    setVisibleLines([]);
  }

  async function handleCopy() {
    const text = lines
      .map((l) => {
        const tag = l.step != null ? `STEP ${l.step}` : "PIPELINE";
        return `[${l.timestamp}] [${tag.padEnd(8)}] ${l.message}`;
      })
      .join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard API unavailable */
    }
  }

  return (
    <div className="rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-800">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800">
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition cursor-pointer"
        >
          <Terminal className="w-4 h-4 text-gray-400" />
          <span>
            {collapsed ? `Logs (${lines.length})` : "Terminal Output"}
          </span>
          {collapsed ? (
            <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
          ) : (
            <ChevronUp className="w-3.5 h-3.5 text-gray-400" />
          )}
        </button>
        <div className="flex items-center gap-1">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-200 transition cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5" />
            {copied ? "Copied!" : "Copy logs"}
          </button>
          <button
            onClick={handleClear}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-200 transition cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear
          </button>
        </div>
      </div>

      {/* Terminal body */}
      {!collapsed && (
        <div className="bg-[#0b0d10] p-4 h-72 overflow-y-auto font-mono text-[11.5px] leading-[1.65] scroll-smooth">
          {visibleLines.length === 0 ? (
            <span className="text-gray-600">Waiting for pipeline output…</span>
          ) : (
            visibleLines.map((line, i) => {
              const tag =
                line.step != null ? `STEP ${line.step}` : "PIPELINE";
              const padded = tag.padEnd(8);
              return (
                <div key={i} className="whitespace-pre-wrap break-all">
                  <span className="text-gray-600 select-none">
                    [{line.timestamp}]
                  </span>{" "}
                  <span
                    className={cn(
                      "font-semibold select-none",
                      line.step != null ? "text-blue-500" : "text-gray-500"
                    )}
                  >
                    [{padded}]
                  </span>{" "}
                  <span
                    className={cn(
                      line.level === "warning" && "text-[#FACC15]",
                      line.level === "error" && "text-[#F87171]",
                      line.level === "info" && "text-gray-200"
                    )}
                  >
                    {line.message}
                  </span>
                </div>
              );
            })
          )}
          <div ref={logEndRef} />
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PreprocessPage() {
  const { job_id } = useParams<{ job_id: string }>();
  const router = useRouter();

  const [jobMeta, setJobMeta] = useState<JobStatus | null>(null);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [stepStates, setStepStates] = useState<StepState[]>([]);
  const [terminalLines, setTerminalLines] = useState<TerminalLine[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [completedSummary, setCompletedSummary] =
    useState<CompletedSummary | null>(null);
  const [result, setResult] = useState<PreprocessResult | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [clusterOpen, setClusterOpen] = useState(true);
  const [elapsedSecs, setElapsedSecs] = useState(0);
  const [retryCount, setRetryCount] = useState(0);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Elapsed timer — driven by isRunning
  useEffect(() => {
    if (!isRunning) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    const start = Date.now();
    timerRef.current = setInterval(() => {
      setElapsedSecs(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning]);

  function handleRetry() {
    setStepStates([]);
    setTerminalLines([]);
    setGlobalError(null);
    setIsRunning(false);
    setIsComplete(false);
    setCompletedSummary(null);
    setElapsedSecs(0);
    setRetryCount((c) => c + 1);
  }

  // ── Master effect: fetch job + WebSocket + polling fallback ──────────────────
  useEffect(() => {
    let cancelled = false;
    let ws: WebSocket | null = null;
    let pollInterval: ReturnType<typeof setInterval> | null = null;
    let receivedCompleted = false;

    // ── Helpers ──────────────────────────────────────────────────────────────

    function addLine(line: TerminalLine) {
      if (cancelled) return;
      setTerminalLines((prev) => {
        const next = [...prev, line];
        return next.length > 500 ? next.slice(1) : next;
      });
    }

    function addPipelineLine(message: string, level: LogLevel = "info") {
      addLine({
        timestamp: getTimestamp(),
        step: null,
        name: null,
        level,
        message,
      });
    }

    // ── Result fetch (called after completed event) ───────────────────────────

    async function fetchResults() {
      const delays = [0, 1000, 2000, 4000];
      for (let attempt = 0; attempt < delays.length; attempt++) {
        if (delays[attempt] > 0) {
          await new Promise((resolve) => setTimeout(resolve, delays[attempt]));
        }
        if (cancelled) return;
        try {
          const res = await fetch(
            `${API_BASE_URL}/api/v1/jobs/${encodeURIComponent(job_id)}`
          );
          if (cancelled) return;
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data: JobStatus = await res.json();
          if (cancelled) return;
          const r = data.preprocessing_result ?? null;
          if (r) {
            setResult(r);
            try {
              localStorage.setItem(
                `preprocess_result_${job_id}`,
                JSON.stringify(r)
              );
            } catch { /* quota */ }
            return;
          }
          // preprocessing_result not yet persisted — retry unless last attempt
        } catch {
          if (cancelled) return;
          // HTTP error is not a race condition — stop retrying
          break;
        }
      }
      if (cancelled) return;
      addPipelineLine("Warning: could not load result data", "warning");
      try {
        const cached = localStorage.getItem(`preprocess_result_${job_id}`);
        if (cached) setResult(JSON.parse(cached));
      } catch { /* corrupt cache */ }
    }

    // ── Polling fallback ──────────────────────────────────────────────────────

    function startPolling() {
      if (pollInterval) return; // already polling
      pollInterval = setInterval(async () => {
        if (cancelled) return;
        try {
          const res = await fetch(
            `${API_BASE_URL}/api/v1/jobs/${encodeURIComponent(job_id)}`
          );
          if (!res.ok || cancelled) return;
          const data: JobStatus = await res.json();
          if (cancelled) return;

          if (data.status === "preprocessed") {
            clearInterval(pollInterval!);
            pollInterval = null;
            const r = data.preprocessing_result ?? null;
            if (r?.pipeline_steps?.length) {
              const mapped = r.pipeline_steps.map(
                (s): StepState => ({
                  step: s.step,
                  name: s.name,
                  status: s.status === "completed" ? "completed" : "failed",
                  duration_sec: s.duration_sec,
                  detail: s.detail,
                  progress: null,
                  error: null,
                })
              );
              setStepStates(mapped);
              const totalDuration = r.pipeline_steps.reduce(
                (acc, s) => acc + s.duration_sec,
                0
              );
              setCompletedSummary({
                total_processed: r.total_processed,
                pipeline_type: r.pipeline_type,
                duration_sec: totalDuration,
              });
              setResult(r);
              try {
                localStorage.setItem(
                  `preprocess_result_${job_id}`,
                  JSON.stringify(r)
                );
              } catch { /* quota */ }
            } else {
              // No step details — mark all completed
              setStepStates((prev) =>
                prev.map((s) => ({ ...s, status: "completed" }))
              );
              if (r) {
                setResult(r);
                setCompletedSummary({
                  total_processed: r.total_processed,
                  pipeline_type: r.pipeline_type,
                  duration_sec: 0,
                });
              }
            }
            setIsRunning(false);
            setIsComplete(true);
          } else if (data.status === "failed") {
            clearInterval(pollInterval!);
            pollInterval = null;
            setStepStates((prev) => {
              const next = [...prev];
              const activeIdx = next.findIndex(
                (s) => s.status === "in_progress"
              );
              if (activeIdx >= 0) {
                next[activeIdx] = {
                  ...next[activeIdx],
                  status: "failed",
                  error: "Preprocessing failed on the server",
                };
              }
              return next;
            });
            setGlobalError("Preprocessing failed on the server.");
            setIsRunning(false);
          }
        } catch { /* transient network error — keep polling */ }
      }, 3000);
      pollRef.current = pollInterval;
    }

    // ── WebSocket message handler ─────────────────────────────────────────────

    function handleMsg(msg: Record<string, unknown>, isReconnect = false) {
      if (cancelled) return;
      const ts = getTimestamp(msg.timestamp as string | undefined);

      switch (msg.type as string) {
        case "pipeline_init": {
          const initSteps = (
            msg.steps as Array<{ step: number; name: string }>
          ).map(
            (s): StepState => ({
              step: s.step,
              name: s.name,
              status: "pending",
              duration_sec: null,
              detail: null,
              progress: null,
              error: null,
            })
          );
          if (isReconnect) {
            // Preserve steps already completed/failed — only reset still-pending ones
            setStepStates((prev) => {
              if (prev.length === 0) return initSteps;
              return initSteps.map((s, i) => {
                const existing = prev[i];
                return existing && existing.status !== "pending" ? existing : s;
              });
            });
          } else {
            setStepStates(initSteps);
          }
          addLine({
            timestamp: ts,
            step: null,
            name: null,
            level: "info",
            message: `Pipeline ready (${msg.pipeline_type})`,
          });
          break;
        }

        case "step_start": {
          const step = msg.step as number;
          const name = msg.name as string;
          setStepStates((prev) =>
            prev.map((s) =>
              s.step === step ? { ...s, status: "in_progress" } : s
            )
          );
          addLine({
            timestamp: ts,
            step,
            name,
            level: "info",
            message: `▶ ${name} started`,
          });
          break;
        }

        case "step_done": {
          const step = msg.step as number;
          const name = msg.name as string;
          const duration_sec = msg.duration_sec as number;
          const detail = (msg.detail as string | null) ?? null;
          setStepStates((prev) =>
            prev.map((s) =>
              s.step === step
                ? { ...s, status: "completed", duration_sec, detail }
                : s
            )
          );
          addLine({
            timestamp: ts,
            step,
            name,
            level: "info",
            message: `✓ ${name} completed in ${duration_sec}s${detail ? ` — ${detail}` : ""}`,
          });
          break;
        }

        case "step_progress": {
          // No terminal output — only update progress bar for video step 4
          const step = msg.step as number;
          const percent = msg.percent as number;
          const detail = (msg.detail as string | null) ?? null;
          setStepStates((prev) =>
            prev.map((s) =>
              s.step === step
                ? { ...s, progress: percent, detail: detail ?? s.detail }
                : s
            )
          );
          break;
        }

        case "log": {
          addLine({
            timestamp: ts,
            step: (msg.step as number | null) ?? null,
            name: (msg.name as string | null) ?? null,
            level: ((msg.level as LogLevel) ?? "info") as LogLevel,
            message: msg.message as string,
          });
          break;
        }

        case "error": {
          const fatal = msg.fatal as boolean;
          const step = (msg.step as number | null) ?? null;
          const name = (msg.name as string | null) ?? null;
          const message = msg.message as string;

          if (fatal) {
            setStepStates((prev) => {
              const next = [...prev];
              const inProgressIdx = next.findIndex(
                (s) => s.status === "in_progress"
              );
              const targetIdx =
                inProgressIdx >= 0
                  ? inProgressIdx
                  : step != null
                  ? next.findIndex((s) => s.step === step)
                  : -1;
              if (targetIdx >= 0) {
                next[targetIdx] = {
                  ...next[targetIdx],
                  status: "failed",
                  error: message,
                };
              }
              return next;
            });
            addLine({
              timestamp: ts,
              step,
              name,
              level: "error",
              message: `✗ ${message}`,
            });
            setIsRunning(false);
            ws?.close();
          } else {
            addLine({
              timestamp: ts,
              step,
              name,
              level: "warning",
              message: `⚠ ${message}`,
            });
          }
          break;
        }

        case "completed": {
          receivedCompleted = true;
          const total_processed = msg.total_processed as number;
          const pipeline_type = msg.pipeline_type as string;
          const duration_sec = msg.duration_sec as number;
          setCompletedSummary({ total_processed, pipeline_type, duration_sec });
          setIsRunning(false);
          setIsComplete(true);
          addLine({
            timestamp: ts,
            step: null,
            name: null,
            level: "info",
            message: `Pipeline complete in ${duration_sec}s`,
          });
          fetchResults();
          break;
        }
      }
    }

    // ── Start WebSocket connection ─────────────────────────────────────────────

    function startWS(inputType: "image" | "video") {
      // Pre-populate with fallback step names (overwritten once pipeline_init fires)
      const fallbackNames =
        inputType === "video" ? VIDEO_STEPS : IMAGE_STEPS;
      setStepStates(makePendingSteps(fallbackNames));

      const wsBase = API_BASE_URL.replace(/^http:\/\//i, "ws://").replace(
        /^https:\/\//i,
        "wss://"
      );
      const wsUrl = `${wsBase}/api/v1/jobs/${encodeURIComponent(
        job_id
      )}/preprocess/ws`;

      let reconnectAttempts = 0;
      let pipelineStarted = false;

      function connect(isReconnect: boolean) {
        ws = new WebSocket(wsUrl);

        ws.onopen = async () => {
          if (cancelled) { ws?.close(); return; }
          if (isReconnect) return; // server replays buffered events — no POST needed
          setIsRunning(true);
          try {
            const res = await fetch(
              `${API_BASE_URL}/api/v1/jobs/${encodeURIComponent(
                job_id
              )}/preprocess`,
              { method: "POST" }
            );
            if (cancelled) return;
            if (res.status === 409) {
              setGlobalError("Job is not ready for preprocessing.");
              addPipelineLine("Error: job not ready for preprocessing", "error");
              setIsRunning(false);
              ws?.close();
              return;
            }
            pipelineStarted = true;
            // 202 → pipeline streams events via WS
          } catch (e) {
            if (cancelled) return;
            const errMsg =
              e instanceof Error ? e.message : "Failed to start preprocessing";
            setGlobalError(errMsg);
            addPipelineLine(`Error: ${errMsg}`, "error");
            setIsRunning(false);
            ws?.close();
          }
        };

        ws.onmessage = (event) => {
          try {
            handleMsg(
              JSON.parse(event.data) as Record<string, unknown>,
              isReconnect
            );
          } catch { /* malformed JSON — ignore */ }
        };

        ws.onerror = () => {
          // onclose fires after onerror — handled there
        };

        ws.onclose = () => {
          if (receivedCompleted || cancelled) return;
          if (!pipelineStarted) return; // POST failed or never sent — do not reconnect
          if (reconnectAttempts < 2) {
            reconnectAttempts++;
            const delay = reconnectAttempts * 1500;
            addPipelineLine(
              `WebSocket closed — reconnecting in ${delay / 1000}s…`
            );
            setTimeout(() => connect(true), delay);
          } else {
            addPipelineLine("WebSocket unavailable — switched to polling");
            startPolling();
          }
        };
      }

      connect(false);
    }

    // ── Load already-complete job ─────────────────────────────────────────────

    function loadCompletedJob(data: JobStatus) {
      const r = data.preprocessing_result ?? null;
      if (r?.pipeline_steps?.length) {
        setStepStates(
          r.pipeline_steps.map(
            (s): StepState => ({
              step: s.step,
              name: s.name,
              status: s.status === "completed" ? "completed" : "failed",
              duration_sec: s.duration_sec,
              detail: s.detail,
              progress: null,
              error: null,
            })
          )
        );
        const totalDuration = r.pipeline_steps.reduce(
          (acc, s) => acc + s.duration_sec,
          0
        );
        setCompletedSummary({
          total_processed: r.total_processed,
          pipeline_type: r.pipeline_type,
          duration_sec: totalDuration,
        });
        setResult(r);
        try {
          localStorage.setItem(
            `preprocess_result_${job_id}`,
            JSON.stringify(r)
          );
        } catch { /* quota */ }
      } else {
        // Fallback: show step names without timing data
        const fallbackNames =
          data.input_type === "video" ? VIDEO_STEPS : IMAGE_STEPS;
        setStepStates(
          makePendingSteps(fallbackNames).map((s) => ({
            ...s,
            status: "completed" as StepStatus,
          }))
        );
        // Try localStorage cache
        try {
          const cached = localStorage.getItem(`preprocess_result_${job_id}`);
          if (cached) {
            const cached_r = JSON.parse(cached) as PreprocessResult;
            setResult(cached_r);
            const totalDuration =
              cached_r.pipeline_steps?.reduce(
                (acc, s) => acc + s.duration_sec,
                0
              ) ?? 0;
            setCompletedSummary({
              total_processed: cached_r.total_processed,
              pipeline_type: cached_r.pipeline_type,
              duration_sec: totalDuration,
            });
          }
        } catch { /* corrupt cache */ }
      }
      setIsComplete(true);
    }

    // ── Fetch job metadata and branch ─────────────────────────────────────────

    async function fetchJob() {
      try {
        const res = await fetch(
          `${API_BASE_URL}/api/v1/jobs/${encodeURIComponent(job_id)}`
        );
        if (cancelled) return;
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: JobStatus = await res.json();
        if (cancelled) return;

        setJobMeta(data);

        if (ALREADY_PREPROCESSED.has(data.status)) {
          loadCompletedJob(data);
        } else {
          startWS(data.input_type);
        }
      } catch (e) {
        if (cancelled) return;
        setMetaError(
          e instanceof Error ? e.message : "Failed to load job"
        );
      }
    }

    fetchJob();

    return () => {
      cancelled = true;
      ws?.close();
      if (pollInterval) clearInterval(pollInterval);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [job_id, retryCount]); // retryCount forces re-run on manual retry

  // ── Derived: before/after image list ─────────────────────────────────────────

  const ciiByFileId = new Map(
    (result?.cii_scores ?? []).map((e) => [e.file_id, e])
  );
  const imageFiles =
    jobMeta?.files
      .filter((f) => f.status !== "invalid")
      .map((f) => {
        const ext = f.filename.split(".").pop() ?? "jpg";
        const storedName = `${f.file_id}.${ext}`;
        const cii = ciiByFileId.get(f.file_id) ?? null;
        return {
          label: f.filename,
          original: `${API_BASE_URL}/static/${encodeURIComponent(
            job_id
          )}/original/${storedName}`,
          processed: `${API_BASE_URL}/static/${encodeURIComponent(
            job_id
          )}/processed/${storedName}`,
          ciiScore: cii?.cii_score ?? null,
          originalContrast: cii?.original_contrast ?? null,
          processedContrast: cii?.processed_contrast ?? null,
        };
      }) ?? [];

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      {/* Header */}
      <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition cursor-pointer"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-base font-bold text-gray-900 dark:text-white">
              Preprocessing Pipeline
            </h1>
            <p className="text-xs text-gray-400 font-mono">Job: {job_id}</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {jobMeta && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 font-medium capitalize">
                {jobMeta.input_type} pipeline
              </span>
            )}
            <ModeToggle />
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {/* Meta fetch error */}
        {metaError && (
          <div className="flex items-center gap-2 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl text-sm text-amber-700 dark:text-amber-300">
            <AlertCircle className="w-4 h-4 shrink-0" />
            Could not load job info: {metaError}
          </div>
        )}

        {/* ── Section 1: Pipeline progress + stepper ──────────────────── */}
        <div className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Pipeline Progress
            </h2>
            {result && (
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {result.total_processed} file
                {result.total_processed !== 1 ? "s" : ""} processed
              </span>
            )}
          </div>

          <PreprocessingStepper
            steps={stepStates}
            completedSummary={completedSummary}
            elapsedSecs={elapsedSecs}
            isRunning={isRunning}
          />

          {/* Fatal error with retry */}
          {globalError && (
            <div className="mt-5 flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-600 dark:text-red-400">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="flex-1">{globalError}</span>
              <button
                onClick={handleRetry}
                className="text-xs underline hover:no-underline shrink-0 cursor-pointer"
              >
                Retry
              </button>
            </div>
          )}

          {/* Video processing placeholder while running */}
          {isRunning && jobMeta?.input_type === "video" && (
            <div className="mt-6">
              <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Video className="w-4 h-4" />
                Preprocessed Video Output
              </h2>
              <div className="w-full bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
                <div className="w-full bg-gray-100 dark:bg-gray-900 flex flex-col items-center justify-center gap-3 py-14">
                  <Loader2 className="w-9 h-9 text-emerald-500 animate-spin" />
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                    Processing video…
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    The processed output will appear here once the pipeline completes.
                  </p>
                </div>
                <div className="border-t border-gray-100 dark:border-gray-800 px-5 py-3 flex items-center gap-2">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    This may take several minutes for large videos.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Section 2: Terminal log ──────────────────────────────────── */}
        <PreprocessingTerminal lines={terminalLines} />

        {/* ── Section 3: Results (shown after completion) ─────────────── */}
        {isComplete && (
          <>
            {/* Cluster summary + step timing */}
            {result && (result.cluster_info?.length > 0 || result.pipeline_steps?.length > 0) && (
              <div className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
                <button
                  onClick={() => setClusterOpen((o) => !o)}
                  className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Cluster Summary
                    </h2>
                    {result.cluster_info?.length > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                        {result.cluster_info.length} cluster
                        {result.cluster_info.length !== 1 ? "s" : ""}
                      </span>
                    )}
                    {result.pipeline_steps?.length > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400">
                        {result.pipeline_steps
                          .reduce((s, p) => s + p.duration_sec, 0)
                          .toFixed(2)}
                        s total
                      </span>
                    )}
                  </div>
                  {clusterOpen ? (
                    <ChevronUp className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  )}
                </button>

                {clusterOpen && (
                  <div className="px-6 pb-6 space-y-4 border-t border-gray-100 dark:border-gray-800 pt-4">
                    {result.cluster_info?.length > 0 && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                        {result.cluster_info.map((c) => (
                          <ClusterCard key={c.cluster_id} info={c} />
                        ))}
                      </div>
                    )}

                    {result.pipeline_steps?.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
                          Step Timing
                        </p>
                        <div className="rounded-xl overflow-hidden border border-gray-100 dark:border-gray-800">
                          {result.pipeline_steps.map((s, i) => (
                            <div
                              key={s.step}
                              className={cn(
                                "flex items-center gap-3 px-4 py-2.5 text-xs",
                                i % 2 === 0
                                  ? "bg-gray-50 dark:bg-gray-900/50"
                                  : "bg-white dark:bg-gray-950"
                              )}
                            >
                              {s.status === "completed" ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                              ) : (
                                <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                              )}
                              <span className="flex-1 text-gray-700 dark:text-gray-300 font-medium">
                                {s.name}
                              </span>
                              <span className="flex items-center gap-1 text-gray-400 shrink-0 font-mono tabular-nums">
                                <Clock className="w-3 h-3" />
                                {s.duration_sec.toFixed(2)}s
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Video output */}
            {jobMeta?.input_type === "video" &&
              (() => {
                const videoFile = jobMeta.files[0];
                const ext = videoFile?.filename.split(".").pop() ?? "mp4";
                const videoSrc = videoFile?.processed_path
                  ? `${API_BASE_URL}/static/${videoFile.processed_path}`
                  : `${API_BASE_URL}/static/${encodeURIComponent(
                      job_id
                    )}/processed/${videoFile?.file_id}.${ext}`;
                return (
                  <VideoPlayer
                    src={videoSrc}
                    totalFrames={result?.total_processed ?? 0}
                    steps={result?.pipeline_steps ?? []}
                  />
                );
              })()}

            {/* Before / After image comparisons */}
            {jobMeta?.input_type !== "video" && imageFiles.length > 0 && (
              <div>
                <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
                  Before / After Comparison
                  <span className="ml-2 text-gray-400 font-normal normal-case text-xs">
                    Toggle to compare original vs processed
                  </span>
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {imageFiles.map(
                    ({
                      label,
                      original,
                      processed,
                      ciiScore,
                      originalContrast,
                      processedContrast,
                    }) => (
                      <BeforeAfterToggle
                        key={label}
                        label={label}
                        original={original}
                        processed={processed}
                        ciiScore={ciiScore}
                        originalContrast={originalContrast}
                        processedContrast={processedContrast}
                      />
                    )
                  )}
                </div>
              </div>
            )}

            {/* Proceed button */}
            <div className="flex justify-end">
              <button
                id="btn-proceed-detection"
                onClick={() =>
                  router.push(`/results/${encodeURIComponent(job_id)}`)
                }
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition shadow-lg shadow-emerald-600/20 cursor-pointer"
              >
                Proceed to Detection
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
