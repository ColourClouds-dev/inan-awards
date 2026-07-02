'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SortOption {
  key: string;
  label: string;
}

export interface StatusPill {
  key: string;
  label: string;
  /** Tailwind classes for selected state background + text */
  selectedClass: string;
  /** Tailwind classes for unselected state border + text */
  unselectedClass: string;
}

export interface FilterSortBarProps {
  /** Placeholder text for the search input */
  searchPlaceholder?: string;
  /** Current search value */
  search: string;
  onSearchChange: (value: string) => void;

  /** Status/tag pill definitions for the Filter panel */
  statusPills: StatusPill[];
  /** Currently selected status keys */
  selectedStatuses: string[];
  onStatusToggle: (key: string) => void;

  /** Label shown above the status pills */
  statusLabel?: string;

  /** Date range section label */
  dateLabel?: string;
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (v: string) => void;
  onDateToChange: (v: string) => void;

  /** Sort options */
  sortOptions: SortOption[];
  /** Currently active sort key */
  activeSort: string;
  onSortChange: (key: string) => void;

  onClearFilters: () => void;

  /** Optional external form selector (used when the page owns formId state) */
  forms?: { id: string; title: string }[];
  formSelectorValue?: string;
  onFormSelectorChange?: (formId: string) => void;
  /** When true, the Sort button is not rendered (e.g. analytics page) */
  hideSortButton?: boolean;
}

// ── Shared icons ──────────────────────────────────────────────────────────────

