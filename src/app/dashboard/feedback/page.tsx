'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { getAllForms, getAllResponses, saveForm, deactivateForm, deleteForm } from '../../../lib/firestore';
import { exportToExcel } from '../../../lib/exportToExcel';
import FeedbackFormBuilder from '../../../components/FeedbackFormBuilder';
import ResponsesTable from '../../../components/ResponsesTable';
import Toast from '../../../components/Toast';
import { useToast } from '../../../hooks/useToast';
import type { FeedbackForm, FeedbackResponse } from '../../../types';

export default function FeedbackDashboardPage() {
  const { toasts, showToast, dismissToast } = useToast();
  const [forms, setForms] = useState<FeedbackForm[]>([]);
  const [responses, setResponses] = useState<FeedbackResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deactivating, setDeactivating] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

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

  const handleCopyLink = (formId: string) => {
    const url = `${window.location.origin}/feedback/${formId}`;
    navigator.clipboard.writeText(url);
    setCopiedId(formId);
    showToast('Link copied to clipboard!', 'success');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDeactivate = async (formId: string) => {
    if (!confirm('Deactivate this form? Guests will no longer be able to submit responses.')) return;
    setDeactivating(formId);
    try {
      await deactivateForm(formId);
      setForms(prev => prev.map(f => f.id === formId ? { ...f, isActive: false } : f));
      showToast('Form deactivated successfully.', 'success');
    } catch (err) {
      console.error('Error deactivating form:', err);
      showToast('Failed to deactivate form. Please try again.', 'error');
    } finally {
      setDeactivating(null);
    }
  };

  const handleDelete = async (formId: string) => {
    if (!confirm('Permanently delete this form? This cannot be undone.')) return;
    setDeleting(formId);
    try {
      await deleteForm(formId);
      setForms(prev => prev.filter(f => f.id !== formId));
      showToast('Form deleted successfully.', 'success');
    } catch (err) {
      console.error('Error deleting form:', err);
      showToast('Failed to delete form. Please try again.', 'error');
    } finally {
      setDeleting(null);
    }
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
      <Toast toasts={toasts} onDismiss={dismissToast} />
      <section>
        <FeedbackFormBuilder onSave={handleSaveForm} />
      </section>

      {/* Feedback Forms List */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Feedback Forms</h2>
        {forms.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">
            No forms created yet. Use the builder above to create your first form.
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {forms.map(form => {
                  const createdAt = form.createdAt instanceof Date
                    ? form.createdAt
                    : new Date((form.createdAt as any).seconds * 1000);
                  return (
                    <tr key={form.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{form.title}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{form.location}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{createdAt.toLocaleDateString()}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          form.isActive
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {form.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm space-x-3">
                        <button
                          onClick={() => handleCopyLink(form.id)}
                          className="text-purple-600 hover:text-purple-800 font-medium"
                        >
                          {copiedId === form.id ? 'Copied!' : 'Copy Link'}
                        </button>
                        {form.isActive && (
                          <button
                            onClick={() => handleDeactivate(form.id)}
                            disabled={deactivating === form.id}
                            className="text-red-500 hover:text-red-700 font-medium disabled:opacity-50"
                          >
                            {deactivating === form.id ? 'Deactivating...' : 'Deactivate'}
                          </button>
                        )}
                        {!form.isActive && (
                          <button
                            onClick={() => handleDelete(form.id)}
                            disabled={deleting === form.id}
                            className="text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
                          >
                            {deleting === form.id ? 'Deleting...' : 'Delete'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
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
