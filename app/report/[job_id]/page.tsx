"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  RefreshCw,
} from "lucide-react";

import AppNav from "@/components/AppNav";
import { PageHeader } from "@/components/app/PageHeader";
import { WorkflowRail } from "@/components/app/WorkflowRail";
import { Button } from "@/components/ui/button";
import { generateReport, getJob, getReportUrl } from "@/lib/api";

type PageState =
  | "checking"
  | "detected"
  | "generating"
  | "loading-pdf"
  | "completed"
  | "error";

export default function ReportPage() {
  const { job_id } = useParams<{ job_id: string }>();
  const router = useRouter();
  const [state, setState] = useState<PageState>("checking");
  const [error, setError] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  async function loadPdf() {
    setState("loading-pdf");
    try {
      const url = await getReportUrl(job_id);
      setBlobUrl(url);
      setState("completed");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to load PDF");
      setState("error");
    }
  }

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
        setError(
          `This report is not ready because the inspection is currently “${job.status}”. Complete detection first.`,
        );
        setState("error");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to load job status");
      setState("error");
    }
  }

  async function handleGenerateReport(regenerate = false) {
    setState("generating");
    setError(null);
    try {
      await generateReport(job_id, regenerate);
      await loadPdf();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to generate report");
      setState("error");
    }
  }

  useEffect(() => {
    void checkJobStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job_id]);

  const loadingCopy = {
    checking: ["Checking report status", "Confirming the inspection is ready for reporting."],
    "loading-pdf": ["Opening report", "Loading the latest inspection PDF."],
    generating: ["Building inspection report", "Compiling evidence, findings, and remarks into a PDF."],
  } as const;

  return (
    <div className="app-page flex min-h-screen flex-col">
      <AppNav
        subtitle="Inspection report"
        left={
          <button
            className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
            onClick={() => router.push(`/results/${encodeURIComponent(job_id)}`)}
            aria-label="Back to detection review"
          >
            <ArrowLeft className="size-4" />
          </button>
        }
      />

      <main className="page-container page-main flex min-h-0 flex-1 flex-col gap-5">
        <PageHeader
          eyebrow="Reporting"
          title="Inspection report"
          description="Review the completed document, regenerate it after changes, or download a copy for distribution."
          meta={<span>Job {job_id.slice(0, 8)}</span>}
          actions={<WorkflowRail current="report" />}
        />

        {state in loadingCopy && (
          <section className="surface-panel flex min-h-[26rem] flex-1 flex-col items-center justify-center px-6 text-center">
            <Loader2 className="mb-5 size-9 animate-spin text-primary" />
            <h2 className="text-lg font-semibold text-foreground">
              {loadingCopy[state as keyof typeof loadingCopy][0]}
            </h2>
            <p className="mt-1 max-w-md text-sm leading-6 text-muted-foreground">
              {loadingCopy[state as keyof typeof loadingCopy][1]}
            </p>
          </section>
        )}

        {state === "detected" && (
          <section className="surface-panel mx-auto flex min-h-[26rem] w-full max-w-2xl flex-col items-center justify-center px-6 py-12 text-center">
            <div className="mb-5 flex size-14 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10">
              <FileText className="size-6 text-primary" />
            </div>
            <p className="section-kicker mb-2">Ready to publish</p>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">
              Create the inspection report
            </h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
              Detection is complete. The report will include inspection details, defect evidence,
              metrics, locations, and saved remarks.
            </p>
            <Button className="mt-7 w-full sm:w-auto" size="lg" onClick={() => handleGenerateReport()}>
              <FileText className="size-4" />
              Generate PDF report
            </Button>
          </section>
        )}

        {state === "error" && (
          <section className="surface-panel mx-auto flex w-full max-w-2xl items-start gap-4 border-destructive/25 p-6">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-destructive/10">
              <AlertCircle className="size-5 text-destructive" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold text-foreground">Report unavailable</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{error}</p>
              <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                <Button variant="outline" onClick={() => void checkJobStatus()}>
                  <RefreshCw className="size-4" />
                  Try again
                </Button>
                <Button variant="ghost" onClick={() => router.push(`/results/${encodeURIComponent(job_id)}`)}>
                  Return to review
                </Button>
              </div>
            </div>
          </section>
        )}

        {state === "completed" && blobUrl && (
          <section className="surface-panel flex min-h-[42rem] flex-1 flex-col overflow-hidden">
            <div className="flex flex-col gap-4 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/10">
                  <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Report ready</h2>
                  <p className="text-xs text-muted-foreground">The latest PDF is shown below.</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:flex">
                <Button variant="outline" onClick={() => void handleGenerateReport(true)}>
                  <RefreshCw className="size-4" />
                  Regenerate
                </Button>
                <Button asChild>
                  <a href={blobUrl} download={`viscrete-report-${job_id.slice(0, 8)}.pdf`}>
                    <Download className="size-4" />
                    Download
                  </a>
                </Button>
                <Button variant="ghost" className="col-span-2 sm:px-3" asChild>
                  <a href={blobUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="size-4" />
                    Open separately
                  </a>
                </Button>
              </div>
            </div>
            <iframe
              src={blobUrl}
              className="min-h-[36rem] flex-1 border-0 bg-muted/30"
              title="Inspection report PDF"
            />
          </section>
        )}
      </main>
    </div>
  );
}
