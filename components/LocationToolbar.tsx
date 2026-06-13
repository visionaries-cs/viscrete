import { Map, Layers, CheckSquare, Square } from "lucide-react";
import { cn } from "@/lib/utils";

export default function LocationToolbar({
  selectedCount,
  totalCount,
  allSelected,
  onSelectAll,
  onClearSelection,
  onSetLocation,
  onSetLocationForAll,
  saveSuccess,
  className,
}: {
  selectedCount: number;
  totalCount: number;
  allSelected: boolean;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onSetLocation: () => void;
  onSetLocationForAll: () => void;
  saveSuccess?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2 px-3 py-2 bg-white dark:bg-[#161616] rounded-xl border border-gray-200 dark:border-gray-800", className)}>
      <button
        onClick={allSelected ? onClearSelection : onSelectAll}
        className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition cursor-pointer"
      >
        {allSelected
          ? <CheckSquare className="w-4 h-4 text-blue-500" />
          : <Square className="w-4 h-4" />}
        {allSelected ? "Deselect all" : "Select all no-GPS"}
      </button>

      {selectedCount > 0 && (
        <>
          <span className="text-gray-300 dark:text-gray-700">|</span>
          <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">{selectedCount} selected</span>
          <button
            onClick={onSetLocation}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition cursor-pointer"
          >
            <Map className="w-3.5 h-3.5" /> Set Location for Selected
          </button>
          <button
            onClick={onClearSelection}
            className="text-xs text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition cursor-pointer ml-auto"
          >Clear</button>
        </>
      )}

      <div className="ml-auto flex items-center gap-2">
        {saveSuccess && (
          <span className="text-xs text-emerald-600 dark:text-emerald-400">Applied.</span>
        )}
        <button
          onClick={onSetLocationForAll}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-gray-900 hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 text-white transition cursor-pointer"
        >
          <Layers className="w-3.5 h-3.5" /> Set Location for All ({totalCount})
        </button>
      </div>
    </div>
  );
}
