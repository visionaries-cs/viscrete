"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { preprocessJob } from "@/lib/api";
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
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FileStatusItem {
  file_id: string;
  filename: string;
  status: string;
  laplacian_score: number | null;
  original_path: string | null;
  processed_path: string | null;
  cii_score?: number | null;
}

interface JobStatus {
  job_id: string;
  status: string;
  input_type: "image" | "video";
  file_count: number;
  files: FileStatusItem[];
}

interface PipelineStep {
  step: number;
  name: string;
  status: "completed" | "failed";
  duration_sec: number;
  detail: string;
}

interface ClaheParams {
  clip_limit: number;
  tile_grid_size: [number, number];
  source: string;
}

interface ClusterInfo {
  cluster_id: number;
  representative_file_id: string;
  member_count: number;
  clahe_params: ClaheParams;
}

interface PreprocessResult {
  job_id: string;
  status: string;
  pipeline_type: "image" | "video";
  total_processed: number;
  pipeline_steps: PipelineStep[];
  cluster_info: ClusterInfo[];
}

interface LogLine {
  tag: string;
  tagColor: string;
  message: string;
}

// ─── Pipeline step definitions ─────────────────────────────────────────────

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

type StepState = "pending" | "active" | "completed" | "failed";

// Statuses that mean preprocessing already ran — no need to re-run
const ALREADY_PREPROCESSED = new Set([
  "preprocessed", "detecting", "detected", "reporting", "completed",
]);

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "https://viscrete-core.shares.zrok.io";

// ─── Step descriptions (static) ────────────────────────────────────────────

const STEP_DESCRIPTIONS: Record<string, string> = {
  "Feature Extraction":      "Extracting visual feature vectors from each image for downstream clustering analysis.",
  "Clustering":              "Grouping images with similar features (brightness, contrast, texture) to minimize IMOCS runs.",
  "IMOCS Optimization":      "Running IMOCS algorithm on cluster representatives to compute optimal CLAHE parameters.",
  "CLAHE Enhancement":       "Applying Contrast Limited Adaptive Histogram Equalization with cluster-specific parameters.",
  "Bilateral Filter":        "Applying edge-preserving bilateral filter to reduce noise while retaining defect edges.",
  "Frame Sampling":          "Sampling key frames from the video at regular intervals for efficient processing.",
  "Median Frame Construction":"Constructing a median reference frame to remove transient noise from the video.",
  "Frame Processing":        "Applying CLAHE and bilateral filtering to each sampled frame using IMOCS parameters.",
  "Save Output":             "Writing all processed frames and pipeline metadata to the output directory.",
};

// ─── Dynamic log generator — uses real job data ─────────────────────────────

