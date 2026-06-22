'use client';

import React from 'react';

interface PaginationBarProps {
  page: number;
  pageCount: number;
  onPrev: () => void;
  onNext: () => void;
  onGoTo: (n: number) => void;
}

// How many page number buttons to show at most (excluding prev/next)
const MAX_VISIBLE = 5;

function buildPageNumbers(page: number, pageCount: number): (number | '…')[] {
  if (pageCount <= MAX_VISIBLE) {
    return Array.from({ length: pageCount }, (_, i) => i + 1);
  }

  const pages: (number | '…')[] = [];
  const half = Math.floor(MAX_VISIBLE / 2);
  let start = Math.max(2, page - half);
  let end = Math.min(pageCount - 1, page + half);

  // Shift window if near the edges
  if (page - half <= 1) end = Math.min(pageCount - 1, MAX_VISIBLE - 1);
  if (page + half >= pageCount) start = Math.max(2, pageCount - MAX_VISIBLE + 2);

  pages.push(1);
  if (start > 2) pages.push('…');
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < pageCount - 1) pages.push('…');
  pages.push(pageCount);

  return pages;
}

export default function PaginationBar({ page, pageCount, onPrev, onNext, onGoTo }: PaginationBarProps) {
  if (pageCount <= 1) return null;

  const pageNumbers = buildPageNumbers(page, pageCount);

  return (
    <div className="flex items-center justify-between gap-4 pt-4 border-t border-gray-100">
      {/* Page info */}
      <p className="text-xs text-gray-400 shrink-0">
        Page <span className="font-medium text-gray-600">{page}</span> of{' '}
        <span className="font-medium text-gray-600">{pageCount}</span>
      </p>

      {/* Page controls */}
      <div className="flex items-center gap-1">
        {/* Previous */}
        <button
          onClick={onPrev}
          disabled={page === 1}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Prev
        </button>

        {/* Page numbers */}
        <div className="flex items-center gap-1">
          {pageNumbers.map((p, i) =>
            p === '…' ? (
              <span key={`ellipsis-${i}`} className="px-1.5 text-xs text-gray-400 select-none">…</span>
            ) : (
              <button
                key={p}
                onClick={() => onGoTo(p as number)}
                className={`w-7 h-7 rounded-md text-xs font-medium transition-colors ${
                  p === page
                    ? 'text-white'
                    : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                }`}
                style={p === page ? { backgroundColor: 'var(--brand)' } : undefined}
              >
                {p}
              </button>
            )
          )}
        </div>

        {/* Next */}
        <button
          onClick={onNext}
          disabled={page === pageCount}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Next
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}
