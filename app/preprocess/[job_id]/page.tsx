"use client";

import { useState, useEffect, useRef } from "react";
import { getAuthHeaders } from "@/lib/api";
import { useParams, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { BeforeAfterToggle } from "@/components/preprocess/BeforeAfterToggle";
import { ClusterCard } from "@/components/preprocess/ClusterCard";
import { PreprocessingStepper } from "@/components/preprocess/PreprocessingStepper";
import { PreprocessingTerminal } from "@/components/preprocess/PreprocessingTerminal";
import {
  CheckCircle2,
  XCircle,
  ArrowLeft,
  ArrowRight,
  AlertCircle,
  Clock,
} from "lucide-react";
import AppNav from "@/components/AppNav";
import { PageHeader } from "@/components/app/PageHeader";
import { WorkflowRail } from "@/components/app/WorkflowRail";
import { Button } from "@/components/ui/button";

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
  input_type: string;
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
  pipeline_type: string;
  total_processed: number;
  pipeline_steps: PipelineStep[];
  cluster_info: ClusterInfo[];
  cii_scores?: CiiScoreEntry[];
}

// â”€â”€â”€ Constants â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
  "Cluster Assignment",
  "MOCS Optimization",
  "CLAHE Enhancement",
];

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€ BeforeAfterToggle â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€


