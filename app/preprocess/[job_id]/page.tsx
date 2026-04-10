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
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

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

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ─── Before/After toggle ──────────────────────────────────────────────────────

function BeforeAfterToggle({ original, processed, label }: {
  original: string;
  processed: string;
  label: string;
}) {
  const [showProcessed, setShowProcessed] = useState(false);

  return (
    <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
      {/* Header with filename + toggle */}
      <div className="px-3 py-2 bg-gray-50 dark:bg-gray-900 flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-gray-600 dark:text-gray-400 truncate">{label}</span>
        <div className="flex items-center gap-1 shrink-0 bg-gray-200 dark:bg-gray-700 rounded-lg p-0.5">
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
    <div className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 rounded-xl p-4">
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
          state === "active" && "border-blue-500 bg-blue-50 dark:bg-blue-950/30 shadow-lg shadow-blue-500/20",
          state === "completed" && "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30",
          state === "failed" && "border-red-500 bg-red-50 dark:bg-red-950/30",
        )}>
          {state === "pending" && <span className="text-xs font-bold text-gray-400">{index + 1}</span>}
          {state === "active" && <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />}
          {state === "completed" && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
          {state === "failed" && <XCircle className="w-5 h-5 text-red-500" />}
        </div>

        {/* Label */}
        <span className={cn(
          "text-[11px] font-medium text-center w-20 leading-tight",
          state === "pending" && "text-gray-400",
          state === "active" && "text-blue-600 dark:text-blue-400",
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

  const hasStarted = useRef(false);

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
        if (alreadyDone) setIsComplete(true);
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

    // Simulate step advancement while request is in-flight
    // Steps advance every 1.5s — purely visual until response arrives
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
  // FastAPI is mounted at app/database/jobs → URL: /static/{job_id}/{subfolder}/{file_id}.{ext}
  const imageFiles = jobMeta?.files
    .filter(f => f.status !== "invalid")
    .map(f => {
      const ext = f.filename.split(".").pop() ?? "jpg";
      const storedName = `${f.file_id}.${ext}`;
      return {
        label: f.filename,
        original: `${API_BASE_URL}/static/${encodeURIComponent(job_id)}/original/${storedName}`,
        processed: `${API_BASE_URL}/static/${encodeURIComponent(job_id)}/processed/${storedName}`,
      };
    }) ?? [];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a]">
      {/* Header */}
      <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-[#111]">
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

        {/* ── Section 1: Progress Stepper ───────────────────────────── */}
        <div className="bg-white dark:bg-[#161616] rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm">
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

          {isRunning && (
            <div className="mt-5 flex items-center gap-2 text-sm text-blue-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              Processing… please wait
            </div>
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
            {/* Cluster Cards — only available when pipeline just ran */}
            {result && result.cluster_info.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
                  Cluster Summary ({result.cluster_info.length} cluster{result.cluster_info.length !== 1 ? "s" : ""})
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {result.cluster_info.map(c => (
                    <ClusterCard key={c.cluster_id} info={c} />
                  ))}
                </div>
              </div>
            )}

            {/* Before / After Comparisons */}
            {imageFiles.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
                  Before / After Comparison
                  <span className="ml-2 text-gray-400 font-normal normal-case text-xs">
                    Drag the slider to compare
                  </span>
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {imageFiles.map(({ label, original, processed }) => (
                    <BeforeAfterToggle
                      key={label}
                      label={label}
                      original={original}
                      processed={processed}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Proceed button */}
            <div className="flex justify-end">
              <button
                id="btn-proceed-detection"
                onClick={() => router.push(`/detect/${encodeURIComponent(job_id)}`)}
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
