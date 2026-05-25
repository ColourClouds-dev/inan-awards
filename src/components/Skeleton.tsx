import React from 'react';

// ── Base shimmer block ────────────────────────────────────────────────────────

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return <div className={`skeleton-shimmer rounded ${className}`} />;
}

// ── Stat card skeleton (dashboard overview) ───────────────────────────────────

export function StatCardSkeleton() {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center gap-4">
        <Skeleton className="w-12 h-12 rounded-full shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-7 w-16" />
          <Skeleton className="h-3 w-36" />
        </div>
      </div>
    </div>
  );
}

// ── Form card skeleton ────────────────────────────────────────────────────────

export function FormCardSkeleton() {
  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-5 py-4 flex items-start justify-between gap-4">
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-14 rounded-full" />
          </div>
          <div className="flex gap-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
        <div className="flex gap-1">
          <Skeleton className="w-7 h-7 rounded-md" />
          <Skeleton className="w-7 h-7 rounded-md" />
          <Skeleton className="w-7 h-7 rounded-md" />
        </div>
      </div>
      <div className="border-t border-gray-100 px-5 py-3 flex gap-4">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  );
}

// ── Table row skeleton ────────────────────────────────────────────────────────

export function TableRowSkeleton({ cols = 6 }: { cols?: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton className={`h-4 ${i === 0 ? 'w-32' : i === cols - 1 ? 'w-6' : 'w-20'}`} />
        </td>
      ))}
    </tr>
  );
}

// ── Filter bar skeleton ───────────────────────────────────────────────────────

export function FilterBarSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-3 py-2.5 flex items-center gap-3">
      <Skeleton className="flex-1 h-8 rounded-full" />
      <Skeleton className="w-20 h-8 rounded-lg" />
      <Skeleton className="w-28 h-8 rounded-lg" />
    </div>
  );
}

// ── Chart skeleton ────────────────────────────────────────────────────────────

export function ChartSkeleton() {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
      {/* Controls row */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="space-y-1.5">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-8 w-64 rounded-lg" />
        </div>
        <div className="space-y-1.5">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-8 w-48 rounded-lg" />
        </div>
      </div>
      {/* Stat pills */}
      <div className="flex gap-2 flex-wrap">
        {[80, 96, 72].map(w => (
          <Skeleton key={w} className={`h-7 w-${w === 80 ? '20' : w === 96 ? '24' : '18'} rounded-full`} />
        ))}
      </div>
      {/* Chart area */}
      <Skeleton className="w-full h-72 rounded-lg" />
    </div>
  );
}

// ── Section card skeleton (settings) ─────────────────────────────────────────

export function SectionSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="bg-white shadow rounded-lg p-6 space-y-4">
      <div className="border-b pb-3 space-y-1.5">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-3 w-64" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="space-y-1">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        ))}
      </div>
      <div className="flex justify-end">
        <Skeleton className="h-9 w-24 rounded-lg" />
      </div>
    </div>
  );
}

// ── Profile page skeleton ─────────────────────────────────────────────────────

export function ProfileHeaderSkeleton() {
  return (
    <div className="flex items-center gap-4">
      <Skeleton className="w-16 h-16 rounded-full shrink-0" />
      <div className="space-y-2">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-3 w-48" />
      </div>
    </div>
  );
}
