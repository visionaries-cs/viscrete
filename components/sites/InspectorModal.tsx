"use client";

import { useState, useEffect, useRef } from "react";
import { Users, UserPlus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ModalShell } from "./ModalShell";
import { ModalHeader } from "./ModalHeader";

const AVATAR_COLORS = [
  "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
  "bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
  "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300",
  "bg-pink-100 text-pink-700 dark:bg-pink-900/50 dark:text-pink-300",
  "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300",
];

function getInitials(name: string): string {
  return name.trim().split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase() || "?";
}

export function InspectorModal({
  allInspectors, jobInspectorMap, siteInspectorNames,
  onAdd, onRemove, onClose, saving,
}: {
  allInspectors: string[];
  jobInspectorMap: Record<string, number>;
  siteInspectorNames: string[];
  onAdd: (name: string) => void;
  onRemove: (name: string) => void;
  onClose: () => void;
  saving: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (adding) inputRef.current?.focus(); }, [adding]);

  const isDuplicate = draft.trim() !== "" &&
    allInspectors.map(n => n.toLowerCase()).includes(draft.trim().toLowerCase());

  function handleAdd() {
    const name = draft.trim();
    if (!name || isDuplicate) return;
    onAdd(name);
    setDraft("");
    setAdding(false);
  }

  return (
    <ModalShell onClose={onClose}>
      <ModalHeader
        icon={Users} iconBg="bg-blue-50 dark:bg-blue-950/40" iconColor="text-blue-500"
        title="Inspectors" badge={allInspectors.length}
        subtitle="People who have inspected this site"
        onClose={onClose}
      />

      <div className="flex-1 overflow-y-auto min-h-0 px-3 py-3 space-y-0.5">
        {allInspectors.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <Users className="w-9 h-9 mb-3 opacity-30" />
            <p className="text-sm font-medium">No inspectors yet</p>
            <p className="text-xs mt-1 text-gray-300 dark:text-gray-600">Inspectors appear from jobs or can be added below</p>
          </div>
        ) : (
          allInspectors.map((name, i) => {
            const fromJob  = name in jobInspectorMap;
            const fromSite = siteInspectorNames.includes(name);
            const jobCount = jobInspectorMap[name] ?? 0;
            return (
              <div key={name} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50 transition group">
                <div className={cn("w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 select-none", AVATAR_COLORS[i % AVATAR_COLORS.length])}>
                  {getInitials(name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{name}</p>
                  <div className="mt-0.5">
                    {fromJob ? (
                      <span className="text-[10px] text-gray-400 dark:text-gray-500">{jobCount} job{jobCount !== 1 ? "s" : ""}</span>
                    ) : (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500">added manually</span>
                    )}
                  </div>
                </div>
                {fromSite && !fromJob && (
                  <button onClick={() => onRemove(name)} disabled={saving}
                    className="shrink-0 p-1.5 rounded-lg text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition cursor-pointer opacity-0 group-hover:opacity-100 disabled:opacity-30">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="shrink-0 px-5 py-4 border-t border-gray-100 dark:border-gray-800">
        {adding ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input ref={inputRef} value={draft} onChange={e => setDraft(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleAdd(); if (e.key === "Escape") { setAdding(false); setDraft(""); } }}
                placeholder="Inspector full name…"
                className="flex-1 px-3 py-2 rounded-lg text-sm border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" />
              <button onClick={handleAdd} disabled={!draft.trim() || isDuplicate || saving}
                className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0">
                Add
              </button>
              <button onClick={() => { setAdding(false); setDraft(""); }}
                className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition cursor-pointer shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>
            {isDuplicate && <p className="text-xs text-amber-600 dark:text-amber-400 px-1">This inspector is already on the list.</p>}
          </div>
        ) : (
          <button onClick={() => setAdding(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 text-sm text-gray-400 hover:border-blue-400 hover:text-blue-500 dark:hover:border-blue-600 dark:hover:text-blue-400 transition cursor-pointer">
            <UserPlus className="w-4 h-4" />
            Add Inspector
          </button>
        )}
      </div>
    </ModalShell>
  );
}

export default InspectorModal;
