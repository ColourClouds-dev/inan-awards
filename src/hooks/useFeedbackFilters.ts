'use client';

import { useState, useMemo } from 'react';
import type { FeedbackResponse } from '../types';

export type DatePreset = 'today' | '7d' | '30d' | 'custom';

export interface FeedbackFilters {
  formId: string;           // '' = all forms
  datePreset: DatePreset;
  dateFrom: string;         // ISO date string yyyy-mm-dd
  dateTo: string;
  tags: string[];           // active tag label filters (empty = all)
  country: string;          // '' = all
  ratingMin: number;        // 1–5, 0 = no min
  ratingMax: number;        // 1–5, 0 = no max
  search: string;
}

export function defaultFilters(): FeedbackFilters {
  return {
    formId: '',
    datePreset: '30d',
    dateFrom: '',
    dateTo: '',
    tags: [],
    country: '',
    ratingMin: 0,
    ratingMax: 0,
    search: '',
  };
}

/** Resolve the effective date window from a preset or custom range */
export function resolveDateRange(filters: FeedbackFilters): { from: Date | null; to: Date | null } {
  const now = new Date();
  if (filters.datePreset === 'today') {
    const start = new Date(now); start.setHours(0, 0, 0, 0);
    const end   = new Date(now); end.setHours(23, 59, 59, 999);
    return { from: start, to: end };
  }
  if (filters.datePreset === '7d') {
    const start = new Date(now); start.setDate(now.getDate() - 7); start.setHours(0, 0, 0, 0);
    return { from: start, to: null };
  }
  if (filters.datePreset === '30d') {
    const start = new Date(now); start.setDate(now.getDate() - 30); start.setHours(0, 0, 0, 0);
    return { from: start, to: null };
  }
  if (filters.datePreset === 'custom') {
    return {
      from: filters.dateFrom ? new Date(filters.dateFrom) : null,
      to:   filters.dateTo   ? new Date(filters.dateTo + 'T23:59:59') : null,
    };
  }
  return { from: null, to: null }; // 'all'
}

/** Convert a Firestore timestamp / Date / string to a JS Date */
export function toDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (value && typeof (value as any).toDate === 'function') return (value as any).toDate();
  if (value && typeof (value as any).seconds === 'number') return new Date((value as any).seconds * 1000);
  return new Date(value as string);
}

/** Apply all active filters to a flat list of responses */
export function applyFilters(
  responses: FeedbackResponse[],
  filters: FeedbackFilters,
): FeedbackResponse[] {
  const { from, to } = resolveDateRange(filters);

  return responses.filter(r => {
    // Form
    if (filters.formId && r.formId !== filters.formId) return false;

    // Date
    const submitted = toDate(r.submittedAt);
    if (from && submitted < from) return false;
    if (to   && submitted > to)   return false;

    // Tags (AND — response must have ALL selected tags)
    if (filters.tags.length > 0) {
      const responseTagLabels = r.tags?.map(t => t.label) ?? [];
      if (!filters.tags.every(t => responseTagLabels.includes(t))) return false;
    }

    // Country
    if (filters.country && r.visitorCountry !== filters.country) return false;

    // Rating (check any numeric answer in the response)
    if (filters.ratingMin > 0 || filters.ratingMax > 0) {
      const ratings = Object.values(r.responses).filter(
        v => typeof v === 'number' && v >= 1 && v <= 5,
      ) as number[];
      if (ratings.length === 0) return false;
      const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length;
      if (filters.ratingMin > 0 && avg < filters.ratingMin) return false;
      if (filters.ratingMax > 0 && avg > filters.ratingMax) return false;
    }

    // Text search — searches all string answer values
    if (filters.search.trim()) {
      const needle = filters.search.toLowerCase();
      const haystack = Object.values(r.responses)
        .filter(v => typeof v === 'string')
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(needle)) return false;
    }

    return true;
  });
}

export function useFeedbackFilters() {
  const [filters, setFilters] = useState<FeedbackFilters>(defaultFilters);

  const setField = <K extends keyof FeedbackFilters>(key: K, value: FeedbackFilters[K]) =>
    setFilters(prev => ({ ...prev, [key]: value }));

  const toggleTag = (label: string) =>
    setFilters(prev => ({
      ...prev,
      tags: prev.tags.includes(label)
        ? prev.tags.filter(t => t !== label)
        : [...prev.tags, label],
    }));

  const reset = () => setFilters(defaultFilters());

  return { filters, setField, toggleTag, reset };
}
