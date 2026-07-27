"use client";

import { useEffect, useRef, useState } from "react";
import { Activity, ChevronDown, ChevronUp, Copy, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

type LogLevel = "info" | "warning" | "error";

interface TerminalLine {
  timestamp: string;
  step: number | null;
  name: string | null;
  level: LogLevel;
  message: string;
}

export function PreprocessingTerminal({ lines }: { lines: TerminalLine[] }) {
  const [collapsed, setCollapsed] = useState(false);
  const [visibleLines, setVisibleLines] = useState<TerminalLine[]>([]);
  const [copied, setCopied] = useState(false);
  const lastSyncedCountRef = useRef(0);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (lines.length <= lastSyncedCountRef.current) return;
    const newLines = lines.slice(lastSyncedCountRef.current);
    lastSyncedCountRef.current = lines.length;
    setVisibleLines((current) => [...current, ...newLines].slice(-500));
  }, [lines]);

  useEffect(() => {
    if (!collapsed) logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [visibleLines, collapsed]);

  function handleClear() {
    lastSyncedCountRef.current = lines.length;
    setVisibleLines([]);
  }

  async function handleCopy() {
    const text = lines.map((line) => {
      const tag = line.step != null ? `STEP ${line.step}` : "PIPELINE";
      return `[${line.timestamp}] [${tag.padEnd(8)}] ${line.message}`;
    }).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access may be unavailable.
    }
  }

  return (
    <div className="surface-panel h-full overflow-hidden">
      <div className="flex min-h-16 flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <button
          onClick={() => setCollapsed((current) => !current)}
          className="flex items-center gap-2 text-sm font-semibold text-foreground transition hover:text-primary"
        >
          <Activity className="size-4 text-primary" />
          <span>{collapsed ? `Activity (${lines.length})` : "Live activity"}</span>
          {collapsed ? <ChevronDown className="size-3.5 text-muted-foreground" /> : <ChevronUp className="size-3.5 text-muted-foreground" />}
        </button>
        <div className="flex items-center gap-1">
          <button onClick={handleCopy} className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground">
            <Copy className="size-3.5" />{copied ? "Copied" : "Copy"}
          </button>
          <button onClick={handleClear} className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground">
            <Trash2 className="size-3.5" />Clear
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="h-[25rem] overflow-y-auto bg-muted/25 p-3 text-xs leading-5 scroll-smooth">
          {visibleLines.length === 0 ? (
            <div className="flex h-full items-center justify-center text-muted-foreground">Waiting for processing activity…</div>
          ) : visibleLines.map((line, index) => {
            const tag = line.step != null ? `STEP ${line.step}` : "PIPELINE";
            return (
              <div key={index} className="mb-1.5 grid grid-cols-[3.5rem_minmax(0,1fr)] gap-2 rounded-lg border bg-card px-3 py-2 last:mb-0">
                <span className="select-none font-mono text-[10px] text-muted-foreground">{line.timestamp}</span>
                <div className="min-w-0">
                  <span className={cn(
                    "mr-2 select-none font-mono text-[10px] font-semibold",
                    line.step != null ? "text-primary" : "text-muted-foreground",
                  )}>
                    {tag}
                  </span>
                  <span className={cn(
                    "break-words text-foreground",
                    line.level === "warning" && "text-amber-700 dark:text-amber-300",
                    line.level === "error" && "text-red-700 dark:text-red-300",
                  )}>
                    {line.message}
                  </span>
                </div>
              </div>
            );
          })}
          <div ref={logEndRef} />
        </div>
      )}
    </div>
  );
}

export default PreprocessingTerminal;
