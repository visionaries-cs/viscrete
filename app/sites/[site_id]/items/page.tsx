"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Clock,
  Filter,
  ImageIcon,
  Loader2,
  MapPin,
  SlidersHorizontal,
} from "lucide-react";
import AppNav from "@/components/AppNav";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState, ErrorState } from "@/components/app/StatePanel";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSignedUrl } from "@/hooks/useSignedUrl";
import { getSiteItems, updateDefectStatus, type DefectItem } from "@/lib/api";

const DEFECT_COLORS: Record<string, string> = {
  crack: "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/45 dark:text-red-300",
  spalling: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/45 dark:text-amber-300",
  peeling: "border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-900 dark:bg-orange-950/45 dark:text-orange-300",
  algae: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/45 dark:text-emerald-300",
};

const SEVERITY_COLORS: Record<string, string> = {
  high: "text-red-600 dark:text-red-300",
  medium: "text-amber-600 dark:text-amber-300",
  low: "text-emerald-600 dark:text-emerald-300",
  unknown: "text-muted-foreground",
};

const STATUS_OPTIONS = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "resolved", label: "Resolved" },
] as const;

function DefectStatusBadge({ status }: { status: string }) {
  const config = status === "resolved"
    ? { icon: CheckCircle2, label: "Resolved", className: "text-emerald-700 dark:text-emerald-300" }
    : status === "in_progress"
      ? { icon: Clock, label: "In progress", className: "text-amber-700 dark:text-amber-300" }
      : { icon: Circle, label: "Open", className: "text-muted-foreground" };
  const Icon = config.icon;
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-semibold", config.className)}>
      <Icon className="size-3.5" />{config.label}
    </span>
  );
}

function DefectCard({
  defect,
  onStatusChange,
}: {
  defect: DefectItem;
  onStatusChange: (defectId: string, jobId: string, status: "open" | "in_progress" | "resolved") => Promise<void>;
}) {
  const [updating, setUpdating] = useState(false);
  const imgSrc = useSignedUrl(defect.job_id, defect.annotated_path ?? null);

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setUpdating(true);
    try {
      await onStatusChange(defect.defect_id, defect.job_id, e.target.value as "open" | "in_progress" | "resolved");
    } finally {
      setUpdating(false);
    }
  }

  return (
    <article className="surface-panel group overflow-hidden">
      <div className="grid min-h-44 grid-cols-1 sm:grid-cols-[10rem_minmax(0,1fr)]">
        <div className="relative flex min-h-40 items-center justify-center bg-muted sm:min-h-full">
          {imgSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imgSrc} alt={`Annotated ${defect.filename}`} className="absolute inset-0 size-full object-cover" />
          ) : (
            <ImageIcon className="size-7 text-muted-foreground" />
          )}
          <span className="absolute left-3 top-3 rounded-md bg-slate-950/80 px-2 py-1 font-mono text-[10px] text-white">
            {defect.defect_id.slice(0, 8)}
          </span>
        </div>

        <div className="flex min-w-0 flex-col p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn(
              "rounded-full border px-2.5 py-1 text-[11px] font-semibold capitalize",
              DEFECT_COLORS[defect.defect_type] ?? "border-border bg-muted text-foreground",
            )}>
              {defect.defect_type}
            </span>
            <span className={cn("text-xs font-semibold capitalize", SEVERITY_COLORS[defect.severity])}>
              {defect.severity} severity
            </span>
            <span className="ml-auto text-xs font-semibold tabular-nums text-foreground">
              {Math.round(defect.confidence * 100)}%
            </span>
          </div>

          <p className="mt-3 truncate text-sm font-semibold text-foreground">{defect.filename}</p>
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1"><MapPin className="size-3" />{defect.floor || "Unassigned floor"}</span>
            {defect.room && <span>{defect.room}</span>}
            {defect.area_tag && <span>{defect.area_tag}</span>}
          </div>

          <div className="mt-auto flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
            <DefectStatusBadge status={defect.item_status} />
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Update</span>
              <select
                value={defect.item_status}
                onChange={handleChange}
                disabled={updating}
                className="h-10 rounded-lg border border-input bg-card px-3 text-sm font-medium text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:opacity-50"
              >
                {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
          </div>
        </div>
      </div>
    </article>
  );
}

