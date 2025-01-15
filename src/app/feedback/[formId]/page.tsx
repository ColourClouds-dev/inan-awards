'use client';

import React, { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import FeedbackForm from '../../../components/FeedbackForm';
import type { FeedbackForm as FeedbackFormType } from '../../../types';

export default function FeedbackPage({ params }: { params: { formId: string } }) {
  const [form, setForm] = useState<FeedbackFormType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchForm = async () => {
      try {
        const formDoc = await getDoc(doc(db, 'feedback-forms', params.formId));
        if (!formDoc.exists()) {
          setError('Form not found');
          return;
        }

        const formData = { ...formDoc.data(), id: formDoc.id } as FeedbackFormType;
        if (!formData.isActive) {
          setError('This form is no longer active');
          return;
        }

        setForm(formData);
      } catch (error) {
        console.error('Error fetching form:', error);
        setError('Failed to load form. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchForm();
  }, [params.formId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!form) {
    return null;
  }

  return <FeedbackForm form={form} />;
}