// â”€â”€â”€ Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
  const [elapsedSecs, setElapsedSecs] = useState(0);
  const [retryCount, setRetryCount] = useState(0);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Elapsed timer â€” driven by isRunning
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

  // Sync completedSummary.duration_sec from step sum whenever result is set/updated
  useEffect(() => {
    if (!result?.pipeline_steps?.length) return;
    const stepSum = result.pipeline_steps.reduce((acc, s) => acc + s.duration_sec, 0);
    setCompletedSummary(prev => prev ? { ...prev, duration_sec: stepSum } : prev);
  }, [result]);

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

  // â”€â”€ Master effect: fetch job + WebSocket + polling fallback â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    let cancelled = false;
    let ws: WebSocket | null = null;
    let pollInterval: ReturnType<typeof setInterval> | null = null;
    let receivedCompleted = false;

    // â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

    // â”€â”€ Result fetch (called after completed event) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    async function fetchResults() {
      const delays = [0, 1000, 2000, 4000];
      for (let attempt = 0; attempt < delays.length; attempt++) {
        if (delays[attempt] > 0) {
          await new Promise((resolve) => setTimeout(resolve, delays[attempt]));
        }
        if (cancelled) return;
        try {
          const res = await fetch(
            `${API_BASE_URL}/api/v1/jobs/${encodeURIComponent(job_id)}/preprocess`,
            { headers: await getAuthHeaders() }
          );
          if (cancelled) return;
          if (res.status === 404) continue; // not persisted yet â€” retry
          if (!res.ok) break;              // unexpected error â€” stop
          const r: PreprocessResult = await res.json();
          if (cancelled) return;
          setResult(r);
          try {
            localStorage.setItem(
              `preprocess_result_${job_id}`,
              JSON.stringify(r)
            );
          } catch { /* quota */ }
          return;
        } catch {
          if (cancelled) return;
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

    // â”€â”€ Polling fallback â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    function startPolling() {
      if (pollInterval) return; // already polling
      pollInterval = setInterval(async () => {
        if (cancelled) return;
        try {
          const res = await fetch(
            `${API_BASE_URL}/api/v1/jobs/${encodeURIComponent(job_id)}`,
            { headers: await getAuthHeaders() }
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
              // No step details â€” mark all completed
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
        } catch { /* transient network error â€” keep polling */ }
      }, 3000);
      pollRef.current = pollInterval;
    }

    // â”€â”€ WebSocket message handler â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
            // Preserve steps already completed/failed â€” only reset still-pending ones
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
            message: `â–¶ ${name} started`,
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
            message: `âœ“ ${name} completed in ${duration_sec}s${detail ? ` â€” ${detail}` : ""}`,
          });
          break;
        }

        case "step_progress": {
          // No terminal output â€” only update progress bar
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
              message: `âœ— ${message}`,
            });
            setIsRunning(false);
            ws?.close();
          } else {
            addLine({
              timestamp: ts,
              step,
              name,
              level: "warning",
              message: `âš  ${message}`,
            });
          }
          break;
        }

        case "completed": {
          receivedCompleted = true;
          const total_processed = msg.total_processed as number;
          const pipeline_type = msg.pipeline_type as string;
          const duration_sec = (msg.duration_sec as number) ?? 0;
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

        case "ping":
          break; // keepalive from backend â€” no action needed
      }
    }

    // â”€â”€ Start WebSocket connection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    function startWS(inputType: string) {
      // Pre-populate with fallback step names (overwritten once pipeline_init fires)
      setStepStates(makePendingSteps(IMAGE_STEPS));

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
          if (isReconnect) return; // server replays buffered events â€” no POST needed
          setIsRunning(true);
          try {
            const res = await fetch(
              `${API_BASE_URL}/api/v1/jobs/${encodeURIComponent(
                job_id
              )}/preprocess`,
              { method: "POST", headers: await getAuthHeaders() }
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
            // 202 â†’ pipeline streams events via WS
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
          } catch { /* malformed JSON â€” ignore */ }
        };

        ws.onerror = () => {
          // onclose fires after onerror â€” handled there
        };

        ws.onclose = () => {
          if (receivedCompleted || cancelled) return;
          if (!pipelineStarted) return; // POST failed or never sent â€” do not reconnect
          if (reconnectAttempts < 2) {
            reconnectAttempts++;
            const delay = reconnectAttempts * 1500;
            addPipelineLine(
              `WebSocket closed â€” reconnecting in ${delay / 1000}sâ€¦`
            );
            setTimeout(() => connect(true), delay);
          } else {
            addPipelineLine("WebSocket unavailable â€” switched to polling");
            startPolling();
          }
        };
      }

      connect(false);
    }

    // â”€â”€ Load already-complete job â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    async function loadCompletedJob(data: JobStatus) {
      // Fetch from the dedicated endpoint (always authoritative)
      try {
        const res = await fetch(
          `${API_BASE_URL}/api/v1/jobs/${encodeURIComponent(job_id)}/preprocess`,
          { headers: await getAuthHeaders() }
        );
        if (!cancelled && res.ok) {
          const r: PreprocessResult = await res.json();
          if (!cancelled && r?.pipeline_steps?.length) {
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
            setIsComplete(true);
            return;
          }
        }
      } catch { /* network error â€” fall through to fallback */ }

      if (cancelled) return;

      // Fallback: show step names without timing data
      setStepStates(
        makePendingSteps(IMAGE_STEPS).map((s) => ({
          ...s,
          status: "completed" as StepStatus,
        }))
      );
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
      setIsComplete(true);
    }

    // â”€â”€ Fetch job metadata and branch â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    async function fetchJob() {
      try {
        const res = await fetch(
          `${API_BASE_URL}/api/v1/jobs/${encodeURIComponent(job_id)}`,
          { headers: await getAuthHeaders() }
        );
        if (cancelled) return;
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: JobStatus = await res.json();
        if (cancelled) return;

        setJobMeta(data);

        if (ALREADY_PREPROCESSED.has(data.status)) {
          await loadCompletedJob(data);
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

  // â”€â”€ Derived: before/after image list â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
          originalKey: (f as unknown as Record<string, string>).original_path
            ?? `${job_id}/original/${storedName}`,
          processedKey: (f as unknown as Record<string, string>).processed_path
            ?? `${job_id}/processed/${storedName}`,
          ciiScore: cii?.cii_score ?? null,
          originalContrast: cii?.original_contrast ?? null,
          processedContrast: cii?.processed_contrast ?? null,
        };
      }) ?? [];

  // â”€â”€ Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  return (
    <div className="app-page">
      <AppNav
        subtitle="Image enhancement"
        left={
          <button
            onClick={() => router.push('/upload')}
            className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
            aria-label="Back to upload"
          >
            <ArrowLeft className="size-4" />
          </button>
        }
      />

      <main className="page-container page-main space-y-7">
        <PageHeader
          eyebrow="Image enhancement"
          title={isComplete ? "Preprocessing complete" : "Preprocessing inspection images"}
          description={isComplete
            ? "The enhanced files and quality metrics are ready for defect review."
            : "VISCRETE is optimizing local contrast while preserving the visual characteristics used for defect detection."
          }
          meta={<span className="font-mono">{job_id}</span>}
          actions={<WorkflowRail current="preprocess" />}
        />
        {/* Meta fetch error */}
        {metaError && (
          <div className="flex items-center gap-2 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl text-sm text-amber-700 dark:text-amber-300">
            <AlertCircle className="w-4 h-4 shrink-0" />
            Could not load job info: {metaError}
          </div>
        )}

        {/* â”€â”€ Section 1: Pipeline progress + stepper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(22rem,0.85fr)]">
        <div className="surface-panel p-5 sm:p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="section-kicker">Pipeline status</p>
              <h2 className="mt-2 text-base font-semibold text-foreground">Enhancement progress</h2>
            </div>
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

        </div>

        {/* â”€â”€ Section 2: Terminal log â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <PreprocessingTerminal lines={terminalLines} />
        </div>

        {/* â”€â”€ Section 3: Results (shown after completion) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        {isComplete && (
          <>
            {/* Cluster summary + step timing â€” always expanded */}
            {result && (result.cluster_info?.length > 0 || result.pipeline_steps?.length > 0) && (
              <div className="surface-panel overflow-hidden">
                <div className="flex items-center gap-3 px-4 sm:px-6 py-4 border-b border-gray-100 dark:border-gray-800">
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

                <div className="px-4 sm:px-6 pb-6 space-y-4 pt-4">
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
              </div>
            )}

            {/* Before / After image comparisons */}
            {imageFiles.length > 0 && (
              <div>
                <p className="section-kicker">Quality review</p>
                <div className="mb-4 mt-2 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                  <h2 className="text-base font-semibold text-foreground">Before and after</h2>
                  <span className="text-xs text-muted-foreground">Toggle each image to compare the enhancement.</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {imageFiles.map(
                    ({
                      label,
                      originalKey,
                      processedKey,
                      ciiScore,
                      originalContrast,
                      processedContrast,
                    }) => (
                      <BeforeAfterToggle
                        key={label}
                        jobId={job_id}
                        label={label}
                        originalKey={originalKey}
                        processedKey={processedKey}
                        ciiScore={ciiScore}
                        originalContrast={originalContrast}
                        processedContrast={processedContrast}
                      />
                    )
                  )}
                </div>
              </div>
            )}

          </>
        )}
      </main>

      {/* Floating proceed bar â€” fixed at bottom once pipeline is complete */}
      {isComplete && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center border-t bg-background/95 px-4 py-3 backdrop-blur sm:bottom-5 sm:border-0 sm:bg-transparent sm:py-0">
          <div className="surface-panel pointer-events-auto flex w-full max-w-2xl items-center gap-4 px-4 py-3 sm:px-5">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                Preprocessing complete
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                Ready to run defect detection
              </p>
            </div>
            <Button
              id="btn-proceed-detection"
              onClick={() => router.push(`/results/${encodeURIComponent(job_id)}`)}
              className="shrink-0"
            >
              Review detections
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
