'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { getAllForms, getAllResponses, saveForm } from '../../../lib/firestore';
import { exportToExcel } from '../../../lib/exportToExcel';
import FeedbackFormBuilder from '../../../components/FeedbackFormBuilder';
import ResponsesTable from '../../../components/ResponsesTable';
import type { FeedbackForm, FeedbackResponse } from '../../../types';

export default function FeedbackDashboardPage() {
  const [forms, setForms] = useState<FeedbackForm[]>([]);
  const [responses, setResponses] = useState<FeedbackResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [fetchedForms, fetchedResponses] = await Promise.all([
        getAllForms(),
        getAllResponses(),
      ]);
      setForms(fetchedForms);
      setResponses(fetchedResponses);
    } catch (err) {
      console.error('Error fetching feedback data:', err);
      setError('Failed to load feedback data. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSaveForm = async (form: FeedbackForm): Promise<void> => {
    await saveForm(form);
    const refreshedForms = await getAllForms();
    setForms(refreshedForms);
  };

  const handleExport = () => {
    exportToExcel(responses, forms);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div
          className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"
          role="status"
          aria-label="Loading feedback data"
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded">
          <p className="text-sm font-medium text-red-700">{error}</p>
          <button
            onClick={fetchData}
            className="mt-2 text-sm text-red-600 underline hover:text-red-800"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-10">
      <section>
        <FeedbackFormBuilder onSave={handleSaveForm} />
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">Submitted Responses</h2>
        <ResponsesTable
          responses={responses}
          forms={forms}
          onExport={handleExport}
        />
      </section>
    </div>
  );
}
