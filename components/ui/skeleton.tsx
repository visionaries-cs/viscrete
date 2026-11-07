import { cn } from "@/lib/utils";

/** Base shimmer block (shadcn/ui Skeleton, VISCRETE light/dark colors). */
export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn("animate-pulse rounded-md bg-gray-200 dark:bg-gray-800", className)}
      {...props}
    />
  );
}

/** Wraps a skeleton layout so screen readers hear one "Loading…" instead of nothing. */
export function SkeletonRegion({
  label = "Loading…",
  className,
  children,
}: {
  label?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

/** Grid of cards — site lists, job lists. */
export function CardGridSkeleton({
  count = 6,
  label,
  className,
}: {
  count?: number;
  label?: string;
  className?: string;
}) {
  return (
    <SkeletonRegion label={label} className={cn("grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4", className)}>
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#161616] p-5 space-y-4"
        >
          <div className="flex items-center gap-3">
            <Skeleton className="w-10 h-10 rounded-lg shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
          <div className="flex gap-2 pt-1">
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
        </div>
      ))}
    </SkeletonRegion>
  );
}

/** Rows — tables and item lists. */
export function ListSkeleton({ rows = 5, label, className }: { rows?: number; label?: string; className?: string }) {
  return (
    <SkeletonRegion label={label} className={cn("space-y-3", className)}>
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-[#161616] px-4 py-3"
        >
          <Skeleton className="w-12 h-12 rounded-lg shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-6 w-20 rounded-full shrink-0" />
        </div>
      ))}
    </SkeletonRegion>
  );
}

/** Pipeline pages (detect, results, report, preprocess): main image area + stat sidebar. */
export function PipelineSkeleton({ label, className }: { label?: string; className?: string }) {
  return (
    <SkeletonRegion label={label} className={cn("flex flex-col lg:flex-row gap-6 w-full", className)}>
      <div className="flex-1 min-w-0 space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="w-full aspect-video rounded-2xl" />
        <div className="flex gap-3">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="w-20 h-14 rounded-lg" />
          ))}
        </div>
      </div>
      <div className="w-full lg:w-80 shrink-0 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
        <Skeleton className="h-10 w-full rounded-lg" />
      </div>
    </SkeletonRegion>
  );
}
