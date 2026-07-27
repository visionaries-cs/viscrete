import Link from "next/link";
import { cn } from "@/lib/utils";

export function BrandMark({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <Link
      href="/inspection"
      className={cn("group inline-flex items-center gap-2.5 select-none", className)}
      aria-label="VISCRETE inspection workspace"
    >
      <span className="relative grid size-8 shrink-0 grid-cols-2 overflow-hidden rounded-md border border-slate-700 bg-slate-900 p-1.5 dark:border-slate-500">
        <span className="border-b border-r border-emerald-400/90" />
        <span className="border-b border-slate-600" />
        <span className="border-r border-slate-600" />
        <span className="bg-emerald-400/90" />
      </span>
      {!compact && (
        <span className="min-w-0">
          <span className="block text-[13px] font-bold tracking-[0.14em] text-slate-900 dark:text-slate-50">
            VISCRETE
          </span>
          <span className="hidden text-[10px] font-medium tracking-wide text-muted-foreground sm:block">
            Inspection workspace
          </span>
        </span>
      )}
    </Link>
  );
}
