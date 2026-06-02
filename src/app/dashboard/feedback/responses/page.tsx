'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { auth } from '../../../../lib/firebase';
import { getAllForms, getAllResponses } from '../../../../lib/firestore';
import { exportToExcel } from '../../../../lib/exportToExcel';
import { useTenant } from '../../../../contexts/TenantContext';
import { toDate } from '../../../../hooks/useFeedbackFilters';
import FilterSortBar from '../../../../components/FilterSortBar';
import { FilterBarSkeleton, TableRowSkeleton } from '../../../../components/Skeleton';
import type { FeedbackForm, FeedbackResponse, ResponseTag } from '../../../../types';

// ── Constants ─────────────────────────────────────────────────────────────────

const TAG_STATUS_PILLS = [
  { key: 'sentiment', label: 'Sentiment', selectedClass: 'bg-purple-100 text-purple-800', unselectedClass: 'border-purple-200 text-purple-700 hover:bg-purple-50' },
  { key: 'time',      label: 'Time',      selectedClass: 'bg-blue-100 text-blue-800',     unselectedClass: 'border-blue-200 text-blue-700 hover:bg-blue-50' },
  { key: 'completion',label: 'Completion',selectedClass: 'bg-green-100 text-green-800',   unselectedClass: 'border-green-200 text-green-700 hover:bg-green-50' },
  { key: 'custom',    label: 'Custom',    selectedClass: 'bg-yellow-100 text-yellow-800', unselectedClass: 'border-yellow-200 text-yellow-700 hover:bg-yellow-50' },
];

const SORT_OPTIONS = [
  { key: 'submitted_desc', label: 'Submitted ↓' },
  { key: 'submitted_asc',  label: 'Submitted ↑' },
  { key: 'form_asc',       label: 'Form A → Z' },
  { key: 'form_desc',      label: 'Form Z → A' },
  { key: 'country_asc',    label: 'Country A → Z' },
  { key: 'country_desc',   label: 'Country Z → A' },
  { key: 'time_desc',      label: 'Time Spent ↓' },
  { key: 'time_asc',       label: 'Time Spent ↑' },
];

type SortKey = 'submitted_desc' | 'submitted_asc' | 'form_asc' | 'form_desc' | 'country_asc' | 'country_desc' | 'time_desc' | 'time_asc';

// ── Helpers ───────────────────────────────────────────────────────────────────

const tagColorClasses: Record<string, string> = {
  green:  'bg-green-100 text-green-800',
  yellow: 'bg-yellow-100 text-yellow-800',
  red:    'bg-red-100 text-red-800',
  blue:   'bg-blue-100 text-blue-800',
  gray:   'bg-gray-100 text-gray-600',
};

