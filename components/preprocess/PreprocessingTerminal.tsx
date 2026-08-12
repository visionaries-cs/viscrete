"use client";

import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Terminal, ChevronDown, ChevronUp, Copy, Trash2 } from "lucide-react";

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

  // Sync new lines from parent into visibleLines
  useEffect(() => {
    if (lines.length > lastSyncedCountRef.current) {
      const newLines = lines.slice(lastSyncedCountRef.current);
      lastSyncedCountRef.current = lines.length;
      setVisibleLines((prev) => {
        const merged = [...prev, ...newLines];
        return merged.length > 500 ? merged.slice(merged.length - 500) : merged;
      });
    }
  }, [lines]);

  // Auto-scroll to bottom on new lines
  useEffect(() => {
    if (!collapsed) {
      logEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [visibleLines, collapsed]);

  function handleClear() {
    lastSyncedCountRef.current = lines.length;
    setVisibleLines([]);
  }

  async function handleCopy() {
    const text = lines
      .map((l) => {
        const tag = l.step != null ? `STEP ${l.step}` : "PIPELINE";
        return `[${l.timestamp}] [${tag.padEnd(8)}] ${l.message}`;
      })
      .join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard API unavailable */
    }
  }

  return (
    <div className="rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-800">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800">
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition cursor-pointer"
        >
          <Terminal className="w-4 h-4 text-gray-400" />
          <span>
            {collapsed ? `Logs (${lines.length})` : "Terminal Output"}
          </span>
          {collapsed ? (
            <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
          ) : (
            <ChevronUp className="w-3.5 h-3.5 text-gray-400" />
          )}
        </button>
        <div className="flex items-center gap-1">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-200 transition cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5" />
            {copied ? "Copied!" : "Copy logs"}
          </button>
          <button
            onClick={handleClear}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-200 transition cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear
          </button>
        </div>
      </div>

      {/* Terminal body */}
      {!collapsed && (
        <div className="bg-[#0b0d10] p-4 h-72 overflow-y-auto font-mono text-[11.5px] leading-[1.65] scroll-smooth">
          {visibleLines.length === 0 ? (
            <span className="text-gray-600">Waiting for pipeline output…</span>
          ) : (
            visibleLines.map((line, i) => {
              const tag =
                line.step != null ? `STEP ${line.step}` : "PIPELINE";
              const padded = tag.padEnd(8);
              return (
                <div key={i} className="whitespace-pre-wrap break-all">
                  <span className="text-gray-600 select-none">
                    [{line.timestamp}]
                  </span>{" "}
                  <span
                    className={cn(
                      "font-semibold select-none",
                      line.step != null ? "text-blue-500" : "text-gray-500"
                    )}
                  >
                    [{padded}]
                  </span>{" "}
                  <span
                    className={cn(
                      line.level === "warning" && "text-[#FACC15]",
                      line.level === "error" && "text-[#F87171]",
                      line.level === "info" && "text-gray-200"
                    )}
                  >
                    {line.message}
                  </span>
                </div>
              );
            })
          )}
          <div ref={logEndRef} />
        </div>
      )}
    </div>
  );
}

export default PreprocessingTerminal;
