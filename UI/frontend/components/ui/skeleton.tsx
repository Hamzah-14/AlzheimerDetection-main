import { cn } from "@/lib/utils";

/**
 * Shimmer skeleton placeholder.
 * Usage: <Skeleton className="h-8 w-48 rounded-xl" />
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl bg-white/[0.06]",
        className
      )}
    >
      {/* shimmer sweep */}
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.6s_infinite] bg-gradient-to-r from-transparent via-white/[0.07] to-transparent" />
    </div>
  );
}

/** Pre-built skeleton shapes for common dashboard patterns */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-3xl border border-white/[0.06] bg-white/[0.03] p-6",
        className
      )}
    >
      <div className="mb-4 flex items-center justify-between">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-8 w-8 rounded-xl" />
      </div>
      <Skeleton className="mb-2 h-8 w-20" />
      <Skeleton className="h-3 w-36" />
    </div>
  );
}

export function SkeletonRow({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-4 px-4 py-3", className)}>
      <Skeleton className="h-9 w-9 shrink-0 rounded-xl" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3.5 w-32" />
        <Skeleton className="h-3 w-20" />
      </div>
      <Skeleton className="h-6 w-14 rounded-xl" />
    </div>
  );
}

export function SkeletonTable({
  rows = 5,
  className,
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div className={cn("overflow-hidden rounded-2xl border border-white/[0.06]", className)}>
      {/* Header */}
      <div className="flex gap-4 border-b border-white/[0.06] px-4 py-3">
        {[40, 28, 20, 12].map((w, i) => (
          <div
            key={i}
            className="relative overflow-hidden rounded-xl bg-white/[0.06] h-3"
            style={{ width: `${w}%` }}
          >
            <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.6s_infinite] bg-gradient-to-r from-transparent via-white/[0.07] to-transparent" />
          </div>
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} className={i !== 0 ? "border-t border-white/[0.04]" : ""} />
      ))}
    </div>
  );
}
