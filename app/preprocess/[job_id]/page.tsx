"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  preprocessJob,
  getOriginalImageUrl,
  getProcessedImageUrl,
  type PreprocessResponse,
  type ClusterInfo,
} from "@/lib/api";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Play,
  AlertCircle,
} from "lucide-react";

// ─── Stepper config ───────────────────────────────────────────────────────────

const STEPS = [
  "Feature Extraction",
  "K-Means Clustering",
  "IMOCS",
  "CLAHE",
  "Bilateral Filter",
];

type StepState = "pending" | "active" | "completed" | "failed";

// ─── Before/After slider ──────────────────────────────────────────────────────

function BeforeAfterSlider({ original, processed, label }: {
  original: string;
  processed: string;
  label: string;
}) {
  const [sliderPos, setSliderPos] = useState(50); // 0-100
  const [dragging, setDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  function calcPos(clientX: number) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    setSliderPos((x / rect.width) * 100);
  }

  const onMouseMove = (e: MouseEvent) => { if (dragging) calcPos(e.clientX); };
  const onMouseUp = () => setDragging(false);
  const onTouchMove = (e: TouchEvent) => { if (dragging) calcPos(e.touches[0].clientX); };

  useEffect(() => {
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onMouseUp);
    };
  }, [dragging]);

  return (
    <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
      <div className="px-3 py-2 bg-gray-50 dark:bg-gray-900 text-xs font-medium text-gray-600 dark:text-gray-400 truncate">
        {label}
      </div>
      <div
        ref={containerRef}
        className="relative select-none cursor-col-resize overflow-hidden"
        style={{ aspectRatio: "16/9" }}
        onMouseDown={e => { e.preventDefault(); setDragging(true); calcPos(e.clientX); }}
        onTouchStart={e => { setDragging(true); calcPos(e.touches[0].clientX); }}
      >
        {/* Processed (full background) */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={processed}
          alt="Processed"
          className="absolute inset-0 w-full h-full object-cover"
          draggable={false}
        />
        {/* Original (clipped left) */}
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ width: `${sliderPos}%` }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={original}
            alt="Original"
            className="absolute inset-0 w-full h-full object-cover"
            draggable={false}
          />
        </div>
        {/* Divider line */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg"
          style={{ left: `${sliderPos}%` }}
        >
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white shadow-md flex items-center justify-center">
            <div className="flex gap-0.5">
              <ChevronLeft className="w-3 h-3 text-gray-600" />
              <ChevronRight className="w-3 h-3 text-gray-600" />
            </div>
          </div>
        </div>
        {/* Labels */}
        <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/60 text-white text-[10px] font-semibold">ORIGINAL</div>
        <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-black/60 text-white text-[10px] font-semibold">PROCESSED</div>
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
          info.source === "IMOCS"
            ? "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300"
            : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
        )}>
          {info.source}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 dark:text-gray-400">
        <div>
          <p className="text-gray-400 dark:text-gray-500">Members</p>
          <p className="font-medium text-gray-700 dark:text-gray-300">{info.member_count} images</p>
        </div>
        <div>
          <p className="text-gray-400 dark:text-gray-500">CLAHE Clip</p>
          <p className="font-medium text-gray-700 dark:text-gray-300">{info.clahe_clip_limit.toFixed(1)}</p>
        </div>
        <div className="col-span-2">
          <p className="text-gray-400 dark:text-gray-500">Tile Grid</p>
          <p className="font-medium text-gray-700 dark:text-gray-300">{info.tile_grid_size[0]} × {info.tile_grid_size[1]}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PreprocessPage() {
  const { job_id } = useParams<{ job_id: string }>();
  const router = useRouter();

  const [stepStates, setStepStates] = useState<StepState[]>(STEPS.map(() => "pending"));
  const [isRunning, setIsRunning] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [preprocessResult, setPreprocessResult] = useState<PreprocessResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Start automatically on mount
  useEffect(() => {
    if (!isRunning && !hasStarted) {
      runPreprocessing();
    }
  }, []);

  async function runPreprocessing() {
    setIsRunning(true);
    setHasStarted(true);
    setError(null);
    setIsComplete(false);
    setStepStates(STEPS.map(() => "pending"));

    // Simulate step progression while the request is in-flight
    const stepDelay = 1800; // ms per step
    let currentStep = 0;
    const interval = setInterval(() => {
      if (currentStep < STEPS.length) {
        const idx = currentStep;
        setStepStates(prev => {
          const next = [...prev];
          if (idx > 0) next[idx - 1] = "completed";
          next[idx] = "active";
          return next;
        });
        currentStep++;
      }
    }, stepDelay);

    try {
      const result = await preprocessJob(job_id);
      clearInterval(interval);
      setStepStates(STEPS.map(() => "completed"));
      setPreprocessResult(result);
      setIsComplete(true);
    } catch (e: unknown) {
      clearInterval(interval);
      const msg = e instanceof Error ? e.message : "Preprocessing failed";
      // Mark the current active step as failed
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

  const filenames = preprocessResult?.filenames ?? [];

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
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">

        {/* ── Section 1: Progress Stepper ───────────────────────────── */}
        <div className="bg-white dark:bg-[#161616] rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-6">Pipeline Progress</h2>

          {/* Stepper */}
          <div className="flex items-start gap-0 overflow-x-auto pb-2">
            {STEPS.map((step, i) => {
              const state = stepStates[i];
              return (
                <div key={i} className="flex items-center min-w-0">
                  {/* Step node */}
                  <div className="flex flex-col items-center gap-2 px-1">
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all",
                      state === "pending" && "border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-800",
                      state === "active" && "border-blue-500 bg-blue-50 dark:bg-blue-950/30 shadow-lg shadow-blue-500/20",
                      state === "completed" && "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30",
                      state === "failed" && "border-red-500 bg-red-50 dark:bg-red-950/30",
                    )}>
                      {state === "pending" && (
                        <span className="text-xs font-bold text-gray-400">{i + 1}</span>
                      )}
                      {state === "active" && (
                        <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                      )}
                      {state === "completed" && (
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      )}
                      {state === "failed" && (
                        <XCircle className="w-5 h-5 text-red-500" />
                      )}
                    </div>
                    <span className={cn(
                      "text-[11px] font-medium text-center w-20 leading-tight",
                      state === "pending" && "text-gray-400",
                      state === "active" && "text-blue-600 dark:text-blue-400",
                      state === "completed" && "text-emerald-600 dark:text-emerald-400",
                      state === "failed" && "text-red-500",
                    )}>{step}</span>
                  </div>
                  {/* Connector */}
                  {i < STEPS.length - 1 && (
                    <div className={cn(
                      "flex-shrink-0 h-0.5 w-8 mt-[-18px] transition-colors",
                      stepStates[i] === "completed" ? "bg-emerald-400" : "bg-gray-200 dark:bg-gray-700"
                    )} />
                  )}
                </div>
              );
            })}
          </div>

          {/* Run button */}
          {!hasStarted && (
            <button
              id="btn-run-preprocessing"
              onClick={runPreprocessing}
              className="mt-6 flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition"
            >
              <Play className="w-4 h-4" /> Run Preprocessing
            </button>
          )}

          {isRunning && (
            <div className="mt-4 flex items-center gap-2 text-sm text-blue-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              Processing… please wait
            </div>
          )}

          {error && (
            <div className="mt-4 flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-600 dark:text-red-400">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
              <button
                onClick={runPreprocessing}
                className="ml-auto text-xs underline hover:no-underline"
              >
                Retry
              </button>
            </div>
          )}
        </div>

        {/* ── Section 2: Cluster Info + Before/After ─────────────── */}
        {isComplete && preprocessResult && (
          <>
            {/* Cluster Cards */}
            {preprocessResult.cluster_info.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
                  Cluster Summary ({preprocessResult.cluster_info.length} cluster{preprocessResult.cluster_info.length !== 1 ? "s" : ""})
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {preprocessResult.cluster_info.map(c => (
                    <ClusterCard key={c.cluster_id} info={c} />
                  ))}
                </div>
              </div>
            )}

            {/* Before / After Comparisons */}
            {filenames.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
                  Before / After Comparison
                  <span className="ml-2 text-gray-400 font-normal normal-case text-xs">
                    Drag the slider to compare
                  </span>
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {filenames.map(filename => (
                    <BeforeAfterSlider
                      key={filename}
                      label={filename}
                      original={getOriginalImageUrl(job_id, filename)}
                      processed={getProcessedImageUrl(job_id, filename)}
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
