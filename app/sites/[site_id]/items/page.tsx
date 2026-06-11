"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Loader2, AlertCircle, Filter, CheckCircle2,
  Clock, Circle, ImageIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getSiteItems, updateDefectStatus, type DefectItem, API_BASE_URL } from "@/lib/api";

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFECT_COLORS: Record<string, string> = {
  crack:    "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300",
  spalling: "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/50 dark:text-yellow-300",
  peeling:  "bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300",
  algae:    "bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-300",
};

const SEVERITY_COLORS: Record<string, string> = {
  high:    "text-red-500",
  medium:  "text-amber-500",
  low:     "text-emerald-500",
  unknown: "text-gray-400",
};

const STATUS_OPTIONS: { value: 'open' | 'in_progress' | 'resolved'; label: string }[] = [
  { value: 'open',        label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved',    label: 'Resolved' },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function DefectStatusBadge({ status }: { status: string }) {
  if (status === 'resolved') return (
    <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
      <CheckCircle2 className="w-3.5 h-3.5" /> Resolved
    </span>
  );
  if (status === 'in_progress') return (
    <span className="flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400">
      <Clock className="w-3.5 h-3.5" /> In Progress
    </span>
  );
  return (
    <span className="flex items-center gap-1 text-xs font-medium text-gray-500 dark:text-gray-400">
      <Circle className="w-3.5 h-3.5" /> Open
    </span>
  );
}

function DefectCard({
  defect,
  onStatusChange,
}: {
  defect: DefectItem;
  onStatusChange: (defectId: string, jobId: string, status: 'open' | 'in_progress' | 'resolved') => Promise<void>;
}) {
  const [updating, setUpdating] = useState(false);

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value as 'open' | 'in_progress' | 'resolved';
    setUpdating(true);
    try {
      await onStatusChange(defect.defect_id, defect.job_id, val);
    } finally {
      setUpdating(false);
    }
  }

  const imgSrc = defect.annotated_path
    ? `${API_BASE_URL}/static/${defect.annotated_path}?w=300`
    : null;

  return (
    <div className="bg-white dark:bg-gray-950 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden flex flex-col sm:flex-row gap-0">
      {/* Thumbnail */}
      <div className="w-full sm:w-28 h-24 sm:h-auto bg-gray-100 dark:bg-gray-800 shrink-0 flex items-center justify-center">
        {imgSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imgSrc} alt={defect.filename} className="w-full h-full object-cover" />
        ) : (
          <ImageIcon className="w-6 h-6 text-gray-400" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 p-3 flex flex-col gap-2 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn(
                "text-xs font-semibold px-2 py-0.5 rounded-full capitalize",
                DEFECT_COLORS[defect.defect_type] ?? "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
              )}>
                {defect.defect_type}
              </span>
              <span className={cn("text-xs font-medium capitalize", SEVERITY_COLORS[defect.severity])}>
                {defect.severity}
              </span>
              <span className="text-xs text-gray-400">{Math.round(defect.confidence * 100)}%</span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-1">{defect.filename}</p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 mt-auto">
          <DefectStatusBadge status={defect.item_status} />
          <select
            value={defect.item_status}
            onChange={handleChange}
            disabled={updating}
            className="text-xs border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 bg-white dark:bg-[#1a1a1a] text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 cursor-pointer"
          >
            {STATUS_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SiteItemsPage() {
  const { site_id } = useParams<{ site_id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [defects, setDefects] = useState<DefectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters (controlled by URL params for shareability)
  const [floor, setFloor] = useState(searchParams.get('floor') ?? '');
  const [room, setRoom] = useState(searchParams.get('room') ?? '');
  const [defectType, setDefectType] = useState(searchParams.get('defect_type') ?? '');
  const [itemStatus, setItemStatus] = useState(searchParams.get('item_status') ?? '');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getSiteItems(site_id, {
        floor:       floor || undefined,
        room:        room || undefined,
        defect_type: defectType || undefined,
        item_status: itemStatus || undefined,
      });
      setDefects(data.defects);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load defects");
    } finally {
      setLoading(false);
    }
  }, [site_id, floor, room, defectType, itemStatus]);

  useEffect(() => { load(); }, [load]);

  async function handleStatusChange(
    defectId: string,
    jobId: string,
    newStatus: 'open' | 'in_progress' | 'resolved',
  ) {
    const updated = await updateDefectStatus(jobId, defectId, newStatus);
    setDefects(prev => prev.map(d => d.defect_id === defectId ? { ...d, item_status: updated.item_status } : d));
  }

  // Derive unique filter options from all loaded defects (unfiltered call would be ideal
  // but this is sufficient for thesis scale since the list is already loaded)
  const allFloors  = [...new Set(defects.map(d => d.floor).filter(Boolean))] as string[];
  const allRooms   = [...new Set(defects.map(d => d.room).filter(Boolean))] as string[];
  const allTypes   = [...new Set(defects.map(d => d.defect_type))];

  // Group by floor → room
  type Group = { floor: string; room: string; defects: DefectItem[] };
  const groups: Group[] = [];
  const seen = new Set<string>();
  for (const d of defects) {
    const f = d.floor ?? "Unassigned";
    const r = d.room  ?? "—";
    const key = `${f}|||${r}`;
    if (!seen.has(key)) { seen.add(key); groups.push({ floor: f, room: r, defects: [] }); }
    groups.find(g => g.floor === f && g.room === r)!.defects.push(d);
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      {/* Header */}
      <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href={`/sites/${site_id}`} className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1">
            <h1 className="text-base font-bold text-gray-900 dark:text-white">All Defects</h1>
            <p className="text-xs text-gray-400 font-mono">{site_id}</p>
          </div>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {loading ? "…" : `${defects.length} defect${defects.length !== 1 ? "s" : ""}`}
          </span>
        </div>

        {/* Filter bar */}
        <div className="border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-950">
          <div className="max-w-6xl mx-auto px-6 py-3 flex items-center gap-3 flex-wrap">
            <Filter className="w-4 h-4 text-gray-400 shrink-0" />

            {[
              { label: "Floor", value: floor, onChange: setFloor, options: allFloors },
              { label: "Room",  value: room,  onChange: setRoom,  options: allRooms },
              { label: "Class", value: defectType, onChange: setDefectType, options: allTypes },
            ].map(({ label, value, onChange, options }) => (
              <select
                key={label}
                value={value}
                onChange={e => onChange(e.target.value)}
                className="text-xs border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white dark:bg-[#1a1a1a] text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">{label}: All</option>
                {options.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            ))}

            <select
              value={itemStatus}
              onChange={e => setItemStatus(e.target.value)}
              className="text-xs border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white dark:bg-[#1a1a1a] text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Status: All</option>
              {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>

            {(floor || room || defectType || itemStatus) && (
              <button
                onClick={() => { setFloor(''); setRoom(''); setDefectType(''); setItemStatus(''); }}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-6 space-y-8">
        {loading && (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            <span className="text-sm">Loading defects…</span>
          </div>
        )}

        {error && !loading && (
          <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-600 dark:text-red-400">
            <AlertCircle className="w-4 h-4 shrink-0" />{error}
            <button onClick={load} className="ml-auto underline text-xs">Retry</button>
          </div>
        )}

        {!loading && !error && defects.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-gray-400">
            <ImageIcon className="w-10 h-10 mb-3 opacity-40" />
            <p className="text-sm font-medium">No defects found</p>
            <p className="text-xs mt-1">Try clearing the filters or run detection on a job first.</p>
          </div>
        )}

        {!loading && !error && groups.map(group => (
          <section key={`${group.floor}|||${group.room}`}>
            <div className="flex items-center gap-3 mb-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-900 dark:text-white">{group.floor}</span>
                {group.room !== "—" && (
                  <>
                    <span className="text-gray-300 dark:text-gray-600">·</span>
                    <span className="text-sm text-gray-600 dark:text-gray-400">{group.room}</span>
                  </>
                )}
              </div>
              <div className="flex-1 h-px bg-gray-200 dark:bg-gray-800" />
              <span className="text-xs text-gray-400">{group.defects.length}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {group.defects.map(d => (
                <DefectCard key={d.defect_id} defect={d} onStatusChange={handleStatusChange} />
              ))}
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}
