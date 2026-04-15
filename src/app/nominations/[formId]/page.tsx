'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getNominationsFormById } from '../../../lib/nominationsFirestore';
import NominationsVotingForm from '../../../components/NominationsVotingForm';
import RecaptchaProvider from '../../../components/RecaptchaProvider';
import type { NominationsForm } from '../../../types';

export default function NominationsPage() {
  const params = useParams();
  const formId = params?.formId as string;
  const [form, setForm] = useState<NominationsForm | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!formId) return;
    getNominationsFormById(formId)
      .then(f => { if (!f) setNotFound(true); else setForm(f); })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [formId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
      </div>
    );
  }

  if (notFound || !form) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-white rounded-xl shadow p-8 text-center max-w-sm">
          <p className="text-gray-600">Nominations form not found.</p>
        </div>
      </div>
    );
  }

  return (
    <RecaptchaProvider>
      <NominationsVotingForm form={form} />
    </RecaptchaProvider>
  );
}
