'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../../../lib/firebase';
import { getAllForms, getAllResponses } from '../../../../lib/firestore';
import { useTenant } from '../../../../contexts/TenantContext';
import FeedbackFormsList from '../../../../components/FeedbackFormsList';
import { FormCardSkeleton, FilterBarSkeleton } from '../../../../components/Skeleton';
import type { FeedbackForm, FeedbackResponse } from '../../../../types';

export default function FormsPage() {
  const { tenantId, isLoading: tenantLoading } = useTenant();
  const [authReady, setAuthReady] = useState(false);
  const [forms, setForms] = useState<FeedbackForm[]>([]);
  const [responses, setResponses] = useState<FeedbackResponse[]>([]);
  const [loading, setLoading] = useState(true);
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
      const [f, r] = await Promise.all([getAllForms(tenantId), getAllResponses(tenantId)]);
      setForms(f);
      setResponses(r);
    } catch {
      setError('Failed to load forms. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [tenantId, tenantLoading, authReady]);

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
      <FeedbackFormsList
        forms={forms}
        responses={responses}
        onFormsChange={setForms}
      />
    </div>
  );
}
