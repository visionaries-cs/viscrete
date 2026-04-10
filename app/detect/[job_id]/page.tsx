"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  detectJob,
  generateReport,
  type Detection,
} from "@/lib/api";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// Actual API shape (api.ts DetectResponse is outdated — flat, not per-file array)
interface DetectResponse {
  job_id: string;
  file_id: string;
  total_defects: number;
  detections: Detection[];
  annotated_paths: string[];
}
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  FileText,
  AlertTriangle,
  ImageIcon,
} from "lucide-react";

// ─── Types / Helpers ──────────────────────────────────────────────────────────

type Severity = "Low" | "Medium" | "High";

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

function countSeverity(detections: Detection[], sev: Severity) {
  return detections.filter(d => d.severity === sev).length;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DetectPage() {
  const { job_id } = useParams<{ job_id: string }>();
  const router = useRouter();

  const [isRunning, setIsRunning] = useState(false);
  const [hasRun, setHasRun] = useState(false);
  const [result, setResult] = useState<DetectResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [isGenerating, setIsGenerating] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  // Auto-run detection on mount
  useEffect(() => {
    runDetection();
  }, []);

  async function runDetection() {
    setIsRunning(true);
    setHasRun(false);
    setError(null);
    try {
      const data = await detectJob(job_id) as unknown as DetectResponse;
      setResult(data);
      setHasRun(true);
    } catch (e: unknown) {
      if (e instanceof Error && e.message.includes("409")) {
        setError("This step has already been completed.");
      } else if (e instanceof Error && e.message.includes("404")) {
        setError("Job not found.");
      } else {
        setError(e instanceof Error ? e.message : "Detection failed");
      }
    } finally {
      setIsRunning(false);
    }
  }

  async function handleGenerateReport() {
    setReportError(null);
    setIsGenerating(true);
    try {
      await generateReport(job_id);
      router.push(`/report/${encodeURIComponent(job_id)}`);
    } catch (e: unknown) {
      setReportError(e instanceof Error ? e.message : "Failed to generate report");
      setIsGenerating(false);
    }
  }

  const allDetections: Detection[] = result?.detections ?? [];

  const totalDefects = result?.total_defects ?? 0;
  const lowCount = countSeverity(allDetections, "Low");
  const midCount = countSeverity(allDetections, "Medium");
  const highCount = countSeverity(allDetections, "High");

  const annotatedPaths: string[] = result?.annotated_paths ?? [];

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
          <div className="flex-1">
            <h1 className="text-base font-bold text-gray-900 dark:text-white">Detection Results</h1>
            <p className="text-xs text-gray-400 font-mono">Job: {job_id}</p>
          </div>
          {hasRun && (
            <button
              id="btn-generate-report"
              onClick={handleGenerateReport}
              disabled={isGenerating}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition"
            >
              {isGenerating
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
                : <><FileText className="w-4 h-4" /> Generate Report</>
              }
            </button>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">

        {/* Loading state */}
        {isRunning && (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-gray-400">
            <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
            <p className="font-medium">Running YOLOv11 inference…</p>
            <p className="text-sm text-gray-400">This may take a moment</p>
          </div>
        )}

        {/* Error state */}
        {error && !isRunning && (
          <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-2xl p-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-red-700 dark:text-red-300 font-medium mb-2">{error}</p>
                {error.includes("not found") && (
                  <button onClick={() => router.push("/upload")} className="text-sm text-red-600 underline">
                    ← Back to Upload
                  </button>
                )}
                {!error.includes("completed") && !error.includes("not found") && (
                  <button onClick={runDetection} className="text-sm text-red-600 underline">
                    Retry Detection
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Report error */}
        {reportError && (
          <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-600 dark:text-red-400">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {reportError}
          </div>
        )}

        {/* Results */}
        {hasRun && result && (
          <>
            {/* Section 1 — Annotated Images Grid */}
            <section>
              <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
                Annotated Images
              </h2>
              {annotatedPaths.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400 bg-white dark:bg-[#161616] rounded-2xl border border-gray-200 dark:border-gray-800">
                  <ImageIcon className="w-10 h-10 mb-3" />
                  <p>No annotated images available</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {annotatedPaths.map(path => (
                    <AnnotatedImageCard
                      key={path}
                      path={path}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* Section 2 — Defect Table */}
            <section>
              <div className="flex items-center gap-4 mb-4">
                <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Defect Summary
                </h2>
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    {totalDefects} defect{totalDefects !== 1 ? "s" : ""} detected
                  </span>
                  <span className="text-gray-300 dark:text-gray-600">•</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">{lowCount} Low</span>
                  <span className="text-gray-300 dark:text-gray-600">•</span>
                  <span className="text-amber-600 dark:text-amber-400 font-medium">{midCount} Medium</span>
                  <span className="text-gray-300 dark:text-gray-600">•</span>
                  <span className="text-red-500 dark:text-red-400 font-medium">{highCount} High</span>
                </div>
              </div>

              <div className="bg-white dark:bg-[#161616] rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
                {allDetections.length === 0 ? (
                  <div className="py-12 text-center text-gray-400">
                    <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
                    <p>No defects detected</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 dark:border-gray-800">
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Defect Type</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Confidence</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Severity</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Crack Width</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Area</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allDetections.map((d, i) => (
                          <tr
                            key={i}
                            className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition"
                          >
                            <td className="px-4 py-3">
                              <span className="text-gray-800 dark:text-gray-200 font-medium capitalize">{d.defect_type}</span>
                            </td>
                            <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{Math.round(d.confidence * 100)}%</td>
                            <td className="px-4 py-3">{severityBadge(d.severity)}</td>
                            <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                              {d.crack_width_mm != null ? `${d.crack_width_mm.toFixed(1)} mm` : "—"}
                            </td>
                            <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                              {d.area_px != null ? `${d.area_px.toLocaleString()} px²` : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>

            {/* Generate Report (bottom) */}
            <div className="flex justify-end">
              <button
                id="btn-generate-report-bottom"
                onClick={handleGenerateReport}
                disabled={isGenerating}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold transition shadow-lg shadow-blue-600/20"
              >
                {isGenerating
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating Report…</>
                  : <><FileText className="w-4 h-4" /> Generate Report</>
                }
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

// ─── Annotated Image Card ─────────────────────────────────────────────────────

function AnnotatedImageCard({ path }: { path: string }) {
  const src = `${API_BASE_URL}/static/${path}`;
  const label = path.split("/").pop() ?? path;

  return (
    <div className="bg-white dark:bg-[#161616] rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
      <div className="aspect-video bg-gray-100 dark:bg-gray-900 relative overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={label}
          className="w-full h-full object-cover"
        />
      </div>
      <div className="px-3 py-2.5">
        <span className="text-xs text-gray-600 dark:text-gray-400 truncate block font-medium">{label}</span>
      </div>
    </div>
  );
}
