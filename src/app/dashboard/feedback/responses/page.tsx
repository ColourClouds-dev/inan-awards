'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../../../lib/firebase';
import { getAllForms, getAllResponses } from '../../../../lib/firestore';
import { exportToExcel } from '../../../../lib/exportToExcel';
import { useTenant } from '../../../../contexts/TenantContext';
import { useFeedbackFilters, applyFilters, toDate } from '../../../../hooks/useFeedbackFilters';
import FeedbackFilterBar from '../../../../components/FeedbackFilterBar';
import FeedbackFormsList from '../../../../components/FeedbackFormsList';
import type { FeedbackForm, FeedbackResponse, ResponseTag } from '../../../../types';

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

  const { filters, setField, toggleTag, reset } = useFeedbackFilters();

  // Wait for auth before querying Firestore
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

  const filtered = useMemo(() => applyFilters(responses, filters), [responses, filters]);

  if (loading || tenantLoading || !authReady) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
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
      {/* Forms list */}
      <section className="space-y-0">
        <FeedbackFormsList
          forms={forms}
          responses={responses}
          onFormsChange={setForms}
        />
      </section>

      <hr className="border-gray-200" />

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Responses</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Showing <span className="font-medium text-gray-700">{filtered.length}</span> of{' '}
            <span className="font-medium text-gray-700">{responses.length}</span> total responses
          </p>
        </div>
        <button
          onClick={() => exportToExcel(filtered, forms)}
          disabled={filtered.length === 0}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-40"
          style={{ backgroundColor: 'var(--brand)' }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export Excel
        </button>
      </div>

      {/* Filter bar */}
      <FeedbackFilterBar
        filters={filters}
        forms={forms}
        responses={responses}
        setField={setField}
        toggleTag={toggleTag}
        reset={reset}
      />

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {filtered.length === 0 ? (
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
                {filtered.map(r => (
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
