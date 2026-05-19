'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { getAllForms, saveForm } from '../../../lib/firestore';
import FeedbackFormBuilder from '../../../components/FeedbackFormBuilder';
import Toast from '../../../components/Toast';
import { useToast } from '../../../hooks/useToast';
import { useTenant } from '../../../contexts/TenantContext';
import type { FeedbackForm } from '../../../types';

export default function FeedbackDashboardPage() {
  const { toasts, showToast, dismissToast } = useToast();
  const { tenant, tenantId, isLoading: tenantLoading } = useTenant();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // We still need to fetch forms so the builder can check the form limit
  const fetchData = useCallback(async () => {
    if (!tenantId || tenantLoading) return;
    setLoading(false);
    setError(null);
  }, [tenantId, tenantLoading]);

  useEffect(() => {
    if (!tenantLoading && tenantId) fetchData();
  }, [fetchData, tenantId, tenantLoading]);

  const handleSaveForm = async (form: FeedbackForm) => {
    await saveForm(form, tenantId);
    await getAllForms(tenantId); // refresh tenant form count
    showToast('Form saved.', 'success');
  };

  if (loading || tenantLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" role="status" aria-label="Loading" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded">
          <p className="text-sm font-medium text-red-700">{error}</p>
          <button onClick={fetchData} className="mt-2 text-sm text-red-600 underline hover:text-red-800">Retry</button>
        </div>
      </div>
    );
  }

  if (!tenantLoading && tenant?.features?.feedbackForms === false) {
    return (
      <div className="p-6">
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <h2 className="text-xl font-semibold text-gray-700 mb-2">Feature Not Available</h2>
          <p className="text-gray-500">Feedback forms are not available on your current plan. Please contact support to upgrade.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <Toast toasts={toasts} onDismiss={dismissToast} />
      <FeedbackFormBuilder onSave={handleSaveForm} />
    </div>
  );
}
