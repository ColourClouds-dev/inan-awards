'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../../../lib/firebase';
import { getAllForms, getAllResponses } from '../../../../lib/firestore';
import { useTenant } from '../../../../contexts/TenantContext';
import FeedbackFormsList from '../../../../components/FeedbackFormsList';
import { FormCardSkeleton, FilterBarSkeleton } from '../../../../components/Skeleton';
import { useWithTimeout } from '../../../../hooks/useWithTimeout';
import { useToast } from '../../../../hooks/useToast';
import Toast from '../../../../components/Toast';
import type { FeedbackForm, FeedbackResponse } from '../../../../types';
export default function FormsPage() {
  const { tenantId, isLoading: tenantLoading, isStaff, currentUid } = useTenant();
  const [authReady, setAuthReady] = useState(false);
  const withTimeout = useWithTimeout();
  const { toasts, showToast, dismissToast } = useToast();
  const [forms, setForms] = useState<FeedbackForm[]>([]);
  const [responses, setResponses] = useState<FeedbackResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, user => { if (user) setAuthReady(true); });
    return () => unsub();
  }, []);

  const fetchData = useCallback(async () => {
    if (!tenantId || tenantLoading || !authReady) return;
    setLoading(true);
    setError(null);
    try {
      // Staff see only their own forms; owners see all
      const createdBy = isStaff && currentUid ? currentUid : undefined;
      const [f, r] = await withTimeout(() => Promise.all([
        getAllForms(tenantId, createdBy),
        getAllResponses(tenantId),
      ]));
      setForms(f);
      setResponses(r);
    } catch (err) {
      setError(
        (err as { isTimeout?: boolean }).isTimeout
          ? 'Taking longer than expected. Check your connection and try again.'
          : 'Failed to load forms. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }, [tenantId, tenantLoading, authReady, isStaff, currentUid]);

  // Manual refresh — re-fetches from Firestore and confirms the updated count
  const handleRefresh = useCallback(async () => {
    if (!tenantId || tenantLoading || !authReady || refreshing) return;
    setRefreshing(true);
    setError(null);
    try {
      const createdBy = isStaff && currentUid ? currentUid : undefined;
      const [f, r] = await withTimeout(() => Promise.all([
        getAllForms(tenantId, createdBy),
        getAllResponses(tenantId),
      ]));
      setForms(f);
      setResponses(r);
      showToast(
        f.length === 0
          ? 'List refreshed — no forms yet.'
          : `List refreshed — ${f.length} form${f.length !== 1 ? 's' : ''} found.`,
        'success'
      );
    } catch (err) {
      showToast(
        (err as { isTimeout?: boolean }).isTimeout
          ? 'Refresh timed out. Check your connection and try again.'
          : 'Refresh failed. Please try again.',
        'error'
      );
    } finally {
      setRefreshing(false);
    }
  }, [tenantId, tenantLoading, authReady, refreshing, withTimeout, showToast, isStaff, currentUid]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading || tenantLoading || !authReady) {
    return (
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between mb-4">
          <div className="h-6 w-40 skeleton-shimmer rounded" />
        </div>
        <FilterBarSkeleton />
        <FormCardSkeleton />
        <FormCardSkeleton />
        <FormCardSkeleton />
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
    <div className="p-6">
      <Toast toasts={toasts} onDismiss={dismissToast} />

      {/* Page header with refresh button */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-900">
          Forms
          <span className="ml-2 text-sm font-normal text-gray-400">({forms.length})</span>
        </h1>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          title="Refresh list"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <svg
            className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      <FeedbackFormsList
        forms={forms}
        responses={responses}
        onFormsChange={setForms}
      />
    </div>
  );
}
