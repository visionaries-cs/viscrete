"use client";

import Link from "next/link";
import { BarChart3, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { ModalShell } from "./ModalShell";
import { ModalHeader } from "./ModalHeader";

const CLASS_CONFIG: { key: string; label: string; bg: string; border: string; text: string }[] = [
  { key: "cracks",   label: "Cracks",   bg: "bg-red-500",    border: "border-red-200 dark:border-red-900/50",   text: "text-red-600 dark:text-red-400" },
  { key: "spalling", label: "Spalling", bg: "bg-yellow-500", border: "border-yellow-200 dark:border-yellow-900/50", text: "text-yellow-600 dark:text-yellow-400" },
  { key: "peeling",  label: "Peeling",  bg: "bg-orange-500", border: "border-orange-200 dark:border-orange-900/50", text: "text-orange-600 dark:text-orange-400" },
  { key: "algae",    label: "Algae",    bg: "bg-green-500",  border: "border-green-200 dark:border-green-900/50",  text: "text-green-600 dark:text-green-400" },
];

export function DefectsModal({
  total, classSummary, floorSummary, siteId, onClose,
}: {
  total: number;
  classSummary: Record<string, number>;
  floorSummary: Record<string, number>;
  siteId: string;
  onClose: () => void;
}) {
  const maxFloor = Math.max(...Object.values(floorSummary), 1);

  return (
    <ModalShell onClose={onClose}>
      <ModalHeader
        icon={BarChart3} iconBg="bg-red-50 dark:bg-red-950/40" iconColor="text-red-500"
        title="Defect Summary" badge={total}
        subtitle="Breakdown by class and floor"
        onClose={onClose}
      />

      <div className="flex-1 overflow-y-auto min-h-0 px-5 py-4 space-y-5">
        {total === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <BarChart3 className="w-9 h-9 mb-3 opacity-30" />
            <p className="text-sm font-medium">No defects detected yet</p>
            <p className="text-xs mt-1 text-gray-300 dark:text-gray-600">Run a detection job to see results here</p>
          </div>
        ) : (
          <>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">By Class</p>
              <div className="flex h-3 w-full rounded-full overflow-hidden gap-px mb-4">
                {CLASS_CONFIG.map(c => {
                  const count = classSummary[c.key] ?? 0;
                  if (count === 0) return null;
                  return (
                    <div key={c.key} className={cn("h-full transition-all", c.bg)}
                         style={{ width: `${(count / total) * 100}%` }} title={`${c.label}: ${count}`} />
                  );
                })}
              </div>

              <div className="space-y-2">
                {CLASS_CONFIG.map(c => {
                  const count = classSummary[c.key] ?? 0;
                  const pct   = total > 0 ? Math.round((count / total) * 100) : 0;
                  return (
                    <div key={c.key} className="flex items-center gap-3">
                      <span className={cn("w-2 h-2 rounded-full shrink-0", c.bg)} />
                      <span className="text-xs text-gray-600 dark:text-gray-300 w-16 shrink-0">{c.label}</span>
                      <div className="flex-1 h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                        <div className={cn("h-full rounded-full transition-all", c.bg)} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs font-semibold text-gray-900 dark:text-white w-6 text-right shrink-0">{count}</span>
                      <span className="text-[10px] text-gray-400 w-8 text-right shrink-0">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {Object.keys(floorSummary).length > 0 && (
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">By Floor</p>
                <div className="space-y-2">
                  {Object.entries(floorSummary).sort(([, a], [, b]) => b - a).map(([floor, count]) => (
                    <div key={floor} className="flex items-center gap-3">
                      <span className="text-xs text-gray-600 dark:text-gray-300 w-20 truncate shrink-0">{floor}</span>
                      <div className="flex-1 h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                        <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${(count / maxFloor) * 100}%` }} />
                      </div>
                      <span className="text-xs font-semibold text-gray-900 dark:text-white w-6 text-right shrink-0">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {total > 0 && (
        <div className="shrink-0 px-5 py-4 border-t border-gray-100 dark:border-gray-800">
          <Link
            href={`/sites/${siteId}/items`}
            onClick={onClose}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 text-sm font-medium text-gray-600 dark:text-gray-300 transition"
          >
            View all defects <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      )}
    </ModalShell>
  );
}

export default DefectsModal;
