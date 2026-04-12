"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { getReport, getAnnotatedImageUrl, type ReportResponse } from "@/lib/api";
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  MapPin,
  Calendar,
  User,
  Briefcase,
  FileText,
  Shield,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { ModeToggle } from "@/components/ui/mode-toggle";

// ─── Helpers ─────────────────────────────────────────────────────────────────

type Severity = "Low" | "Medium" | "High";

function severityBadge(s: Severity | null | undefined) {
  if (!s) return <span className="text-gray-400">—</span>;
  const cls = {
    Low: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    Medium: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    High: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  }[s];
  return <span className={cn("px-2 py-0.5 rounded-full text-[11px] font-bold", cls)}>{s}</span>;
}

function SummaryMetric({ label, value, sub, accent }: {
  label: string; value: string; sub?: string; accent?: string;
}) {
  return (
    <div className="bg-gray-50 dark:bg-gray-900 rounded-xl px-5 py-4 border border-gray-100 dark:border-gray-800">
      <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">{label}</p>
      <p className={cn("text-2xl font-bold", accent ?? "text-gray-800 dark:text-white")}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-PH", {
    month: "long", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReportPage() {
  const { job_id } = useParams<{ job_id: string }>();
  const router = useRouter();

  const [report, setReport] = useState<ReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadReport();
  }, [job_id]);

  async function loadReport() {
    setLoading(true);
    setError(null);
    try {
      const data = await getReport(job_id);
      setReport(data);
    } catch (e: unknown) {
      if (e instanceof Error && e.message.includes("404")) {
        setError("Report not found. The job may not have completed all steps.");
      } else {
        setError(e instanceof Error ? e.message : "Failed to load report");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a]">
      {/* Header */}
      <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-[#111] print:hidden">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-base font-bold text-gray-900 dark:text-white">Inspection Report</h1>
            <p className="text-xs text-gray-400 font-mono">Job: {job_id}</p>
          </div>
          {report && (
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900 transition"
            >
              <FileText className="w-4 h-4" /> Print / Save PDF
            </button>
          )}
          <ModeToggle />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-8 print:py-4">
        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-gray-400">
            <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
            <p className="font-medium">Loading report…</p>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-2xl p-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-red-700 dark:text-red-300 font-medium mb-2">{error}</p>
                <button onClick={() => router.push("/upload")} className="text-sm text-red-600 underline">
                  ← Back to Upload
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Report content */}
        {report && !loading && (
          <>
            {/* ── Report Header ─────────────────────────────────────── */}
            <div className="bg-white dark:bg-[#161616] rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-6 print:shadow-none print:border-gray-400">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Shield className="w-5 h-5 text-blue-500" />
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Concrete Inspection Report</h2>
                  </div>
                  <p className="text-xs text-gray-400 font-mono">Report ID: {report.report_id}</p>
                </div>
                <div className="text-right text-xs text-gray-400">
                  <p className="font-mono">Job: {report.job_id}</p>
                  <p>{formatDate(report.generated_at)}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <Briefcase className="w-4 h-4 text-gray-400" />
                  <span className="font-medium">Site:</span>
                  <span>{report.site_name}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <User className="w-4 h-4 text-gray-400" />
                  <span className="font-medium">Inspector:</span>
                  <span>{report.inspector_name}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <span className="font-medium">Date:</span>
                  <span>{formatDate(report.generated_at)}</span>
                </div>
              </div>
            </div>

            {/* ── Summary Card ──────────────────────────────────────── */}
            <div className="bg-white dark:bg-[#161616] rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-6">
              <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">Summary</h3>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <SummaryMetric
                  label="Total Defects"
                  value={String(report.total_defects)}
                  accent={report.total_defects > 0 ? "text-red-500" : "text-emerald-600"}
                />
                <SummaryMetric
                  label="Dominant Severity"
                  value={report.dominant_severity ?? "None"}
                  accent={
                    report.dominant_severity === "High" ? "text-red-500" :
                    report.dominant_severity === "Medium" ? "text-amber-500" :
                    report.dominant_severity === "Low" ? "text-emerald-600" : "text-gray-400"
                  }
                />
                <SummaryMetric
                  label="Defect Types"
                  value={report.defect_types_found.length > 0 ? report.defect_types_found.join(", ") : "None"}
                />
                <div className="bg-gray-50 dark:bg-gray-900 rounded-xl px-5 py-4 border border-gray-100 dark:border-gray-800">
                  <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Severity Breakdown</p>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-emerald-600 font-medium">Low</span>
                      <span className="font-bold text-gray-700 dark:text-gray-300">{report.severity_breakdown.Low}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-amber-500 font-medium">Medium</span>
                      <span className="font-bold text-gray-700 dark:text-gray-300">{report.severity_breakdown.Medium}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-red-500 font-medium">High</span>
                      <span className="font-bold text-gray-700 dark:text-gray-300">{report.severity_breakdown.High}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── GPS Locations ─────────────────────────────────────── */}
            {report.gps_locations.length > 0 && (
              <div className="bg-white dark:bg-[#161616] rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-6">
                <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
                  GPS Locations
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {report.gps_locations.map((loc, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900"
                    >
                      <MapPin className="w-4 h-4 text-blue-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{loc.filename}</p>
                        <p className="text-sm font-medium text-gray-800 dark:text-white">
                          {loc.lat.toFixed(6)}, {loc.lng.toFixed(6)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Full Defect Table ─────────────────────────────────── */}
            <div className="bg-white dark:bg-[#161616] rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800">
                <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Defect Details
                </h3>
              </div>
              {report.defects.length === 0 ? (
                <div className="py-12 text-center text-gray-400">
                  <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
                  <p>No defects detected</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">File</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Defect Type</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Confidence</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Severity</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Crack Width</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Area</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.defects.map((d, i) => (
                        <tr
                          key={i}
                          className="border-b border-gray-50 dark:border-gray-800/50 last:border-0"
                        >
                          <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs truncate max-w-[120px]">{d.filename}</td>
                          <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-200 capitalize">{d.defect_type}</td>
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

            {/* ── Annotated Images ──────────────────────────────────── */}
            {report.annotated_filenames.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
                  Annotated Images
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {report.annotated_filenames.map(fn => (
                    <div
                      key={fn}
                      className="bg-white dark:bg-[#161616] rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden"
                    >
                      <div className="aspect-video bg-gray-100 dark:bg-gray-900">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={getAnnotatedImageUrl(job_id, fn)}
                          alt={fn}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400 truncate font-medium">{fn}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
