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
  ArrowRight,
  Clock,
} from "lucide-react";
import AppNav from "@/components/AppNav";
import { ErrorAlert } from "@/components/ui/ErrorAlert";

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Constants ────────────────────────────────────────────────────────────────

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

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

// ─── BeforeAfterToggle ────────────────────────────────────────────────────────


// ─── Page ─────────────────────────────────────────────────────────────────────

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

  // Elapsed timer — driven by isRunning
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

  // ── Master effect: fetch job + WebSocket + polling fallback ──────────────────
  useEffect(() => {
    let cancelled = false;
    let ws: WebSocket | null = null;
    let pollInterval: ReturnType<typeof setInterval> | null = null;
    let eventsInterval: ReturnType<typeof setInterval> | null = null;
    let receivedCompleted = false;

    // ── Helpers ──────────────────────────────────────────────────────────────

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

    // ── Result fetch (called after completed event) ───────────────────────────

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
          if (res.status === 404) continue; // not persisted yet — retry
          if (!res.ok) break;              // unexpected error — stop
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

    // ── Polling fallback ──────────────────────────────────────────────────────

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
            stopEvents();
            setIsRunning(false);
            if (!receivedCompleted) await loadCompletedJob(data);
          } else if (data.status === "failed") {
            clearInterval(pollInterval!);
            pollInterval = null;
            stopEvents();
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
        } catch { /* transient network error — keep polling */ }
      }, 3000);
      pollRef.current = pollInterval;
    }

    // ── Progress events over HTTP (when a WebSocket can't connect) ────────────
    // Same events the WebSocket would send, fetched every second with ?after=<last seq>.

    function stopEvents() {
      if (eventsInterval) clearInterval(eventsInterval);
      eventsInterval = null;
    }

    function startEvents() {
      if (eventsInterval) return;
      let lastSeq = 0;
      let inFlight = false;
      eventsInterval = setInterval(async () => {
        if (cancelled || inFlight) return;
        inFlight = true;
        try {
          const res = await fetch(
            `${API_BASE_URL}/api/v1/jobs/${encodeURIComponent(job_id)}/preprocess/events?after=${lastSeq}`,
            { headers: await getAuthHeaders() }
          );
          if (!res.ok || cancelled) return;
          const { events } = (await res.json()) as { events: Array<Record<string, unknown>> };
          for (const msg of events) {
            if (cancelled) return;
            lastSeq = Math.max(lastSeq, (msg.seq as number) ?? 0);
            handleMsg(msg);
            if (msg.type === "completed" || (msg.type === "error" && msg.fatal)) stopEvents();
          }
        } catch { /* transient network error — try again next tick */ }
        finally { inFlight = false; }
      }, 1000);
    }

    // ── WebSocket message handler ─────────────────────────────────────────────

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
            // Preserve steps already completed/failed — only reset still-pending ones
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
            message: `▶ ${name} started`,
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
            message: `✓ ${name} completed in ${duration_sec}s${detail ? ` — ${detail}` : ""}`,
          });
          break;
        }

        case "step_progress": {
          // No terminal output — only update progress bar
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
              message: `✗ ${message}`,
            });
            setIsRunning(false);
            ws?.close();
          } else {
            addLine({
              timestamp: ts,
              step,
              name,
              level: "warning",
              message: `⚠ ${message}`,
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
          break; // keepalive from backend — no action needed
      }
    }

    // ── Start WebSocket connection ─────────────────────────────────────────────

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
      let opened = false;

      // POST /preprocess; false if the job can't start
      async function startPipeline(): Promise<boolean> {
        setIsRunning(true);
        try {
          const res = await fetch(
            `${API_BASE_URL}/api/v1/jobs/${encodeURIComponent(job_id)}/preprocess`,
            { method: "POST", headers: await getAuthHeaders() }
          );
          if (cancelled) return false;
          if (res.ok) return true;
          const msg = res.status === 409 ? "Job is not ready for preprocessing." : `Couldn't start preprocessing (HTTP ${res.status}).`;
          setGlobalError(msg);
          addPipelineLine(`Error: ${msg}`, "error");
        } catch (e) {
          if (cancelled) return false;
          const errMsg = e instanceof Error ? e.message : "Failed to start preprocessing";
          setGlobalError(errMsg);
          addPipelineLine(`Error: ${errMsg}`, "error");
        }
        setIsRunning(false);
        return false;
      }

      async function connect(isReconnect: boolean) {
        // Browsers can't set headers on WebSockets — the backend reads the JWT from ?token=
        const auth = await getAuthHeaders();
        // Through the zrok tunnel the handshake needs zrok's cookie; the backend sets it here.
        if (/^https:/i.test(API_BASE_URL)) {
          await fetch(`${API_BASE_URL}/ws-cookie`, {
            credentials: "include",
            headers: { skip_zrok_interstitial: "true" },
          }).catch(() => { /* no cookie: the 1 s fallback still shows progress */ });
        }
        if (cancelled) return;
        const token = (auth.Authorization ?? "").replace(/^Bearer /, "");
        ws = new WebSocket(`${wsUrl}?token=${encodeURIComponent(token)}`);

        ws.onopen = async () => {
          opened = true;
          if (cancelled) { ws?.close(); return; }
          if (isReconnect) return; // server replays buffered events — no POST needed
          if (await startPipeline()) pipelineStarted = true; // 202 -> events stream over WS
          else ws?.close();
        };

        ws.onmessage = (event) => {
          try {
            handleMsg(
              JSON.parse(event.data) as Record<string, unknown>,
              isReconnect
            );
          } catch { /* malformed JSON — ignore */ }
        };

        ws.onerror = () => {
          // onclose fires after onerror — handled there
        };

        ws.onclose = () => {
          if (receivedCompleted || cancelled) return;
          // WS never opened (e.g. the zrok interstitial blocks browser WebSockets): start over HTTP and poll
          if (!opened && !isReconnect) {
            addPipelineLine("Live connection blocked — showing progress every 1 s");
            startPipeline().then((ok) => { if (ok) { pipelineStarted = true; startEvents(); startPolling(); } });
            return;
          }
          if (!pipelineStarted) return; // POST failed or never sent — do not reconnect
          if (reconnectAttempts < 2) {
            reconnectAttempts++;
            const delay = reconnectAttempts * 1500;
            addPipelineLine(
              `WebSocket closed — reconnecting in ${delay / 1000}s…`
            );
            setTimeout(() => connect(true), delay);
          } else {
            addPipelineLine("WebSocket unavailable — showing progress every 1 s");
            startEvents();
            startPolling();
          }
        };
      }

      connect(false);
    }

    // ── Load already-complete job ─────────────────────────────────────────────

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
      } catch { /* network error — fall through to fallback */ }

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

    // ── Fetch job metadata and branch ─────────────────────────────────────────

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
        } else if (data.status === "preprocessing") {
          // Already running (reopened page, second tab): watch it instead of POSTing again (409)
          setStepStates(makePendingSteps(IMAGE_STEPS));
          setIsRunning(true);
          addPipelineLine("Preprocessing is already running — following its progress");
          startEvents();
          startPolling();
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
      stopEvents();
      if (pollInterval) clearInterval(pollInterval);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [job_id, retryCount]); // retryCount forces re-run on manual retry

  // ── Derived: before/after image list ─────────────────────────────────────────

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

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#14171e]">
      <AppNav
        back={`/upload-review/${encodeURIComponent(job_id)}`}
        section="preprocessing"
        title="Preprocessing"
        subtitle={<span className="font-mono">Job {job_id.slice(0, 8)}…</span>}
      />

      <main className="max-w-5xl mx-auto px-3 sm:px-6 py-8 space-y-6">
        {/* Meta fetch error */}
        <ErrorAlert error={metaError} title="Couldn't load job info" />

        {/* ── Section 1: Pipeline progress + stepper ──────────────────── */}
        <div className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Pipeline Progress
            </h2>
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
          <ErrorAlert error={globalError} title="Preprocessing stopped" onRetry={handleRetry} className="mt-5" />

        </div>

        {/* ── Section 2: Terminal log ──────────────────────────────────── */}
        <PreprocessingTerminal lines={terminalLines} />

        {/* ── Section 3: Results (shown after completion) ─────────────── */}
        {isComplete && (
          <>
            {/* Cluster summary + step timing — always expanded */}
            {result && (result.cluster_info?.length > 0 || result.pipeline_steps?.length > 0) && (
              <div className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
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
                <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
                  Before / After Comparison
                  <span className="ml-2 text-gray-400 font-normal normal-case text-xs">
                    Toggle to compare original vs processed
                  </span>
                </h2>
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

      {/* Floating proceed bar — fixed at bottom once pipeline is complete */}
      {isComplete && (
        <div className="fixed bottom-6 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none">
          <div className="pointer-events-auto flex items-center gap-4 px-5 py-3 rounded-2xl
                          bg-white/90 dark:bg-gray-950/90 backdrop-blur-md
                          border border-emerald-200 dark:border-emerald-800
                          shadow-xl shadow-emerald-500/10
                          w-full max-w-lg sm:max-w-2xl">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                Preprocessing complete
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                Ready to run defect detection
              </p>
            </div>
            <button
              id="btn-proceed-detection"
              onClick={() => router.push(`/results/${encodeURIComponent(job_id)}`)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl
                         bg-emerald-700 hover:bg-emerald-800 text-white border border-emerald-700
                         text-sm font-semibold transition-all shadow-sm active:scale-95 shrink-0 cursor-pointer"
            >
              Proceed
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