export default function SiteItemsPage() {
  const { site_id } = useParams<{ site_id: string }>();
  const searchParams = useSearchParams();
  const [defects, setDefects] = useState<DefectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [floor, setFloor] = useState(searchParams.get("floor") ?? "");
  const [room, setRoom] = useState(searchParams.get("room") ?? "");
  const [defectType, setDefectType] = useState(searchParams.get("defect_type") ?? "");
  const [itemStatus, setItemStatus] = useState(searchParams.get("item_status") ?? "");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getSiteItems(site_id, {
        floor: floor || undefined,
        room: room || undefined,
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

  useEffect(() => { void load(); }, [load]);

  async function handleStatusChange(
    defectId: string,
    jobId: string,
    newStatus: "open" | "in_progress" | "resolved",
  ) {
    const updated = await updateDefectStatus(jobId, defectId, newStatus);
    setDefects((current) => current.map((defect) =>
      defect.defect_id === defectId ? { ...defect, item_status: updated.item_status } : defect
    ));
  }

  const allFloors = [...new Set(defects.map((defect) => defect.floor).filter(Boolean))] as string[];
  const allRooms = [...new Set(defects.map((defect) => defect.room).filter(Boolean))] as string[];
  const allTypes = [...new Set(defects.map((defect) => defect.defect_type))];
  const activeFilterCount = [floor, room, defectType, itemStatus].filter(Boolean).length;

  type Group = { floor: string; room: string; defects: DefectItem[] };
  const groups: Group[] = [];
  for (const defect of defects) {
    const groupFloor = defect.floor ?? "Unassigned";
    const groupRoom = defect.room ?? "—";
    let group = groups.find((item) => item.floor === groupFloor && item.room === groupRoom);
    if (!group) {
      group = { floor: groupFloor, room: groupRoom, defects: [] };
      groups.push(group);
    }
    group.defects.push(defect);
  }

  function clearFilters() {
    setFloor("");
    setRoom("");
    setDefectType("");
    setItemStatus("");
  }

  const selectClass = "h-11 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20";

  return (
    <div className="app-page">
      <AppNav subtitle="Defect register" />

      <main className="page-container page-main">
        <PageHeader
          eyebrow="Site register"
          title="Defect register"
          description="Review every finding across this site, filter by location or class, and keep remediation status current."
          meta={<span className="font-mono">{site_id}</span>}
          actions={
            <>
              <Button variant="outline" className="flex-1 lg:hidden" onClick={() => setFiltersOpen((open) => !open)}>
                <SlidersHorizontal className="size-4" />
                Filters {activeFilterCount > 0 && `(${activeFilterCount})`}
              </Button>
              <Button variant="outline" asChild className="flex-1 sm:flex-none">
                <Link href={`/sites/${site_id}`}><ArrowLeft className="size-4" />Site overview</Link>
              </Button>
            </>
          }
        />

        <div className="mt-7 grid grid-cols-1 gap-7 lg:grid-cols-[16rem_minmax(0,1fr)]">
          <aside className={cn("lg:block", filtersOpen ? "block" : "hidden")}>
            <div className="surface-panel space-y-5 p-5 lg:sticky lg:top-24">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Filter className="size-4 text-primary" />
                  <h2 className="text-sm font-semibold">Filters</h2>
                </div>
                {activeFilterCount > 0 && <button onClick={clearFilters} className="text-xs font-semibold text-primary hover:underline">Clear</button>}
              </div>
              <label className="block">
                <span className="field-label">Floor</span>
                <select value={floor} onChange={(e) => setFloor(e.target.value)} className={selectClass}>
                  <option value="">All floors</option>
                  {allFloors.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="field-label">Room</span>
                <select value={room} onChange={(e) => setRoom(e.target.value)} className={selectClass}>
                  <option value="">All rooms</option>
                  {allRooms.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="field-label">Defect class</span>
                <select value={defectType} onChange={(e) => setDefectType(e.target.value)} className={selectClass}>
                  <option value="">All classes</option>
                  {allTypes.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="field-label">Remediation status</span>
                <select value={itemStatus} onChange={(e) => setItemStatus(e.target.value)} className={selectClass}>
                  <option value="">All statuses</option>
                  {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
            </div>
          </aside>

          <section className="min-w-0">
            <div className="mb-4 flex items-end justify-between">
              <div>
                <h2 className="text-base font-semibold text-foreground">Findings</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {loading ? "Loading register…" : `${defects.length} ${defects.length === 1 ? "finding" : "findings"}`}
                </p>
              </div>
              {loading && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
            </div>

            {error && !loading && <ErrorState title="Could not load defects" description={error} onRetry={load} />}

            {!loading && !error && defects.length === 0 && (
              <EmptyState
                icon={ImageIcon}
                title={activeFilterCount ? "No findings match these filters" : "No defects recorded"}
                description={activeFilterCount ? "Clear or adjust the filters to widen the register." : "Run detection on an inspection job to populate this register."}
                actionLabel={activeFilterCount ? "Clear filters" : undefined}
                onAction={activeFilterCount ? clearFilters : undefined}
              />
            )}

            {!loading && !error && groups.map((group) => (
              <section key={`${group.floor}|||${group.room}`} className="mb-8 last:mb-0">
                <div className="mb-3 flex items-center gap-3">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-foreground">{group.floor}</h3>
                    <p className="text-xs text-muted-foreground">{group.room === "—" ? "Room not assigned" : group.room}</p>
                  </div>
                  <div className="h-px flex-1 bg-border" />
                  <span className="rounded-full border bg-card px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">{group.defects.length}</span>
                </div>
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                  {group.defects.map((defect) => (
                    <DefectCard key={defect.defect_id} defect={defect} onStatusChange={handleStatusChange} />
                  ))}
                </div>
              </section>
            ))}
          </section>
        </div>
      </main>
    </div>
  );
}
