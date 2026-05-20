"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  ImageUp,
  SlidersHorizontal,
  ScanSearch,
  FileText,
  ChevronRight,
  Workflow,
  Network,
  Camera,
  Video,
  Layers,
  Cpu,
  GitMerge,
  Target,
  BarChart3,
  Crosshair,
} from "lucide-react";

type ArchType = "process" | "system";
type BranchTab = "image" | "video";

interface Step {
  num: number;
  title: string;
  detail: string;
  tag?: string;
}

interface Stage {
  id: string;
  num: string;
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  statusFlow: string[];
  description: string;
  hasBranch: boolean;
  steps?: Step[];
  imagePipeline?: Step[];
  videoPipeline?: Step[];
}

const STATUS_PILL: Record<string, string> = {
  created:      "bg-gray-100 text-gray-600 dark:bg-gray-800/60 dark:text-gray-400",
  validating:   "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  validated:    "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  failed:       "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  preprocessing:"bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
  preprocessed: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  detecting:    "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  detected:     "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  reporting:    "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  completed:    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
};

const stages: Stage[] = [
  {
    id: "input",
    num: "01",
    label: "Input",
    icon: ImageUp,
    statusFlow: ["created", "validating", "validated"],
    description: "Upload images or video, validate quality via Laplacian blur detection, and extract GPS metadata.",
    hasBranch: false,
    steps: [
      {
        num: 1,
        title: "Job Creation",
        detail: "A UUID job record is created and stored in metadata.json with status created. Accepts image batches (JPG/PNG/BMP/TIFF) or a single video (MP4/AVI/MOV) with an optional .srt telemetry file.",
        tag: "created",
      },
      {
        num: 2,
        title: "Blur Check — Laplacian Variance",
        detail: "Images: Laplacian variance is computed on the full image. Videos: 10 evenly-spaced frames are sampled and their scores averaged. Any file with a score below the threshold (10.0) is marked invalid.",
        tag: "math",
      },
      {
        num: 3,
        title: "GPS Extraction",
        detail: "EXIF GPS tags (latitude, longitude, altitude) are parsed from each image. Videos receive GPS from SRT telemetry at detection time rather than here.",
      },
      {
        num: 4,
        title: "SRT Pairing",
        detail: "If a .srt telemetry file was uploaded alongside a video, it is paired by filename stem — or auto-paired when there is exactly one video and one SRT. Stored for per-frame GPS + altitude during detection.",
      },
      {
        num: 5,
        title: "Location Patch (optional)",
        detail: "Images lacking EXIF GPS can receive manually assigned coordinates: batch mode updates all files missing GPS, targeted mode updates specific file IDs.",
        tag: "optional",
      },
    ],
  },
  {
    id: "preprocess",
    num: "02",
    label: "Preprocessing",
    icon: SlidersHorizontal,
    statusFlow: ["validated", "preprocessing", "preprocessed"],
    description: "MOCS-optimized CLAHE contrast enhancement. Branches on input type.",
    hasBranch: true,
    imagePipeline: [
      {
        num: 1,
        title: "Feature Extraction",
        detail: "Per image: six features computed — brightness, contrast, edge density, green ratio, saturation, and algae coverage estimate.",
      },
      {
        num: 2,
        title: "Cluster Assignment",
        detail: "Feature vectors normalized and grouped (default K=3). One representative image per cluster selected as the centroid-nearest member.",
        tag: "K=3",
      },
      {
        num: 3,
        title: "MOCS Optimization",
        detail: "Multi-Objective Cat Swarm Optimization runs on each cluster representative (downscaled to 640 px wide for speed). Finds optimal clip_limit and tile_grid_size for CLAHE, balancing contrast, edge sharpness, and noise. Parameters scaled back to full resolution.",
        tag: "catswarm",
      },
      {
        num: 4,
        title: "CLAHE Enhancement",
        detail: "Each image enhanced using its cluster's optimized CLAHE parameters. Applied in LAB color space — only the L (luminance) channel is processed.",
        tag: "LAB",
      },
    ],
    videoPipeline: [
      {
        num: 1,
        title: "Frame Sampling",
        detail: "10 frames sampled evenly across the full video duration to capture representative scene diversity.",
      },
      {
        num: 2,
        title: "Median Frame Construction",
        detail: "A pixel-wise median frame is computed across all 10 samples, producing a representative 'average scene' free of transient content. Used as the MOCS tuning target.",
      },
      {
        num: 3,
        title: "MOCS Optimization",
        detail: "MOCS runs once on the median frame (same Cat Swarm algorithm as image pipeline) to derive a single global clip_limit + tile_grid_size applied uniformly to all frames.",
        tag: "catswarm",
      },
      {
        num: 4,
        title: "Parallel Frame Processing",
        detail: "Every frame processed with CLAHE. Frames run in a thread pool or CUDA kernel if available. Each frame downscaled to 75% during processing, then upscaled back to original resolution.",
        tag: "parallel",
      },
      {
        num: 5,
        title: "Save Output",
        detail: "Processed frames reassembled and written as an H.264 MP4 to processed/. CII (Contrast Improvement Index) is computed per file and stored in metadata.json.",
        tag: "H.264",
      },
    ],
  },
  {
    id: "detection",
    num: "03",
    label: "Detection",
    icon: ScanSearch,
    statusFlow: ["preprocessed", "detecting", "detected"],
    description: "YOLOv11 inference with cross-frame deduplication for video.",
    hasBranch: true,
    imagePipeline: [
      {
        num: 1,
        title: "YOLOv11 Inference",
        detail: "YOLO runs on the processed image and returns bounding boxes with class label and confidence score. Detects: crack, hairline_crack, structural_crack, spalling, peeling, algae/algae_growth, stain/staining.",
        tag: "YOLOv11",
      },
      {
        num: 2,
        title: "Annotation & Storage",
        detail: "YOLO draws bounding boxes with class labels onto the image and saves it to annotated/. Detection records (class, confidence, coordinates) are written to metadata.json.",
      },
    ],
    videoPipeline: [
      {
        num: 1,
        title: "SRT Telemetry Load",
        detail: "Paired SRT file parsed to build a timestamp → {latitude, longitude, altitude} lookup for per-frame GPS resolution during detection.",
      },
      {
        num: 2,
        title: "YOLOv11 Frame Streaming",
        detail: "YOLO streams every frame sequentially. A fully annotated output video is written to annotated/. Frames containing at least one detection are collected for deduplication.",
        tag: "YOLOv11",
      },
      {
        num: 3,
        title: "Cross-Frame Deduplication",
        detail: "Detections grouped by class, sorted by confidence (desc). A detection survives only if its bounding box does not overlap (IoU > 0.4) with any already-kept detection of the same class — eliminating repeated sightings of the same physical defect across consecutive frames.",
        tag: "IoU > 0.4",
      },
    ],
  },
  {
    id: "report",
    num: "04",
    label: "Report",
    icon: FileText,
    statusFlow: ["detected", "reporting", "completed"],
    description: "Aggregate all detections, compute severity summary, and render a structured PDF report via ReportLab.",
    hasBranch: false,
    steps: [
      {
        num: 1,
        title: "Load & Aggregate Detections",
        detail: "All detection records loaded from metadata.json. Every DefectDetection across all files flattened into a single ordered list.",
      },
      {
        num: 2,
        title: "Summary Computation",
        detail: "Total defect counts grouped by class (cracks, peeling, algae, spalling, staining). Severity counts computed (Low / Medium / High). Dominant severity determined as the highest-count bucket. Unique defect types present recorded.",
        tag: "aggregate",
      },
      {
        num: 3,
        title: "GPS & Annotated Path Collection",
        detail: "GPS coordinates (lat, lng, alt — nullable per file) and annotated image paths collected from file records for inclusion in the report.",
      },
      {
        num: 4,
        title: "PDF Generation — ReportLab",
        detail: "PDF assembled with: job metadata header, defect summary table, severity breakdown chart, GPS coordinate listing, and annotated image snapshots. Saved as {job_id}_report.pdf.",
        tag: "ReportLab",
      },
      {
        num: 5,
        title: "Report Record Written",
        detail: "Report record (including pdf_path) written to metadata.json. Subsequent GET /report requests reconstruct the same aggregated data directly from metadata.json — no re-inference ever occurs.",
        tag: "cached",
      },
    ],
  },
];