function TagBadge({ tag }: { tag: ResponseTag }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${tagColorClasses[tag.color] ?? 'bg-gray-100 text-gray-600'}`}>
      {tag.label}
    </span>
  );
}

const ChevronIcon = ({ open }: { open: boolean }) => (
  <svg className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

// ── Expandable response row ───────────────────────────────────────────────────

function ResponseRow({ response, form }: { response: FeedbackResponse; form: FeedbackForm | undefined }) {
  const [open, setOpen] = useState(false);
  const submittedAt = toDate(response.submittedAt).toLocaleString();

  return (
    <>
      <tr className="hover:bg-gray-50 cursor-pointer" onClick={() => setOpen(o => !o)}>
        <td className="px-4 py-3 text-sm text-gray-700 font-medium">
          {form?.title ?? <span className="text-gray-400 italic">Unknown form</span>}
        </td>
        <td className="px-4 py-3 text-sm text-gray-500">{submittedAt}</td>
        <td className="px-4 py-3 text-sm text-gray-500">{response.visitorCountry ?? '—'}</td>
        <td className="px-4 py-3 text-sm text-gray-500">{response.visitorCity ?? '—'}</td>
        <td className="px-4 py-3">
          <div className="flex flex-wrap gap-1">
            {response.tags?.length
              ? response.tags.map((tag, i) => <TagBadge key={i} tag={tag} />)
              : <span className="text-xs text-gray-400">—</span>}
          </div>
        </td>
        <td className="px-4 py-3 text-sm text-gray-500">
          {response.timeSpentSeconds != null
            ? `${Math.floor(response.timeSpentSeconds / 60)}m ${response.timeSpentSeconds % 60}s`
            : '—'}
        </td>
        <td className="px-4 py-3 text-gray-400"><ChevronIcon open={open} /></td>
      </tr>

      {open && (
        <tr className="bg-purple-50">
          <td colSpan={7} className="px-6 py-4">
            <div className="space-y-2">
              {form?.questions.map(q => {
                const val = response.responses[q.id];
                return val !== undefined ? (
                  <div key={q.id} className="text-sm">
                    <span className="font-medium text-gray-700">{q.question}: </span>
                    <span className="text-gray-600">{String(val)}</span>
                  </div>
                ) : null;
              })}
              {response.visitorIp && (
                <p className="text-xs text-gray-400 pt-1">
                  IP: {response.visitorIp} · ISP: {response.visitorIsp ?? '—'}
                </p>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ResponsesPage() {
  const { tenantId, isLoading: tenantLoading } = useTenant();
  const [authReady, setAuthReady] = useState(false);
  const [forms, setForms] = useState<FeedbackForm[]>([]);
  const [responses, setResponses] = useState<FeedbackResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pre-seed formId from ?formId= query param
  const searchParams = useSearchParams();
  const initialFormId = searchParams?.get('formId') ?? '';

  // Filter/sort state
  const [search, setSearch] = useState('');
  const [selectedTagTypes, setSelectedTagTypes] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [activeSort, setActiveSort] = useState<SortKey>('submitted_desc');
  const [formId, setFormId] = useState(initialFormId);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, user => { if (user) setAuthReady(true); });
    return () => unsub();
  }, []);

  const fetchData = useCallback(async () => {
    if (!tenantId || tenantLoading || !authReady) return;
    setLoading(true);
    setError(null);
    try {
      const [f, r] = await Promise.all([getAllForms(tenantId), getAllResponses(tenantId)]);
      setForms(f);
      setResponses(r);
    } catch {
      setError('Failed to load responses. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [tenantId, tenantLoading, authReady]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const formMap = useMemo(() => new Map(forms.map(f => [f.id, f])), [forms]);

  const handleTagTypeToggle = (key: string) =>
    setSelectedTagTypes(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);

  const handleClearFilters = () => {
    setSelectedTagTypes([]);
    setDateFrom('');
    setDateTo('');
    setFormId('');
    setSearch('');
  };

  // Derive the active form name for the breadcrumb
  const activeFormName = formId ? formMap.get(formId)?.title : null;

  const filteredAndSorted = useMemo(() => {
    const needle = search.toLowerCase();

    let result = responses.filter(r => {
      // Form filter
      if (formId && r.formId !== formId) return false;

      // Text search: form title, country, city
      if (needle) {
        const formTitle = formMap.get(r.formId)?.title?.toLowerCase() ?? '';
        const country = (r.visitorCountry ?? '').toLowerCase();
        const city = (r.visitorCity ?? '').toLowerCase();
        if (!formTitle.includes(needle) && !country.includes(needle) && !city.includes(needle)) return false;
      }

      // Tag type filter
      if (selectedTagTypes.length > 0) {
        const hasMatch = r.tags?.some(t => selectedTagTypes.includes(t.type));
        if (!hasMatch) return false;
      }

      // Date range
      const submitted = toDate(r.submittedAt);
      if (dateFrom && submitted < new Date(dateFrom)) return false;
      if (dateTo   && submitted > new Date(dateTo + 'T23:59:59')) return false;

      return true;
    });

    // Sort
    switch (activeSort) {
      case 'submitted_asc':  result = [...result].sort((a, b) => toDate(a.submittedAt).getTime() - toDate(b.submittedAt).getTime()); break;
      case 'submitted_desc': result = [...result].sort((a, b) => toDate(b.submittedAt).getTime() - toDate(a.submittedAt).getTime()); break;
      case 'form_asc':       result = [...result].sort((a, b) => (formMap.get(a.formId)?.title ?? '').localeCompare(formMap.get(b.formId)?.title ?? '')); break;
      case 'form_desc':      result = [...result].sort((a, b) => (formMap.get(b.formId)?.title ?? '').localeCompare(formMap.get(a.formId)?.title ?? '')); break;
      case 'country_asc':    result = [...result].sort((a, b) => (a.visitorCountry ?? '').localeCompare(b.visitorCountry ?? '')); break;
      case 'country_desc':   result = [...result].sort((a, b) => (b.visitorCountry ?? '').localeCompare(a.visitorCountry ?? '')); break;
      case 'time_asc':       result = [...result].sort((a, b) => (a.timeSpentSeconds ?? 0) - (b.timeSpentSeconds ?? 0)); break;
      case 'time_desc':      result = [...result].sort((a, b) => (b.timeSpentSeconds ?? 0) - (a.timeSpentSeconds ?? 0)); break;
    }

    return result;
  }, [responses, formMap, search, selectedTagTypes, dateFrom, dateTo, activeSort]);

  if (loading || tenantLoading || !authReady) {
    return (
      <div className="p-6 space-y-6">
        <div className="h-7 w-32 skeleton-shimmer rounded" />
        <FilterBarSkeleton />
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-100 text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Form','Submitted','Country','City','Tags','Time Spent',''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {[1,2,3,4,5].map(i => <TableRowSkeleton key={i} cols={7} />)}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded">
          <p className="text-sm text-red-700">{error}</p>
          <button onClick={fetchData} className="mt-2 text-sm text-red-600 underline">Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Breadcrumb — shown when pre-filtered to a specific form */}
      {activeFormName && (
        <div className="flex items-center gap-2 text-sm">
          <Link href="/dashboard/feedback/forms" className="text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Forms
          </Link>
          <span className="text-gray-300">/</span>
          <span className="text-gray-600 font-medium truncate max-w-[200px]">{activeFormName}</span>
        </div>
      )}

      {/* Responses header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            {activeFormName ? `Responses — ${activeFormName}` : 'Responses'}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Showing <span className="font-medium text-gray-700">{filteredAndSorted.length}</span> of{' '}
            <span className="font-medium text-gray-700">{responses.length}</span> total responses
          </p>
        </div>
        <button
          onClick={() => exportToExcel(filteredAndSorted, forms)}
          disabled={filteredAndSorted.length === 0}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-40"
          style={{ backgroundColor: 'var(--brand)' }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export Excel
        </button>
      </div>

      {/* Filter/sort bar */}
      <FilterSortBar
        searchPlaceholder="Search by form, country, or city…"
        search={search}
        onSearchChange={setSearch}
        statusPills={TAG_STATUS_PILLS}
        selectedStatuses={selectedTagTypes}
        onStatusToggle={handleTagTypeToggle}
        statusLabel="Tag Type"
        dateLabel="Submitted Date"
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        sortOptions={SORT_OPTIONS}
        activeSort={activeSort}
        onSortChange={k => setActiveSort(k as SortKey)}
        onClearFilters={handleClearFilters}
        // form selector driven by local state so query param pre-filter works
        formSelectorValue={formId}
        onFormSelectorChange={setFormId}
        forms={forms}
      />

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {filteredAndSorted.length === 0 ? (
          <div className="py-16 text-center">
            <svg className="mx-auto w-10 h-10 text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-sm text-gray-400">No responses match the current filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {['Form', 'Submitted', 'Country', 'City', 'Tags', 'Time Spent', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {filteredAndSorted.map(r => (
                  <ResponseRow key={r.id} response={r} form={formMap.get(r.formId)} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
