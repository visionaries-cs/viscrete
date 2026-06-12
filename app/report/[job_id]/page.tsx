"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { getJob, generateReport, getAuthHeaders, API_BASE_URL } from "@/lib/api";
import { Loader2, AlertCircle, FileText } from "lucide-react";

type PageState = "checking" | "detected" | "generating" | "loading-pdf" | "completed" | "error";

export default function ReportPage() {
  const { job_id } = useParams<{ job_id: string }>();
  const router = useRouter();

  const [state, setState] = useState<PageState>("checking");
  const [error, setError] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  const apiUrl = `${API_BASE_URL}/api/v1/jobs/${job_id}/report`;

  async function checkJobStatus() {
    setState("checking");
    setError(null);
    try {
      const job = await getJob(job_id);
      if (job.status === "completed") {
        await loadPdf();
      } else if (job.status === "detected" || job.status === "reporting") {
        setState("detected");
      } else {
        setError(`Cannot generate report: job is in "${job.status}" state. Detection must complete first.`);
        setState("error");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load job status");
      setState("error");
    }
  }

  async function loadPdf() {
    setState("loading-pdf");
    try {
      const res = await fetch(apiUrl, { headers: await getAuthHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
      blobUrlRef.current = url;
      setBlobUrl(url);
      setState("completed");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load PDF");
      setState("error");
    }
  }

  async function handleGenerateReport(regenerate = false) {
    setState("generating");
    setError(null);
    try {
      await generateReport(job_id, regenerate);
      await loadPdf();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate report");
      setState("error");
    }
  }

  useEffect(() => {
    checkJobStatus();
    return () => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job_id]);

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex flex-col">
      <main className="flex-1 flex flex-col">
        {/* Checking job status */}
        {state === "checking" && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-gray-400">
            <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
            <p className="font-medium">Loading…</p>
          </div>
        )}

        {/* Fetching PDF blob */}
        {state === "loading-pdf" && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-gray-400">
            <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
            <p className="font-medium text-gray-700 dark:text-gray-300">Loading PDF…</p>
          </div>
        )}

        {/* Generating PDF */}
        {state === "generating" && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-gray-400">
            <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
            <p className="font-medium text-gray-700 dark:text-gray-300">Creating PDF Report…</p>
            <p className="text-sm">This may take a moment for large jobs.</p>
          </div>
        )}

        {/* Detected — prompt user to generate */}
        {state === "detected" && (
          <div className="flex-1 flex flex-col items-center justify-center p-6">
            <div className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 p-8 text-center max-w-sm w-full">
              <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center mx-auto mb-4">
                <FileText className="w-6 h-6 text-blue-500" />
              </div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Generate Inspection Report</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                Detection is complete. Generate a PDF report of the inspection results.
              </p>
              <button
                onClick={() => handleGenerateReport()}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition"
              >
                Generate Report
              </button>
            </div>
          </div>
        )}

        {/* Error */}
        {state === "error" && (
          <div className="flex-1 flex flex-col items-center justify-center p-6">
            <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-2xl p-6 max-w-md w-full">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-red-700 dark:text-red-300 font-medium mb-3">{error}</p>
                  <button
                    onClick={() => router.push("/upload")}
                    className="text-sm text-red-600 dark:text-red-400 underline"
                  >
                    ← Back to Upload
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Completed — inline PDF preview via blob URL */}
        {state === "completed" && blobUrl && (
          <iframe
            src={blobUrl}
            className="flex-1 w-full border-none"
            style={{ minHeight: "80vh" }}
            title="Inspection Report PDF"
          />
        )}
      </main>
    </div>
  );
}
