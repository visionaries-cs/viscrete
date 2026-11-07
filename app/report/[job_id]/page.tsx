"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { getJob, generateReport, getReportUrl } from "@/lib/api";
import { Loader2, FileText } from "lucide-react";
import { ErrorAlert } from "@/components/ui/ErrorAlert";
import { Skeleton, SkeletonRegion } from "@/components/ui/skeleton";

type PageState = "checking" | "detected" | "generating" | "loading-pdf" | "completed" | "error";

export default function ReportPage() {
  const { job_id } = useParams<{ job_id: string }>();
  const router = useRouter();

  const [state, setState] = useState<PageState>("checking");
  const [error, setError] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

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
      const url = await getReportUrl(job_id);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job_id]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#14171e] flex flex-col">
      <main className="flex-1 flex flex-col">
        {/* Checking job status */}
        {state === "checking" && (
          <SkeletonRegion label="Loading report…" className="flex-1 flex justify-center p-6">
            <div className="w-full max-w-3xl rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-8 space-y-5">
              <div className="flex items-center gap-4">
                <Skeleton className="w-12 h-12 rounded-lg" />
                <div className="flex-1 space-y-2"><Skeleton className="h-5 w-1/2" /><Skeleton className="h-3 w-1/3" /></div>
              </div>
              <Skeleton className="h-px w-full" />
              <div className="grid grid-cols-3 gap-3">{[0, 1, 2].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
              <Skeleton className="h-48 w-full rounded-xl" />
              {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-3 w-full" />)}
              <Skeleton className="h-3 w-2/3" />
            </div>
          </SkeletonRegion>
        )}

        {/* Fetching PDF blob */}
        {state === "loading-pdf" && (
          <SkeletonRegion label="Loading PDF…" className="flex-1 flex justify-center p-6">
            <div className="w-full max-w-3xl rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-8 space-y-5">
              <div className="flex items-center gap-4">
                <Skeleton className="w-12 h-12 rounded-lg" />
                <div className="flex-1 space-y-2"><Skeleton className="h-5 w-1/2" /><Skeleton className="h-3 w-1/3" /></div>
              </div>
              <Skeleton className="h-px w-full" />
              <div className="grid grid-cols-3 gap-3">{[0, 1, 2].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
              <Skeleton className="h-48 w-full rounded-xl" />
              {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-3 w-full" />)}
              <Skeleton className="h-3 w-2/3" />
            </div>
          </SkeletonRegion>
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
                className="w-full bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-400 dark:bg-blue-950/40 dark:hover:bg-blue-950/60 dark:text-blue-400 dark:border-blue-600 text-sm font-semibold px-4 py-2.5 rounded-lg transition"
              >
                Generate Report
              </button>
            </div>
          </div>
        )}

        {/* Error */}
        {state === "error" && (
          <div className="flex-1 flex flex-col items-center justify-center p-6">
            <div className="max-w-md w-full space-y-3">
              <ErrorAlert error={error} title="Couldn't open the report" onRetry={checkJobStatus} />
              <button
                onClick={() => router.push("/upload")}
                className="text-sm text-blue-600 dark:text-blue-400 underline cursor-pointer"
              >
                ← Back to Upload
              </button>
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
