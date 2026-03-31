'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getFormById } from '../../../lib/firestore';
import FeedbackForm from '../../../components/FeedbackForm';
import type { FeedbackForm as FeedbackFormType } from '../../../types';

export default function FeedbackPageClient() {
  const params = useParams();
  const formId = params?.formId as string;

  const [form, setForm] = useState<FeedbackFormType | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [inactive, setInactive] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!formId) return;

    const fetchForm = async () => {
      try {
        const fetchedForm = await getFormById(formId);
        if (fetchedForm === null) {
          setNotFound(true);
          return;
        }
        if (fetchedForm.isActive === false) {
          setInactive(true);
          return;
        }
        setForm(fetchedForm);
      } catch (err) {
        console.error('Error fetching form:', err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };

    fetchForm();
  }, [formId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <p className="text-sm text-red-700">Form not found</p>
        </div>
      </div>
    );
  }

  if (inactive) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
          <p className="text-sm text-yellow-700">This form is no longer active</p>
        </div>
      </div>
    );
  }

  if (!form) {
    return null;
  }

  return <FeedbackForm form={form} />;
}