// ─── Step Card ────────────────────────────────────────────────────────────────

function StepCard({ step, isLast }: { step: Step; isLast: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex items-start gap-3 group">
      <div className="flex flex-col items-center gap-0 shrink-0 pt-0.5">
        <button
          onClick={() => setOpen(v => !v)}
          className={cn(
            "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold font-mono transition-all cursor-pointer border-2 shrink-0",
            open
              ? "bg-[#2ca75d] border-[#2ca75d] text-white shadow-md shadow-[#2ca75d]/30"
              : "bg-gray-50 dark:bg-[#0c0e12] border-emerald-200 dark:border-[#1e4032] text-gray-500 dark:text-gray-400 hover:border-[#2ca75d]/60 hover:text-[#2ca75d]"
          )}
        >
          {step.num}
        </button>
        {!isLast && (
          <div className="w-0.5 flex-1 min-h-[20px] bg-emerald-100 dark:bg-[#1e4032] mt-1" />
        )}
      </div>
      <div className="flex-1 min-w-0 pb-4">
        <button
          onClick={() => setOpen(v => !v)}
          className="w-full text-left flex items-center gap-2 cursor-pointer group/btn"
        >
          <span className={cn(
            "text-sm font-semibold transition-colors",
            open ? "text-[#2ca75d]" : "text-gray-800 dark:text-gray-100 group-hover/btn:text-[#2ca75d]"
          )}>
            {step.title}
          </span>
          {step.tag && (
            <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold
                             bg-emerald-50 dark:bg-[#2ca75d]/10 text-emerald-600 dark:text-[#2ca75d]
                             border border-emerald-200 dark:border-[#2ca75d]/20">
              {step.tag}
            </span>
          )}
        </button>
        {open && (
          <p className="mt-1.5 text-xs leading-relaxed text-gray-600 dark:text-gray-400">
            {step.detail}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Stage Node ───────────────────────────────────────────────────────────────

function StageNode({
  stage,
  isActive,
  isLast,
  onClick,
}: {
  stage: Stage;
  isActive: boolean;
  isLast: boolean;
  onClick: () => void;
}) {
  const Icon = stage.icon;
  return (
    <div className="flex items-center gap-0">
      <button
        onClick={onClick}
        className={cn(
          "flex flex-col items-center gap-2 p-3 sm:p-4 rounded-xl border-2 transition-all cursor-pointer min-w-[80px] sm:min-w-[110px]",
          isActive
            ? "border-[#2ca75d] bg-emerald-50 dark:bg-[#2ca75d]/[0.06] shadow-sm shadow-[#2ca75d]/20"
            : "border-emerald-100 dark:border-[#1e4032] bg-white dark:bg-[#0d0f14] hover:border-[#2ca75d]/40 hover:bg-emerald-50/50 dark:hover:bg-[#2ca75d]/[0.03]"
        )}
      >
        <div className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
          isActive
            ? "bg-[#2ca75d] text-white"
            : "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500"
        )}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="text-center">
          <div className={cn(
            "text-[10px] font-mono font-bold tracking-wider mb-0.5",
            isActive ? "text-[#2ca75d]" : "text-gray-400 dark:text-gray-600"
          )}>
            {stage.num}
          </div>
          <div className={cn(
            "text-xs font-semibold leading-tight",
            isActive ? "text-gray-900 dark:text-white" : "text-gray-500 dark:text-gray-400"
          )}>
            {stage.label}
          </div>
        </div>
      </button>
      {!isLast && (
        <div className="flex items-center px-1 shrink-0">
          <ChevronRight className={cn(
            "w-5 h-5 transition-colors",
            isActive ? "text-[#2ca75d]" : "text-gray-300 dark:text-gray-700"
          )} />
        </div>
      )}
    </div>
  );
}

// ─── AlgorithmSection ─────────────────────────────────────────────────────────

const AlgorithmSection = () => {
  const [archType, setArchType] = useState<ArchType>("process");
  const [activeIdx, setActiveIdx] = useState(0);
  const [branch, setBranch] = useState<BranchTab>("image");

  const stage = stages[activeIdx];
  const steps = stage.hasBranch
    ? (branch === "image" ? stage.imagePipeline! : stage.videoPipeline!)
    : stage.steps!;

  return (
    <section className="w-full py-24 bg-gray-50 dark:bg-[#101115]" id="algorithm">
      <div className="container max-w-6xl mx-auto px-6">

        {/* ── Header ──────────────────────────────────── */}
        <div className="text-center mb-12 space-y-4">
          <p className="text-sm font-mono text-emerald-700 dark:text-[#0da6f2] uppercase tracking-widest">
            How It Works
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">
            The Algorithm Behind{" "}
            <span className="bg-gradient-to-r from-[#2ca75d] to-[#0da6f2] bg-clip-text text-transparent">
              viscrete
            </span>
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xl mx-auto leading-relaxed">
            A four-stage pipeline — from raw concrete imagery to a structured defect report.
            Select a stage to explore its algorithm steps.
          </p>
        </div>

        {/* ── Architecture toggle ──────────────────────── */}
        <div className="flex justify-center mb-10">
          <div className="inline-flex rounded-lg p-1 gap-1
                          border border-emerald-200 bg-gray-100
                          dark:border-[#1e4032] dark:bg-[#0c0e12]">
            <button
              onClick={() => setArchType("process")}
              className={cn(
                "flex items-center gap-2 px-5 py-2.5 rounded-md text-sm font-medium transition-colors cursor-pointer",
                archType === "process"
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-300 dark:bg-[#2ca75d]/20 dark:text-[#2ca75d] dark:border-[#2ca75d]/40"
                  : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
              )}
            >
              <Workflow className="w-4 h-4" />
              Process Architecture
            </button>
            <button
              onClick={() => setArchType("system")}
              className={cn(
                "flex items-center gap-2 px-5 py-2.5 rounded-md text-sm font-medium transition-colors cursor-pointer",
                archType === "system"
                  ? "bg-blue-50 text-blue-700 border border-blue-300 dark:bg-[#0da6f2]/20 dark:text-[#0da6f2] dark:border-[#0da6f2]/40"
                  : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
              )}
            >
              <Network className="w-4 h-4" />
              System Architecture
            </button>
          </div>
        </div>

        {/* ── System Architecture ──────────────────────── */}
        {archType === "system" && (
          <div className="rounded-lg border border-emerald-200 bg-gray-100 p-4 md:p-6
                          dark:border-[#1e4032] dark:bg-[#0c0e12]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/system-architecture.png"
              alt="System Architecture Diagram"
              className="w-full rounded-md"
            />
          </div>
        )}

        {/* ── Process Architecture ─────────────────────── */}
        {archType === "process" && (
          <div className="space-y-8">

            {/* Stage selector flow */}
            <div className="overflow-x-auto pb-2">
              <div className="flex items-center justify-center min-w-max mx-auto gap-0">
                {stages.map((s, idx) => (
                  <StageNode
                    key={s.id}
                    stage={s}
                    isActive={idx === activeIdx}
                    isLast={idx === stages.length - 1}
                    onClick={() => { setActiveIdx(idx); setBranch("image"); }}
                  />
                ))}
              </div>
            </div>

            {/* Status flow strip */}
            <div className="flex items-center justify-center gap-1.5 flex-wrap">
              {stage.statusFlow.map((s, i) => (
                <div key={s} className="flex items-center gap-1.5">
                  <span className={cn(
                    "px-2 py-0.5 rounded-full text-[11px] font-semibold font-mono",
                    STATUS_PILL[s]
                  )}>
                    {s}
                  </span>
                  {i < stage.statusFlow.length - 1 && (
                    <ChevronRight className="w-3.5 h-3.5 text-gray-300 dark:text-gray-700 shrink-0" />
                  )}
                </div>
              ))}
            </div>

            {/* Detail panel */}
            <div className="rounded-xl border border-emerald-200 dark:border-[#1e4032]
                            bg-white dark:bg-[#0d0f14] overflow-hidden">

              {/* Panel header */}
              <div className="px-6 py-4 border-b border-emerald-100 dark:border-[#1e4032]
                              bg-emerald-50/50 dark:bg-[#2ca75d]/[0.03] flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono font-bold text-[#2ca75d]">{stage.num}</span>
                    <span className="text-base font-bold text-gray-900 dark:text-white">{stage.label}</span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed max-w-xl">
                    {stage.description}
                  </p>
                </div>
                {stage.hasBranch && (
                  <div className="flex items-center gap-1 shrink-0 rounded-lg border border-emerald-200 dark:border-[#1e4032] p-0.5 bg-white dark:bg-[#0c0e12]">
                    <button
                      onClick={() => setBranch("image")}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer",
                        branch === "image"
                          ? "bg-emerald-50 dark:bg-[#2ca75d]/15 text-emerald-700 dark:text-[#2ca75d] border border-emerald-200 dark:border-[#2ca75d]/30"
                          : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                      )}
                    >
                      <Camera className="w-3.5 h-3.5" />
                      Image
                    </button>
                    <span className="hidden">
                      <button
                        onClick={() => setBranch("video")}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer",
                          branch === "video"
                            ? "bg-emerald-50 dark:bg-[#2ca75d]/15 text-emerald-700 dark:text-[#2ca75d] border border-emerald-200 dark:border-[#2ca75d]/30"
                            : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                        )}
                      >
                        <Video className="w-3.5 h-3.5" />
                        Video
                      </button>
                    </span>
                  </div>
                )}
              </div>

              {/* Step list */}
              <div className="px-6 py-5">
                <p className="text-[10px] font-mono font-semibold uppercase tracking-widest
                               text-gray-400 dark:text-gray-600 mb-4">
                  {stage.hasBranch
                    ? `${branch === "image" ? "Image" : "Video"} pipeline — ${steps.length} steps (click to expand)`
                    : `${steps.length} steps — click to expand`}
                </p>
                <div className="space-y-0">
                  {steps.map((step, idx) => (
                    <StepCard
                      key={`${stage.id}-${branch}-${step.num}`}
                      step={step}
                      isLast={idx === steps.length - 1}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Stage dot indicators */}
            <div className="flex justify-center gap-2">
              {stages.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => { setActiveIdx(idx); setBranch("image"); }}
                  className={cn(
                    "h-1.5 rounded-full transition-all cursor-pointer",
                    idx === activeIdx
                      ? "w-8 bg-[#2ca75d]"
                      : "w-1.5 bg-emerald-200 dark:bg-[#1e4032] hover:bg-emerald-300 dark:hover:bg-[#2ca75d]/30"
                  )}
                />
              ))}
            </div>

          </div>
        )}

      </div>
    </section>
  );
};

export default AlgorithmSection;
