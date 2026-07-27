import Link from "next/link";
import { cn } from "@/lib/utils";

export function BrandMark({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <Link
      href="/inspection"
      className={cn("group inline-flex items-center gap-2.5 select-none", className)}
      aria-label="VISCRETE inspection workspace"
    >
      
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