const SearchIcon = () => (
  <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const FilterIcon = () => (
  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
  </svg>
);

const SortIcon = () => (
  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
  </svg>
);

const ChevronDown = () => (
  <svg className="w-3.5 h-3.5 shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

const CheckIcon = () => (
  <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

// ── Hook: close on outside click ──────────────────────────────────────────────

function useOutsideClick(ref: React.RefObject<HTMLElement>, onClose: () => void) {
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [ref, onClose]);
}

// ── Main component ────────────────────────────────────────────────────────────

export default function FilterSortBar({
  searchPlaceholder = 'Search…',
  search,
  onSearchChange,
  statusPills,
  selectedStatuses,
  onStatusToggle,
  statusLabel = 'Status',
  dateLabel = 'Date Range',
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  sortOptions,
  activeSort,
  onSortChange,
  onClearFilters,
  forms,
  formSelectorValue,
  onFormSelectorChange,
  hideSortButton = false,
}: FilterSortBarProps) {
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);

  // Staged filter state — only pills are staged; dates apply live
  const [stagedStatuses, setStagedStatuses] = useState<string[]>(selectedStatuses);
  const [pillSearch, setPillSearch] = useState('');
  const [formSearch, setFormSearch] = useState('');

  // Sync staged state when panel opens
  const handleFilterOpen = () => {
    setStagedStatuses(selectedStatuses);
    setPillSearch('');
    setFormSearch('');
    setFilterOpen(true);
    setSortOpen(false);
  };

  const handleApply = () => {
    // Commit staged pill selections to parent
    stagedStatuses.forEach(s => {
      if (!selectedStatuses.includes(s)) onStatusToggle(s);
    });
    selectedStatuses.forEach(s => {
      if (!stagedStatuses.includes(s)) onStatusToggle(s);
    });
    setFilterOpen(false);
  };

  const handleClear = () => {
    setStagedStatuses([]);
    onClearFilters();
    setFilterOpen(false);
  };

  const filterRef = useRef<HTMLDivElement>(null!);
  const sortRef = useRef<HTMLDivElement>(null!);

  const [filterStyle, setFilterStyle] = useState<React.CSSProperties>({ width: 288, right: 0 });
  const [sortStyle, setSortStyle] = useState<React.CSSProperties>({ width: 208, right: 0 });

  const updateFilterPosition = useCallback(() => {
    if (!filterOpen || !filterRef.current) return;
    const rect = filterRef.current.getBoundingClientRect();
    const desiredWidth = 288;
    const margin = 16;
    let left: number | string = 'auto';
    let right: number | string = 0;
    
    if (rect.right - desiredWidth < margin) {
      left = -rect.left + margin;
      right = 'auto';
    }
    
    setFilterStyle({
      left,
      right,
      width: desiredWidth,
      maxWidth: `calc(100vw - ${margin * 2}px)`,
      maxHeight: 'calc(100dvh - 8rem)'
    });
  }, [filterOpen]);

  const updateSortPosition = useCallback(() => {
    if (!sortOpen || !sortRef.current) return;
    const rect = sortRef.current.getBoundingClientRect();
    const desiredWidth = 208;
    const margin = 16;
    let left: number | string = 'auto';
    let right: number | string = 0;
    
    if (rect.right - desiredWidth < margin) {
      left = -rect.left + margin;
      right = 'auto';
    }
    
    setSortStyle({
      left,
      right,
      width: desiredWidth,
      maxWidth: `calc(100vw - ${margin * 2}px)`,
    });
  }, [sortOpen]);

  useEffect(() => {
    updateFilterPosition();
    if (filterOpen) {
      window.addEventListener('resize', updateFilterPosition);
      return () => window.removeEventListener('resize', updateFilterPosition);
    }
  }, [filterOpen, updateFilterPosition]);

  useEffect(() => {
    updateSortPosition();
    if (sortOpen) {
      window.addEventListener('resize', updateSortPosition);
      return () => window.removeEventListener('resize', updateSortPosition);
    }
  }, [sortOpen, updateSortPosition]);

  useOutsideClick(filterRef, useCallback(() => setFilterOpen(false), []));
  useOutsideClick(sortRef, useCallback(() => setSortOpen(false), []));

  // Active filter count — dates read directly from props since they apply live
  const activeFilterCount = selectedStatuses.length + (dateFrom ? 1 : 0) + (dateTo ? 1 : 0) + (formSelectorValue ? 1 : 0);

  // Date validation — warn if from is after to
  const dateRangeInvalid = !!(dateFrom && dateTo && dateFrom > dateTo);

  // Active sort label
  const activeSortLabel = sortOptions.find(o => o.key === activeSort)?.label ?? 'Sort';

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-white rounded-xl border border-gray-200 shadow-sm px-3 py-2.5">

      {/* ── Search ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-1 min-w-0 bg-gray-50 rounded-full px-3 py-1.5 border border-gray-200 focus-within:border-gray-300 focus-within:ring-2 focus-within:ring-offset-0 transition-shadow"
        style={{ '--tw-ring-color': 'color-mix(in srgb, var(--brand) 20%, transparent)' } as React.CSSProperties}>
        <SearchIcon />
        <input
          type="text"
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="flex-1 bg-transparent text-sm text-gray-700 placeholder-gray-400 focus:outline-none min-w-0"
        />
        {search && (
          <button onClick={() => onSearchChange('')} className="text-gray-400 hover:text-gray-600 transition-colors shrink-0">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Divider */}
      <div className="hidden sm:block w-px h-6 bg-gray-200 shrink-0" />

      {/* ── Filter button + dropdown ────────────────────────────────────────── */}
      <div ref={filterRef} className="relative shrink-0">
        <button
          onClick={handleFilterOpen}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
            filterOpen || activeFilterCount > 0
              ? 'border-transparent text-white'
              : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
          }`}
          style={filterOpen || activeFilterCount > 0 ? { backgroundColor: 'var(--brand)' } : undefined}
        >
          <FilterIcon />
          <span>Filter</span>
          {activeFilterCount > 0 && (
            <span className={`ml-0.5 inline-flex items-center justify-center w-4 h-4 rounded-full text-xs font-bold ${
              filterOpen ? 'bg-white text-purple-700' : 'bg-white/30 text-white'
            }`}>
              {activeFilterCount}
            </span>
          )}
        </button>

        {filterOpen && (
          <div
            className="absolute top-full mt-2 bg-white rounded-xl shadow-lg border border-gray-200 z-50 p-4 space-y-4 overflow-y-auto"
            style={filterStyle}
          >

          {/* External form selector — searchable list */}
            {forms && forms.length > 0 && onFormSelectorChange && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Form</p>
                <div className="relative mb-1.5">
                  <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search forms…"
                    value={formSearch}
                    onChange={e => setFormSearch(e.target.value)}
                    className="w-full h-8 rounded-md border border-gray-200 pl-7 pr-3 text-xs text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-1"
                    style={{ '--tw-ring-color': 'var(--brand)' } as React.CSSProperties}
                  />
                </div>
                {/* All forms option */}
                <button
                  onClick={() => { onFormSelectorChange(''); setFormSearch(''); }}
                  className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs transition-colors ${
                    !formSelectorValue
                      ? 'font-medium text-white'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                  style={!formSelectorValue ? { backgroundColor: 'var(--brand)' } : undefined}
                >
                  All forms
                </button>
                {/* Filtered form list */}
                <div className="max-h-36 overflow-y-auto mt-0.5 space-y-0.5">
                  {forms
                    .filter(f => !formSearch || f.title.toLowerCase().includes(formSearch.toLowerCase()))
                    .map(f => (
                      <button
                        key={f.id}
                        onClick={() => { onFormSelectorChange(f.id); setFormSearch(''); }}
                        className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs truncate transition-colors ${
                          formSelectorValue === f.id
                            ? 'font-medium text-white'
                            : 'text-gray-600 hover:bg-gray-50'
                        }`}
                        style={formSelectorValue === f.id ? { backgroundColor: 'var(--brand)' } : undefined}
                        title={f.title}
                      >
                        {f.title}
                      </button>
                    ))}
                  {forms.filter(f => !formSearch || f.title.toLowerCase().includes(formSearch.toLowerCase())).length === 0 && (
                    <p className="text-xs text-gray-400 italic px-2.5 py-1.5">No forms match</p>
                  )}
                </div>
              </div>
            )}

            <div className="border-t border-gray-100" />

            {/* Status pills */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">{statusLabel}</p>
              {/* Search input — only shown when there are more than 4 pills */}
              {statusPills.length > 4 && (
                <div className="relative mb-2">
                  <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    placeholder={`Search ${statusLabel.toLowerCase()}…`}
                    value={pillSearch}
                    onChange={e => setPillSearch(e.target.value)}
                    className="w-full h-7 rounded-md border border-gray-200 pl-7 pr-3 text-xs text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-1"
                    style={{ '--tw-ring-color': 'var(--brand)' } as React.CSSProperties}
                  />
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {statusPills
                  .filter(pill => !pillSearch || pill.label.toLowerCase().includes(pillSearch.toLowerCase()))
                  .map(pill => {
                  const active = stagedStatuses.includes(pill.key);
                  return (
                    <button
                      key={pill.key}
                      onClick={() => setStagedStatuses(prev =>
                        prev.includes(pill.key) ? prev.filter(k => k !== pill.key) : [...prev, pill.key]
                      )}
                      className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                        active ? pill.selectedClass + ' border-transparent' : pill.unselectedClass
                      }`}
                    >
                      {pill.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="border-t border-gray-100" />

            {/* Date range — applies live on change */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">{dateLabel}</p>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-xs text-gray-500 mb-1 block">From</label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={e => onDateFromChange(e.target.value)}
                    className={`w-full h-8 rounded-md border px-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:border-transparent ${
                      dateRangeInvalid ? 'border-red-400' : 'border-gray-200'
                    }`}
                    style={{ '--tw-ring-color': 'var(--brand)' } as React.CSSProperties}
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-gray-500 mb-1 block">To</label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={e => onDateToChange(e.target.value)}
                    className={`w-full h-8 rounded-md border px-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:border-transparent ${
                      dateRangeInvalid ? 'border-red-400' : 'border-gray-200'
                    }`}
                    style={{ '--tw-ring-color': 'var(--brand)' } as React.CSSProperties}
                  />
                </div>
              </div>
              {dateRangeInvalid && (
                <p className="text-xs text-red-500 mt-1.5">Start date must be before end date.</p>
              )}
            </div>

            <div className="border-t border-gray-100" />

            {/* Actions */}
            <div className="flex items-center justify-between">
              <button onClick={handleClear} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
                Clear filters
              </button>
              <button
                onClick={handleApply}
                disabled={dateRangeInvalid}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: 'var(--brand)' }}
              >
                Apply
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Sort dropdown ───────────────────────────────────────────────────── */}
      {!hideSortButton && (
      <div ref={sortRef} className="relative shrink-0">
        <button
          onClick={() => { setSortOpen(o => !o); setFilterOpen(false); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition-colors whitespace-nowrap"
        >
          <SortIcon />
          <span className="max-w-[120px] truncate">{activeSortLabel}</span>
          <ChevronDown />
        </button>

        {sortOpen && (
          <div
            className="absolute top-full mt-2 bg-white rounded-xl shadow-lg border border-gray-200 z-50 py-1 overflow-hidden"
            style={sortStyle}
          >
            {sortOptions.map(opt => {
              const isActive = opt.key === activeSort;
              return (
                <button
                  key={opt.key}
                  onClick={() => { onSortChange(opt.key); setSortOpen(false); }}
                  className={`w-full flex items-center justify-between px-4 py-2 text-sm transition-colors ${
                    isActive ? 'font-medium' : 'text-gray-600 hover:bg-gray-50'
                  }`}
                  style={isActive ? { color: 'var(--brand)', backgroundColor: 'color-mix(in srgb, var(--brand) 8%, white)' } : undefined}
                >
                  <span>{opt.label}</span>
                  {isActive && <CheckIcon />}
                </button>
              );
            })}
          </div>
        )}
      </div>
      )}
    </div>
  );
}
