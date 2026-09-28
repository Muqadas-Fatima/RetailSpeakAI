"use client";
/**
 * Section-scoped loading placeholders. Each skeleton mirrors the shape of the
 * component it stands in for, so only the loading section shifts — never the page.
 */
import { Panel, PanelBody, SkeletonBlock } from "@/components/owner/primitives";

export function KpiCardsSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div
      role="status"
      aria-label="Loading key metrics"
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5"
    >
      {Array.from({ length: count }).map((_, index) => (
        <Panel key={index}>
          <PanelBody className="space-y-2.5">
            <SkeletonBlock className="h-8 w-8 rounded-xl" />
            <SkeletonBlock className="h-3 w-3/4" />
            <SkeletonBlock className="h-5 w-1/2" />
            <SkeletonBlock className="h-3 w-2/3" />
          </PanelBody>
        </Panel>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div role="status" aria-label="Loading table" className="space-y-2.5">
      <div className="flex gap-3">
        {Array.from({ length: columns }).map((_, index) => (
          <SkeletonBlock key={index} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex gap-3">
          {Array.from({ length: columns }).map((_, index) => (
            <SkeletonBlock key={index} className="h-9 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function ChartSkeleton({ height = 260 }: { height?: number }) {
  return (
    <div role="status" aria-label="Loading chart" className="space-y-3">
      <div className="flex gap-2">
        <SkeletonBlock className="h-7 w-24 rounded-full" />
        <SkeletonBlock className="h-7 w-24 rounded-full" />
      </div>
      <div className="flex items-end gap-2" style={{ height }}>
        {[45, 70, 35, 85, 55, 65, 40, 75].map((value, index) => (
          <SkeletonBlock key={index} className="flex-1" style={{ height: `${value}%` }} />
        ))}
      </div>
    </div>
  );
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Loading list" className="space-y-3">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex items-center gap-3">
          <SkeletonBlock className="h-9 w-9 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <SkeletonBlock className="h-3 w-2/5" />
            <SkeletonBlock className="h-3 w-3/5" />
          </div>
          <SkeletonBlock className="h-6 w-16 shrink-0 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function NotificationsSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Loading notifications" className="space-y-3">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex gap-3 rounded-xl border border-brand-border-subtle p-3 ">
          <SkeletonBlock className="h-8 w-8 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <SkeletonBlock className="h-3 w-1/2" />
            <SkeletonBlock className="h-3 w-full" />
            <SkeletonBlock className="h-2.5 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ForecastCardsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div role="status" aria-label="Loading forecast" className="grid gap-3 sm:grid-cols-3">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="space-y-2.5 rounded-2xl border border-brand-border-subtle p-4 ">
          <SkeletonBlock className="h-3 w-1/2" />
          <SkeletonBlock className="h-6 w-2/3" />
          <SkeletonBlock className="h-2.5 w-full" />
        </div>
      ))}
    </div>
  );
}

export function AnalyticsWidgetSkeleton() {
  return (
    <div role="status" aria-label="Loading analytics" className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="space-y-2 rounded-xl bg-brand-surface-2 p-3 ">
            <SkeletonBlock className="h-2.5 w-1/2" />
            <SkeletonBlock className="h-5 w-2/3" />
          </div>
        ))}
      </div>
      <ChartSkeleton height={180} />
    </div>
  );
}