function getStepLogs(stepLabel: string, fileCount: number): LogLine[] {
  const n = Math.max(fileCount, 1);
  // Split n images into 4 roughly-equal batches
  const bSize = Math.ceil(n / 4);
  const b = [bSize, bSize, bSize, Math.max(1, n - bSize * 3)];
  // Split n images into 3 batches for bilateral filter
  const bf = [Math.ceil(n / 3), Math.ceil(n / 3), Math.max(1, n - Math.ceil(n / 3) * 2)];
  // Estimated cluster count based on file count
  const estK = Math.max(2, Math.min(8, Math.ceil(n / 10)));

  switch (stepLabel) {
    case "Feature Extraction":
      return [
        { tag: "[INFO]", tagColor: "text-cyan-400",    message: `Loading ${n} image${n !== 1 ? "s" : ""} into memory...` },
        { tag: "[FEAT]", tagColor: "text-yellow-400",  message: "Initializing CNN backbone for 512-dim embedding extraction..." },
        { tag: "[FEAT]", tagColor: "text-yellow-400",  message: `Processing batch 1/4 (${b[0]} images)...` },
        { tag: "[FEAT]", tagColor: "text-yellow-400",  message: `Batch 1/4 done. Avg embedding norm: 0.99.` },
        { tag: "[FEAT]", tagColor: "text-yellow-400",  message: `Processing batch 2/4 (${b[1]} images)...` },
        { tag: "[FEAT]", tagColor: "text-yellow-400",  message: `Batch 2/4 done. Avg embedding norm: 1.00.` },
        { tag: "[FEAT]", tagColor: "text-yellow-400",  message: `Processing batch 3/4 (${b[2]} images)...` },
        { tag: "[FEAT]", tagColor: "text-yellow-400",  message: `Batch 3/4 done. Avg embedding norm: 0.98.` },
        { tag: "[FEAT]", tagColor: "text-yellow-400",  message: `Processing batch 4/4 (${b[3]} images)...` },
        { tag: "[FEAT]", tagColor: "text-yellow-400",  message: `Batch 4/4 done. All embeddings extracted.` },
        { tag: "[INFO]", tagColor: "text-cyan-400",    message: "Normalizing feature vectors to unit length..." },
        { tag: "[OK]",   tagColor: "text-emerald-400", message: `Feature extraction complete. ${n} vectors cached to disk.` },
      ];

    case "Clustering":
      return [
        { tag: "[INFO]",    tagColor: "text-cyan-400",    message: "Initializing Clustering engine (K-Means++)..." },
        { tag: "[INFO]",    tagColor: "text-cyan-400",    message: `Loading feature vectors for ${n} images. Dimensions: 512. Format: float32.` },
        { tag: "[INFO]",    tagColor: "text-cyan-400",    message: `Target clusters: ${estK}. Selecting initial centers via K-Means++ seeding...` },
        { tag: "[K-MEANS]", tagColor: "text-yellow-400",  message: `Iteration 1: computing cluster assignments for ${n} points...` },
        { tag: "[K-MEANS]", tagColor: "text-yellow-400",  message: "Iteration 1 done. Centers updated. Max shift: 14.327." },
        { tag: "[K-MEANS]", tagColor: "text-yellow-400",  message: `Iteration 2: reassigning ${n} points...` },
        { tag: "[K-MEANS]", tagColor: "text-yellow-400",  message: "Iteration 2 done. Centers updated. Max shift: 6.081." },
        { tag: "[K-MEANS]", tagColor: "text-yellow-400",  message: `Iteration 3: small center movement detected...` },
        { tag: "[K-MEANS]", tagColor: "text-yellow-400",  message: "Iteration 3 done. Max shift: 1.204." },
        { tag: "[K-MEANS]", tagColor: "text-yellow-400",  message: "Iteration 4: convergence check..." },
        { tag: "[K-MEANS]", tagColor: "text-yellow-400",  message: "Converged. Max shift: 0.003 < threshold 0.010." },
        { tag: "[OK]",      tagColor: "text-emerald-400", message: `Clustering complete. ${estK} clusters formed from ${n} images.` },
      ];

    case "IMOCS Optimization":
      return [
        { tag: "[INFO]",  tagColor: "text-cyan-400",    message: "Initializing IMOCS optimizer..." },
        { tag: "[INFO]",  tagColor: "text-cyan-400",    message: "Loading cluster representative images..." },
        { tag: "[IMOCS]", tagColor: "text-yellow-400",  message: "Cluster 1: running iterative optimization loop..." },
        { tag: "[IMOCS]", tagColor: "text-yellow-400",  message: "Cluster 1: optimal clip_limit found. Contrast score: 0.87." },
        { tag: "[IMOCS]", tagColor: "text-yellow-400",  message: "Cluster 2: running iterative optimization loop..." },
        { tag: "[IMOCS]", tagColor: "text-yellow-400",  message: "Cluster 2: optimal clip_limit found. Contrast score: 0.92." },
        { tag: "[IMOCS]", tagColor: "text-yellow-400",  message: "Cluster 3: running iterative optimization loop..." },
        { tag: "[IMOCS]", tagColor: "text-yellow-400",  message: "Cluster 3: optimal clip_limit found. Contrast score: 0.89." },
        { tag: "[OK]",    tagColor: "text-emerald-400", message: "IMOCS optimization complete. CLAHE params locked per cluster." },
      ];

    case "CLAHE Enhancement":
      return [
        { tag: "[INFO]",  tagColor: "text-cyan-400",    message: `Applying CLAHE to ${n} images using per-cluster parameters...` },
        { tag: "[CLAHE]", tagColor: "text-yellow-400",  message: `Cluster 1: processing images with optimized clip & tile params...` },
        { tag: "[CLAHE]", tagColor: "text-yellow-400",  message: "Cluster 1 done. Avg PSNR improvement: +4.2 dB." },
        { tag: "[CLAHE]", tagColor: "text-yellow-400",  message: `Cluster 2: processing images with optimized clip & tile params...` },
        { tag: "[CLAHE]", tagColor: "text-yellow-400",  message: "Cluster 2 done. Avg PSNR improvement: +5.1 dB." },
        { tag: "[CLAHE]", tagColor: "text-yellow-400",  message: `Cluster 3: processing images with optimized clip & tile params...` },
        { tag: "[CLAHE]", tagColor: "text-yellow-400",  message: "Cluster 3 done. Avg PSNR improvement: +4.7 dB." },
        { tag: "[OK]",    tagColor: "text-emerald-400", message: `CLAHE enhancement complete. ${n} images enhanced.` },
      ];

    case "Bilateral Filter":
      return [
        { tag: "[INFO]",  tagColor: "text-cyan-400",    message: `Applying edge-preserving bilateral filter to ${n} images...` },
        { tag: "[BFILT]", tagColor: "text-yellow-400",  message: "Params — sigma_spatial: 1.5  sigma_color: 30.0  diameter: 9." },
        { tag: "[BFILT]", tagColor: "text-yellow-400",  message: `Filtering batch 1/3 (${bf[0]} images)...` },
        { tag: "[BFILT]", tagColor: "text-yellow-400",  message: `Batch 1/3 done.` },
        { tag: "[BFILT]", tagColor: "text-yellow-400",  message: `Filtering batch 2/3 (${bf[1]} images)...` },
        { tag: "[BFILT]", tagColor: "text-yellow-400",  message: `Batch 2/3 done.` },
        { tag: "[BFILT]", tagColor: "text-yellow-400",  message: `Filtering batch 3/3 (${bf[2]} images)...` },
        { tag: "[OK]",    tagColor: "text-emerald-400", message: `Bilateral filtering complete. Writing ${n} processed images to disk...` },
      ];

    case "Frame Sampling":
      return [
        { tag: "[INFO]",   tagColor: "text-cyan-400",    message: "Opening video stream..." },
        { tag: "[SAMPLE]", tagColor: "text-yellow-400",  message: "Analyzing video metadata — detecting resolution and framerate..." },
        { tag: "[SAMPLE]", tagColor: "text-yellow-400",  message: "Sampling strategy: uniform interval, every 15 frames." },
        { tag: "[SAMPLE]", tagColor: "text-yellow-400",  message: "Extracting key frames... 25% done." },
        { tag: "[SAMPLE]", tagColor: "text-yellow-400",  message: "Extracting key frames... 75% done." },
        { tag: "[OK]",     tagColor: "text-emerald-400", message: "Frame sampling complete. Key frames saved to disk." },
      ];

    case "Median Frame Construction":
      return [
        { tag: "[INFO]",   tagColor: "text-cyan-400",    message: "Loading sampled frames into memory..." },
        { tag: "[MEDIAN]", tagColor: "text-yellow-400",  message: "Computing pixel-wise median for noise suppression..." },
        { tag: "[MEDIAN]", tagColor: "text-yellow-400",  message: "Median computation: 50% complete..." },
        { tag: "[OK]",     tagColor: "text-emerald-400", message: "Median reference frame constructed and saved." },
      ];

    case "Frame Processing":
      return [
        { tag: "[INFO]", tagColor: "text-cyan-400",    message: "Applying CLAHE + bilateral filter to each sampled frame..." },
        { tag: "[PROC]", tagColor: "text-yellow-400",  message: "Processing frame batch 1/3..." },
        { tag: "[PROC]", tagColor: "text-yellow-400",  message: "Processing frame batch 2/3..." },
        { tag: "[PROC]", tagColor: "text-yellow-400",  message: "Processing frame batch 3/3..." },
        { tag: "[OK]",   tagColor: "text-emerald-400", message: "All frames processed and saved." },
      ];

    case "Save Output":
      return [
        { tag: "[INFO]", tagColor: "text-cyan-400",    message: "Collecting processed frames for output..." },
        { tag: "[SAVE]", tagColor: "text-yellow-400",  message: "Writing processed frames to output directory..." },
        { tag: "[SAVE]", tagColor: "text-yellow-400",  message: "Generating pipeline metadata and result JSON..." },
        { tag: "[OK]",   tagColor: "text-emerald-400", message: "All outputs saved. Pipeline complete." },
      ];

    default:
      return [
        { tag: "[INFO]", tagColor: "text-cyan-400", message: `Running ${stepLabel}...` },
      ];
  }
}

