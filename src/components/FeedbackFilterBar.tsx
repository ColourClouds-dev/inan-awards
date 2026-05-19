'use client';

import React from 'react';
import type { FeedbackFilters, DatePreset } from '../hooks/useFeedbackFilters';
import type { FeedbackForm, FeedbackResponse } from '../types';

interface FeedbackFilterBarProps {
  filters: FeedbackFilters;
  forms: FeedbackForm[];
  responses: FeedbackResponse[];           // used to derive available tags / countries
  setField: <K extends keyof FeedbackFilters>(key: K, value: FeedbackFilters[K]) => void;
  toggleTag: (label: string) => void;
  reset: () => void;
  /** Hide rating + search + tag filters (used on analytics page) */
  compact?: boolean;
}

const PRESETS: { key: DatePreset; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: '7d',    label: '7d' },
  { key: '30d',   label: '30d' },
  { key: 'custom', label: 'Custom' },
];

export default function FeedbackFilterBar({
  filters,
  forms,
  responses,
  setField,
  toggleTag,
  reset,
  compact = false,
}: FeedbackFilterBarProps) {
  // Derive available tag labels from the currently scoped responses
  const scopedResponses = filters.formId
    ? responses.filter(r => r.formId === filters.formId)
    : responses;

  const allTagLabels = Array.from(
    new Set(scopedResponses.flatMap(r => r.tags?.map(t => t.label) ?? [])),
  ).sort();

  const allCountries = Array.from(
    new Set(responses.map(r => r.visitorCountry).filter(Boolean) as string[]),
  ).sort();

  const hasActiveFilters =
    filters.formId ||
    filters.datePreset !== '30d' ||
    filters.tags.length > 0 ||
    filters.country ||
    filters.ratingMin > 0 ||
    filters.ratingMax > 0 ||
    filters.search.trim();

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
      {/* Row 1: Form selector + Date presets + Country */}
      <div className="flex flex-wrap gap-3 items-end">
        {/* Form selector */}
        <div className="flex flex-col gap-1 min-w-[160px]">
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Form</label>
          <select
            value={filters.formId}
            onChange={e => setField('formId', e.target.value)}
            className="h-9 rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-0"
            style={{ '--tw-ring-color': 'var(--brand)' } as React.CSSProperties}
          >
            <option value="">All forms</option>
            {forms.map(f => (
              <option key={f.id} value={f.id}>{f.title}</option>
            ))}
          </select>
        </div>

        {/* Date presets */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Period</label>
          <div className="flex rounded-md border border-gray-200 overflow-hidden h-9">
            {PRESETS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setField('datePreset', key)}
                className={`px-3 text-sm font-medium transition-colors border-r border-gray-200 last:border-r-0 ${
                  filters.datePreset === key
                    ? 'text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
                style={filters.datePreset === key ? { backgroundColor: 'var(--brand)' } : undefined}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom date range — only shown when preset = custom */}
        {filters.datePreset === 'custom' && (
          <div className="flex items-end gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">From</label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={e => setField('dateFrom', e.target.value)}
                className="h-9 rounded-md border border-gray-200 px-3 text-sm text-gray-700 focus:outline-none focus:ring-2"
                style={{ '--tw-ring-color': 'var(--brand)' } as React.CSSProperties}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">To</label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={e => setField('dateTo', e.target.value)}
                className="h-9 rounded-md border border-gray-200 px-3 text-sm text-gray-700 focus:outline-none focus:ring-2"
                style={{ '--tw-ring-color': 'var(--brand)' } as React.CSSProperties}
              />
            </div>
          </div>
        )}

        {/* Country */}
        {allCountries.length > 0 && (
          <div className="flex flex-col gap-1 min-w-[130px]">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Country</label>
            <select
              value={filters.country}
              onChange={e => setField('country', e.target.value)}
              className="h-9 rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2"
              style={{ '--tw-ring-color': 'var(--brand)' } as React.CSSProperties}
            >
              <option value="">All countries</option>
              {allCountries.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        )}

        {/* Reset */}
        {hasActiveFilters && (
          <button
            onClick={reset}
            className="h-9 self-end px-3 rounded-md text-sm text-gray-500 border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            Reset
          </button>
        )}
      </div>

      {/* Row 2: Tag pills + Rating + Search (hidden in compact mode) */}
      {!compact && (
        <div className="flex flex-wrap gap-4 items-start">
          {/* Tag pills */}
          {allTagLabels.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Tags</span>
              <div className="flex flex-wrap gap-1.5">
                {allTagLabels.map(label => {
                  const active = filters.tags.includes(label);
                  return (
                    <button
                      key={label}
                      onClick={() => toggleTag(label)}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                        active
                          ? 'text-white border-transparent'
                          : 'bg-white border-gray-200 text-gray-600 hover:border-gray-400'
                      }`}
                      style={active ? { backgroundColor: 'var(--brand)', borderColor: 'var(--brand)' } : undefined}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Rating range */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Rating</span>
            <div className="flex items-center gap-2">
              <select
                value={filters.ratingMin}
                onChange={e => setField('ratingMin', Number(e.target.value))}
                className="h-8 w-20 rounded-md border border-gray-200 bg-white px-2 text-sm text-gray-700 focus:outline-none"
              >
                <option value={0}>Min</option>
                {[1,2,3,4,5].map(n => <option key={n} value={n}>{'★'.repeat(n)}</option>)}
              </select>
              <span className="text-gray-400 text-xs">–</span>
              <select
                value={filters.ratingMax}
                onChange={e => setField('ratingMax', Number(e.target.value))}
                className="h-8 w-20 rounded-md border border-gray-200 bg-white px-2 text-sm text-gray-700 focus:outline-none"
              >
                <option value={0}>Max</option>
                {[1,2,3,4,5].map(n => <option key={n} value={n}>{'★'.repeat(n)}</option>)}
              </select>
            </div>
          </div>

          {/* Text search */}
          <div className="flex flex-col gap-1.5 flex-1 min-w-[180px]">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Search answers</span>
            <div className="relative">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search response text…"
                value={filters.search}
                onChange={e => setField('search', e.target.value)}
                className="h-8 w-full rounded-md border border-gray-200 pl-8 pr-3 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2"
                style={{ '--tw-ring-color': 'var(--brand)' } as React.CSSProperties}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
