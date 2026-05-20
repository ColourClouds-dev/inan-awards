'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../../../lib/firebase';
import { getAllForms, getAllResponses } from '../../../../lib/firestore';
import { useTenant } from '../../../../contexts/TenantContext';
import { useFeedbackFilters, applyFilters, resolveDateRange, toDate } from '../../../../hooks/useFeedbackFilters';
import FeedbackFilterBar from '../../../../components/FeedbackFilterBar';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts';
import type { FeedbackForm, FeedbackResponse } from '../../../../types';

// ── Types ─────────────────────────────────────────────────────────────────────

type TagType = 'sentiment' | 'time' | 'completion' | 'custom';
type Granularity = 'daily' | 'weekly' | 'monthly';

const TAG_TYPES: { key: TagType; label: string }[] = [
  { key: 'sentiment',  label: 'Sentiment' },
  { key: 'time',       label: 'Time' },
  { key: 'completion', label: 'Completion' },
  { key: 'custom',     label: 'Custom' },
];

const GRANULARITIES: { key: Granularity; label: string }[] = [
  { key: 'daily',   label: 'Daily' },
  { key: 'weekly',  label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
];

// A palette of distinct colors for chart lines
const LINE_COLORS = [
  '#7C3AED', '#10B981', '#EF4444', '#3B82F6',
  '#F59E0B', '#8B5CF6', '#EC4899', '#14B8A6',
];

// ── Bucketing helpers ─────────────────────────────────────────────────────────

function bucketKey(date: Date, granularity: Granularity): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  if (granularity === 'daily')   return `${y}-${m}-${d}`;
  if (granularity === 'monthly') return `${y}-${m}`;
  // weekly — ISO week label "YYYY-Www"
  const jan1 = new Date(y, 0, 1);
  const week = Math.ceil(((date.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
  return `${y}-W${String(week).padStart(2, '0')}`;
}

/** Fill in missing buckets between min and max so the line is continuous */
function fillBuckets(
  data: Record<string, Record<string, number>>,
  tagLabels: string[],
  granularity: Granularity,
  from: Date,
  to: Date,
): { bucket: string; [label: string]: number | string }[] {
  const buckets: string[] = [];
  const cursor = new Date(from);
  cursor.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(23, 59, 59, 999);

  while (cursor <= end) {
    const key = bucketKey(cursor, granularity);
    if (!buckets.includes(key)) buckets.push(key);
    if (granularity === 'daily')   cursor.setDate(cursor.getDate() + 1);
    if (granularity === 'weekly')  cursor.setDate(cursor.getDate() + 7);
    if (granularity === 'monthly') cursor.setMonth(cursor.getMonth() + 1);
  }

  return buckets.map(bucket => {
    const row: { bucket: string; [label: string]: number | string } = { bucket };
    tagLabels.forEach(label => {
      row[label] = data[bucket]?.[label] ?? 0;
    });
    return row;
  });
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const { tenantId, isLoading: tenantLoading } = useTenant();
  const [authReady, setAuthReady] = useState(false);
  const [forms, setForms] = useState<FeedbackForm[]>([]);
  const [responses, setResponses] = useState<FeedbackResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [tagType, setTagType] = useState<TagType>('sentiment');
  const [granularity, setGranularity] = useState<Granularity>('daily');

  const { filters, setField, toggleTag, reset } = useFeedbackFilters();

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
      setError('Failed to load analytics data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [tenantId, tenantLoading, authReady]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Apply date + form filters (no tag/rating/search — analytics scopes by tag type instead)
  const filtered = useMemo(() => applyFilters(responses, { ...filters, tags: [], ratingMin: 0, ratingMax: 0, search: '' }), [responses, filters]);

  // Resolve the effective date window for axis bounds
  const { from: resolvedFrom, to: resolvedTo } = useMemo(() => resolveDateRange(filters), [filters]);
  const axisFrom = resolvedFrom ?? (filtered.length ? toDate(filtered[filtered.length - 1].submittedAt) : new Date());
  const axisTo   = resolvedTo   ?? new Date();

  // Collect all tag labels of the selected type
  const tagLabels = useMemo(() => {
    const labels = new Set<string>();
    filtered.forEach(r => r.tags?.filter(t => t.type === tagType).forEach(t => labels.add(t.label)));
    return Array.from(labels).sort();
  }, [filtered, tagType]);

  // Build bucketed data
  const chartData = useMemo(() => {
    if (tagLabels.length === 0) return [];

    // Accumulate counts per bucket per label
    const bucketMap: Record<string, Record<string, number>> = {};
    filtered.forEach(r => {
      const date = toDate(r.submittedAt);
      const key = bucketKey(date, granularity);
      if (!bucketMap[key]) bucketMap[key] = {};
      r.tags?.filter(t => t.type === tagType).forEach(t => {
        bucketMap[key][t.label] = (bucketMap[key][t.label] ?? 0) + 1;
      });
    });

    return fillBuckets(bucketMap, tagLabels, granularity, axisFrom, axisTo);
  }, [filtered, tagType, granularity, tagLabels, axisFrom, axisTo]);

  // Summary counts for the stat pills above the chart
  const summaryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    tagLabels.forEach(l => { counts[l] = 0; });
    filtered.forEach(r => r.tags?.filter(t => t.type === tagType).forEach(t => { counts[t.label] = (counts[t.label] ?? 0) + 1; }));
    return counts;
  }, [filtered, tagType, tagLabels]);

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
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Analytics</h1>
        <p className="text-sm text-gray-500 mt-0.5">Tag trends over time across your feedback forms</p>
      </div>

      {/* Filter bar (compact — no tag pills / rating / search) */}
      <FeedbackFilterBar
        filters={filters}
        forms={forms}
        responses={responses}
        setField={setField}
        toggleTag={toggleTag}
        reset={reset}
        compact
      />

      {/* Chart controls */}
      <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Tag type selector */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Tag type</span>
            <div className="flex rounded-md border border-gray-200 overflow-hidden h-8">
              {TAG_TYPES.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setTagType(key)}
                  className={`px-3 text-sm font-medium transition-colors border-r border-gray-200 last:border-r-0 ${
                    tagType === key ? 'text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                  style={tagType === key ? { backgroundColor: 'var(--brand)' } : undefined}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Granularity toggle */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Granularity</span>
            <div className="flex rounded-md border border-gray-200 overflow-hidden h-8">
              {GRANULARITIES.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setGranularity(key)}
                  className={`px-3 text-sm font-medium transition-colors border-r border-gray-200 last:border-r-0 ${
                    granularity === key ? 'text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                  style={granularity === key ? { backgroundColor: 'var(--brand)' } : undefined}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Summary stat pills */}
        {tagLabels.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {tagLabels.map((label, i) => (
              <div
                key={label}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-50 border border-gray-200 text-sm"
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: LINE_COLORS[i % LINE_COLORS.length] }}
                />
                <span className="text-gray-700 font-medium">{label}</span>
                <span className="text-gray-400">{summaryCounts[label] ?? 0}</span>
              </div>
            ))}
          </div>
        )}

        {/* Line chart */}
        {chartData.length === 0 || tagLabels.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <svg className="w-10 h-10 text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <p className="text-sm text-gray-400">
              No <span className="font-medium">{tagType}</span> tags found in the selected period.
            </p>
            <p className="text-xs text-gray-400 mt-1">Try a different tag type, form, or date range.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="bucket"
                tick={{ fontSize: 11, fill: '#9CA3AF' }}
                tickLine={false}
                axisLine={{ stroke: '#E5E7EB' }}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 11, fill: '#9CA3AF' }}
                tickLine={false}
                axisLine={false}
                width={28}
              />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E5E7EB', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
                labelStyle={{ fontWeight: 600, color: '#374151', marginBottom: 4 }}
              />
              <Legend
                wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
                iconType="circle"
                iconSize={8}
              />
              {tagLabels.map((label, i) => (
                <Line
                  key={label}
                  type="monotone"
                  dataKey={label}
                  stroke={LINE_COLORS[i % LINE_COLORS.length]}
                  strokeWidth={2}
                  dot={{ r: 3, strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