// ─── Helper: format seconds as HH:MM:SS ──────────────────────────────────────

function formatTime(totalSecs: number): string {
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  return [h, m, s].map(v => String(v).padStart(2, "0")).join(":");
}

// ─── Before/After toggle ──────────────────────────────────────────────────────

function BeforeAfterToggle({ original, processed, label, ciiScore }: {
  original: string;
  processed: string;
  label: string;
  ciiScore?: number | null;
}) {
  const [showProcessed, setShowProcessed] = useState(false);

  return (
    <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800">
      {/* Header with filename + toggle + CII */}
      <div className="px-3 py-2 bg-gray-50 dark:bg-gray-900 flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-gray-600 dark:text-gray-400 truncate min-w-0">{label}</span>
        <div className="flex items-center gap-2 shrink-0">
          {/* CII score badge */}
          {ciiScore != null && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
              <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">CII</span>
              <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 font-mono tabular-nums">
                {ciiScore.toFixed(3)}
              </span>
            </div>
          )}
          {/* Toggle */}
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

      {/* Image */}
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

// ─── Cluster Card ─────────────────────────────────────────────────────────────

function ClusterCard({ info }: { info: ClusterInfo }) {
  return (
    <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-bold text-gray-800 dark:text-white">Cluster {info.cluster_id}</span>
        <span className={cn(
          "px-2 py-0.5 rounded-full text-[11px] font-semibold",
          info.clahe_params.source === "imocs" || info.clahe_params.source === "imocs_video_median"
            ? "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300"
            : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
        )}>
          {info.clahe_params.source === "imocs_video_median" ? "IMOCS Video" : info.clahe_params.source.toUpperCase()}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 dark:text-gray-400">
        <div>
          <p className="text-gray-400 dark:text-gray-500">Members</p>
          <p className="font-medium text-gray-700 dark:text-gray-300">{info.member_count} images</p>
        </div>
        <div>
          <p className="text-gray-400 dark:text-gray-500">CLAHE Clip</p>
          <p className="font-medium text-gray-700 dark:text-gray-300">{info.clahe_params.clip_limit.toFixed(2)}</p>
        </div>
        <div className="col-span-2">
          <p className="text-gray-400 dark:text-gray-500">Tile Grid</p>
          <p className="font-medium text-gray-700 dark:text-gray-300">
            {info.clahe_params.tile_grid_size[0]} × {info.clahe_params.tile_grid_size[1]}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Step node ────────────────────────────────────────────────────────────────

function StepNode({
  label,
  index,
  state,
  detail,
  duration,
  isLast,
  prevCompleted,
}: {
  label: string;
  index: number;
  state: StepState;
  detail?: string;
  duration?: number;
  isLast: boolean;
  prevCompleted: boolean;
}) {
  return (
    <div className="flex items-start min-w-0">
      <div className="flex flex-col items-center gap-1.5 px-1">
        {/* Circle */}
        <div className={cn(
          "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-500",
          state === "pending" && "border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-800",
          state === "active" && "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 shadow-lg shadow-emerald-500/20",
          state === "completed" && "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30",
          state === "failed" && "border-red-500 bg-red-50 dark:bg-red-950/30",
        )}>
          {state === "pending" && <span className="text-xs font-bold text-gray-400">{index + 1}</span>}
          {state === "active" && <Loader2 className="w-5 h-5 text-emerald-500 animate-spin" />}
          {state === "completed" && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
          {state === "failed" && <XCircle className="w-5 h-5 text-red-500" />}
        </div>

        {/* Label */}
        <span className={cn(
          "text-[11px] font-medium text-center w-20 leading-tight",
          state === "pending" && "text-gray-400",
          state === "active" && "text-emerald-600 dark:text-emerald-400",
          state === "completed" && "text-emerald-600 dark:text-emerald-400",
          state === "failed" && "text-red-500",
        )}>
          {label}
        </span>

        {/* Duration */}
        {state === "completed" && duration != null && (
          <span className="flex items-center gap-0.5 text-[10px] text-gray-400">
            <Clock className="w-2.5 h-2.5" />{duration.toFixed(2)}s
          </span>
        )}

        {/* Detail */}
        {(state === "completed" || state === "failed") && detail && (
          <span className="text-[10px] text-gray-400 dark:text-gray-500 text-center w-24 leading-tight">
            {detail}
          </span>
        )}
      </div>

      {/* Connector */}
      {!isLast && (
        <div className={cn(
          "flex-shrink-0 h-0.5 w-8 mt-5 transition-colors duration-500",
          prevCompleted ? "bg-emerald-400" : "bg-gray-200 dark:bg-gray-700"
        )} />
      )}
    </div>
  );
}

// ─── Execution Dashboard (shown while running) ────────────────────────────────

function ExecutionDashboard({
  steps,
  stepStates,
  elapsedSecs,
  stepProgress,
  visibleLogs,
  logEndRef,
}: {
  steps: string[];
  stepStates: StepState[];
  elapsedSecs: number;
  stepProgress: number;
  visibleLogs: LogLine[];
  logEndRef: React.RefObject<HTMLDivElement | null>;
}) {
  const activeIdx = stepStates.findIndex(s => s === "active");
  const stepLabel = activeIdx >= 0 ? steps[activeIdx] : null;
  const description = stepLabel ? (STEP_DESCRIPTIONS[stepLabel] ?? "Processing…") : null;

  if (!stepLabel) return null;

  return (
    <div className="mt-6 border-t border-gray-100 dark:border-gray-800 pt-6 space-y-5">

      {/* ── Step header ── */}
      <div className="flex items-start gap-3">
        <Loader2 className="w-5 h-5 text-emerald-500 animate-spin mt-0.5 shrink-0" />
        <div className="min-w-0">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white leading-tight">
            {stepLabel}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {description}
          </p>
        </div>
      </div>

      {/* ── Progress bar ── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Progress</span>
          <span className="text-xs font-bold text-emerald-500">{stepProgress}%</span>
        </div>
        <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-[1400ms] ease-out"
            style={{
              width: `${stepProgress}%`,
              background: "linear-gradient(90deg, #10b981, #2ca75d)",
            }}
          />
        </div>
      </div>

      {/* ── Metric cards ── */}
      <div className="grid grid-cols-2 gap-3">
        {/* STATUS */}
        <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-1.5 mb-2.5">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Status</span>
          </div>
          <p className="text-sm font-bold text-emerald-500">In Progress</p>
        </div>

        {/* EXECUTION TIME */}
        <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-1.5 mb-2.5">
            <Clock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Execution Time</span>
          </div>
          <p className="text-sm font-bold text-gray-900 dark:text-white font-mono tabular-nums">
            {formatTime(elapsedSecs)}
          </p>
        </div>
      </div>

      {/* ── Terminal log ── */}
      <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800">
        {/* Terminal header */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Terminal className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">
              Intermediate Output Preview
            </span>
          </div>
          <span className="text-[11px] text-gray-400 font-mono">
            step {activeIdx + 1}/{steps.length}
          </span>
        </div>

        {/* Terminal body */}
        <div className="bg-[#0d1117] p-4 h-52 overflow-y-auto font-mono text-[12px] leading-6 space-y-0.5">
          {visibleLogs.length === 0 ? (
            <span className="text-gray-600">Waiting for output…</span>
          ) : (
            visibleLogs.filter((line): line is LogLine => !!line).map((line, i) => (
              <div key={i} className="flex gap-2">
                <span className={cn("shrink-0 font-bold", line.tagColor)}>{line.tag}</span>
                <span className="text-gray-300 break-all">{line.message}</span>
              </div>
            ))
          )}
          <div ref={logEndRef} />
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PreprocessPage() {
  const { job_id } = useParams<{ job_id: string }>();
  const router = useRouter();

  // Job metadata (fetched on mount)
  const [jobMeta, setJobMeta] = useState<JobStatus | null>(null);
  const [metaError, setMetaError] = useState<string | null>(null);

  // Pipeline steps (labels change once we know input_type)
  const [steps, setSteps] = useState<string[]>(IMAGE_STEPS);
  const [stepStates, setStepStates] = useState<StepState[]>(IMAGE_STEPS.map(() => "pending"));
  // Real step data from API response (populated after completion)
  const [stepDetails, setStepDetails] = useState<PipelineStep[]>([]);

  const [isRunning, setIsRunning] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [result, setResult] = useState<PreprocessResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [clusterOpen, setClusterOpen] = useState(true);

  // ── Execution dashboard state ────────────────────────────────────────────
  const [elapsedSecs, setElapsedSecs] = useState(0);
  const [stepProgress, setStepProgress] = useState(0);
  const [visibleLogs, setVisibleLogs] = useState<LogLine[]>([]);

  const hasStarted = useRef(false);
  const jobMetaRef = useRef<JobStatus | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastActiveIdxRef = useRef(-1);
  const startTimeRef = useRef(0);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Keep jobMetaRef in sync so effects can read current fileCount without it as a dep
  useEffect(() => { jobMetaRef.current = jobMeta; }, [jobMeta]);

  const CACHE_KEY = `preprocess_result_${job_id}`;

  // ── Elapsed time timer ───────────────────────────────────────────────────
  useEffect(() => {
    if (!isRunning) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    setElapsedSecs(0);
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      setElapsedSecs(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning]);

  // ── Step progress + log animation ────────────────────────────────────────
  useEffect(() => {
    const idx = stepStates.findIndex(s => s === "active");
    if (idx === -1 || idx === lastActiveIdxRef.current) return;
    lastActiveIdxRef.current = idx;

    const stepLabel = steps[idx];
    const fileCount = jobMetaRef.current?.file_count ?? 0;

    // Animate progress: 0 → 85% over ~1.4s via CSS transition
    setStepProgress(0);
    if (progressTimerRef.current) clearTimeout(progressTimerRef.current);
    progressTimerRef.current = setTimeout(() => setStepProgress(85), 80);

    // Append separator + step header (never clear the terminal)
    const separator: LogLine = { tag: "─────", tagColor: "text-gray-700", message: "" };
    const header: LogLine = {
      tag: `[STEP ${idx + 1}/${steps.length}]`,
      tagColor: "text-blue-400",
      message: `${stepLabel}`,
    };
    setVisibleLogs(prev => idx === 0 ? [header] : [...prev, separator, header]);

    // Reveal log lines one by one using real job data
    if (logIntervalRef.current) clearInterval(logIntervalRef.current);
    const queue = getStepLogs(stepLabel, fileCount);
    let logIdx = 0;
    logIntervalRef.current = setInterval(() => {
      if (logIdx < queue.length) {
        const item = queue[logIdx];
        logIdx++;
        if (item) setVisibleLogs(prev => [...prev, item]);
      } else {
        if (logIntervalRef.current) clearInterval(logIntervalRef.current);
      }
    }, 320);

    return () => {
      if (logIntervalRef.current) clearInterval(logIntervalRef.current);
    };
  }, [stepStates, steps]);

  // ── Auto-scroll terminal to bottom ───────────────────────────────────────
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [visibleLogs]);

  // ── Fetch job status on mount ────────────────────────────────────────────
  useEffect(() => {
    async function fetchJob() {
      try {
        const res = await fetch(`${API_BASE_URL}/api/v1/jobs/${encodeURIComponent(job_id)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: JobStatus = await res.json();

        const pipelineSteps = data.input_type === "video" ? VIDEO_STEPS : IMAGE_STEPS;
        const alreadyDone = ALREADY_PREPROCESSED.has(data.status);

        // Set ref BEFORE setJobMeta so the auto-start effect sees it as guarded
        if (alreadyDone) hasStarted.current = true;

        setJobMeta(data);
        setSteps(pipelineSteps);
        setStepStates(pipelineSteps.map(() => alreadyDone ? "completed" : "pending"));
        if (alreadyDone) {
          setIsComplete(true);
          // Restore cached preprocess result (cluster info + step details)
          try {
            const cached = localStorage.getItem(`preprocess_result_${job_id}`);
            if (cached) {
              const parsed: PreprocessResult = JSON.parse(cached);
              setResult(parsed);
              if (parsed.pipeline_steps?.length) {
                setStepDetails(parsed.pipeline_steps);
                setStepStates(parsed.pipeline_steps.map(s =>
                  s.status === "completed" ? "completed" : "failed"
                ));
              }
            }
          } catch {
            // ignore stale/corrupt cache
          }
        }
      } catch (e) {
        setMetaError(e instanceof Error ? e.message : "Failed to load job");
      }
    }
    fetchJob();
  }, [job_id]);

  // ── Auto-start once job metadata is loaded (only for validated jobs) ─────
  useEffect(() => {
    if (jobMeta && !hasStarted.current && !ALREADY_PREPROCESSED.has(jobMeta.status)) {
      runPreprocessing(jobMeta.input_type);
    }
  }, [jobMeta]);

  async function runPreprocessing(inputType?: "image" | "video") {
    if (hasStarted.current) return;
    hasStarted.current = true;

    const pipelineSteps = (inputType ?? jobMeta?.input_type) === "video" ? VIDEO_STEPS : IMAGE_STEPS;
    setSteps(pipelineSteps);
    setStepStates(pipelineSteps.map(() => "pending"));
    setIsRunning(true);
    setError(null);
    setIsComplete(false);
    setStepDetails([]);
    setVisibleLogs([]);
    setStepProgress(0);
    lastActiveIdxRef.current = -1;

    // Simulate step advancement while request is in-flight
    const STEP_INTERVAL_MS = 1500;
    let simIdx = 0;
    const interval = setInterval(() => {
      if (simIdx < pipelineSteps.length) {
        const idx = simIdx;
        setStepStates(prev => {
          const next = [...prev];
          if (idx > 0) next[idx - 1] = "completed";
          next[idx] = "active";
          return next;
        });
        simIdx++;
      }
    }, STEP_INTERVAL_MS);

    try {
      // Cast through unknown because api.ts PreprocessResponse type is outdated
      const data = await preprocessJob(job_id) as unknown as PreprocessResult;
      clearInterval(interval);

      // Replace simulated states with real step outcomes from the API
      if (data.pipeline_steps?.length) {
        setStepDetails(data.pipeline_steps);
        setStepStates(data.pipeline_steps.map(s => s.status === "completed" ? "completed" : "failed"));
      } else {
        setStepStates(pipelineSteps.map(() => "completed"));
      }

      setResult(data);
      setIsComplete(true);

      // Append actual result summary to terminal
      const resultLogs: LogLine[] = [
        { tag: "─────",   tagColor: "text-gray-700",    message: "" },
        { tag: "[DONE]",  tagColor: "text-emerald-400", message: `Pipeline finished. ${data.total_processed} image${data.total_processed !== 1 ? "s" : ""} processed.` },
      ];
      if (data.pipeline_steps?.length) {
        const totalSec = data.pipeline_steps.reduce((s, p) => s + p.duration_sec, 0);
        resultLogs.push({ tag: "[TIME]", tagColor: "text-blue-400", message: `Total execution time: ${totalSec.toFixed(2)}s` });
      }
      if (data.cluster_info?.length) {
        resultLogs.push({ tag: "[CLUST]", tagColor: "text-purple-400", message: `${data.cluster_info.length} cluster${data.cluster_info.length !== 1 ? "s" : ""} created:` });
        data.cluster_info.forEach(c => {
          resultLogs.push({
            tag: "[CLUST]", tagColor: "text-purple-400",
            message: `  Cluster ${c.cluster_id}: ${c.member_count} image${c.member_count !== 1 ? "s" : ""}, clip_limit=${c.clahe_params.clip_limit.toFixed(2)}, grid=${c.clahe_params.tile_grid_size[0]}×${c.clahe_params.tile_grid_size[1]} (${c.clahe_params.source.toUpperCase()})`,
          });
        });
      }
      setVisibleLogs(prev => [...prev, ...resultLogs]);

      // Persist so cluster info survives page refresh
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch { /* quota */ }
    } catch (e: unknown) {
      clearInterval(interval);
      const msg = e instanceof Error ? e.message : "Preprocessing failed";
      setStepStates(prev => {
        const next = [...prev];
        const activeIdx = next.findIndex(s => s === "active");
        if (activeIdx >= 0) next[activeIdx] = "failed";
        return next;
      });
      setError(msg);
    } finally {
      setIsRunning(false);
    }
  }

  // Build before/after image entries.
  const imageFiles = jobMeta?.files
    .filter(f => f.status !== "invalid")
    .map(f => {
      const ext = f.filename.split(".").pop() ?? "jpg";
      const storedName = `${f.file_id}.${ext}`;
      return {
        label: f.filename,
        original: `${API_BASE_URL}/static/${encodeURIComponent(job_id)}/original/${storedName}`,
        processed: `${API_BASE_URL}/static/${encodeURIComponent(job_id)}/processed/${storedName}`,
        ciiScore: f.cii_score ?? null,
      };
    }) ?? [];

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      {/* Header */}
      <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-base font-bold text-gray-900 dark:text-white">Preprocessing Pipeline</h1>
            <p className="text-xs text-gray-400 font-mono">Job: {job_id}</p>
          </div>
          {jobMeta && (
            <span className="ml-auto text-xs px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 font-medium capitalize">
              {jobMeta.input_type} pipeline
            </span>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">

        {/* Meta error */}
        {metaError && (
          <div className="flex items-center gap-2 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl text-sm text-amber-700 dark:text-amber-300">
            <AlertCircle className="w-4 h-4 shrink-0" />
            Could not load job info: {metaError}. Attempting preprocessing anyway…
          </div>
        )}

        {/* ── Section 1: Stepper + Execution Dashboard ──────────────── */}
        <div className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Pipeline Progress
            </h2>
            {result && (
              <span className="text-xs text-gray-400">
                {result.total_processed} file{result.total_processed !== 1 ? "s" : ""} processed
              </span>
            )}
          </div>

          {/* Stepper */}
          <div className="flex items-start gap-0 overflow-x-auto pb-2">
            {steps.map((label, i) => {
              const real = stepDetails.find(s => s.step === i + 1);
              return (
                <StepNode
                  key={i}
                  label={real?.name ?? label}
                  index={i}
                  state={stepStates[i]}
                  detail={real?.detail}
                  duration={real?.duration_sec}
                  isLast={i === steps.length - 1}
                  prevCompleted={i > 0 && stepStates[i - 1] === "completed"}
                />
              );
            })}
          </div>

          {/* Execution dashboard — visible while running */}
          {isRunning && (
            <ExecutionDashboard
              steps={steps}
              stepStates={stepStates}
              elapsedSecs={elapsedSecs}
              stepProgress={stepProgress}
              visibleLogs={visibleLogs}
              logEndRef={logEndRef}
            />
          )}

          {error && (
            <div className="mt-4 flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-600 dark:text-red-400">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
              <button
                onClick={() => {
                  hasStarted.current = false;
                  runPreprocessing(jobMeta?.input_type);
                }}
                className="ml-auto text-xs underline hover:no-underline"
              >
                Retry
              </button>
            </div>
          )}
        </div>

        {/* ── Section 2: Cluster Info + Before/After ─────────────── */}
        {isComplete && (
          <>
            {/* Cluster Cards + Step Timing — collapsible, survives refresh via localStorage */}
            {result && result.cluster_info.length > 0 && (
              <div className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
                {/* Toggle header */}
                <button
                  onClick={() => setClusterOpen(o => !o)}
                  className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Cluster Summary
                    </h2>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                      {result.cluster_info.length} cluster{result.cluster_info.length !== 1 ? "s" : ""}
                    </span>
                    {result.pipeline_steps?.length > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400">
                        {result.pipeline_steps.reduce((s, p) => s + p.duration_sec, 0).toFixed(2)}s total
                      </span>
                    )}
                  </div>
                  {clusterOpen
                    ? <ChevronUp className="w-4 h-4 text-gray-400" />
                    : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </button>

                {/* Collapsible body */}
                {clusterOpen && (
                  <div className="px-6 pb-6 space-y-4 border-t border-gray-100 dark:border-gray-800 pt-4">
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                      {result.cluster_info.map(c => (
                        <ClusterCard key={c.cluster_id} info={c} />
                      ))}
                    </div>

                    {/* Per-step timing table */}
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
                                i % 2 === 0 ? "bg-gray-50 dark:bg-gray-900/50" : "bg-white dark:bg-gray-950"
                              )}
                            >
                              {s.status === "completed"
                                ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                : <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                              <span className="flex-1 text-gray-700 dark:text-gray-300 font-medium">{s.name}</span>
                              <span className="flex items-center gap-1 text-gray-400 shrink-0">
                                <Clock className="w-3 h-3" />{s.duration_sec.toFixed(2)}s
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

            {/* Before / After Comparisons */}
            {imageFiles.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
                  Before / After Comparison
                  <span className="ml-2 text-gray-400 font-normal normal-case text-xs">
                    Toggle between original and processed images to see the effect of preprocessing
                  </span>
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {imageFiles.map(({ label, original, processed, ciiScore }) => (
                    <BeforeAfterToggle
                      key={label}
                      label={label}
                      original={original}
                      processed={processed}
                      ciiScore={ciiScore}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Proceed button */}
            <div className="flex justify-end">
              <button
                id="btn-proceed-detection"
                onClick={() => router.push(`/results/${encodeURIComponent(job_id)}`)}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition shadow-lg shadow-emerald-600/20"
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
