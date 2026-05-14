'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getNominationsFormById } from '../../../lib/nominationsFirestore';
import NominationsVotingForm from '../../../components/NominationsVotingForm';
import RecaptchaProvider from '../../../components/RecaptchaProvider';
import type { NominationsForm, Tenant } from '../../../types';

export default function NominationsPage() {
  const params = useParams();
  const formId = params?.formId as string;
  const [form, setForm] = useState<NominationsForm | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tenantBranding, setTenantBranding] = useState<Tenant['branding']>(undefined);
  const [tenantName, setTenantName] = useState('');

  useEffect(() => {
    fetch('/api/tenant/current')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.tenant?.branding) {
          setTenantBranding(data.tenant.branding);
          if (data.tenant.branding.primaryColor) {
            document.documentElement.style.setProperty('--brand', data.tenant.branding.primaryColor);
          }
        }
        if (data?.tenant?.name) setTenantName(data.tenant.name);
      })
      .catch(() => {});
  }, []);

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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'var(--brand)' }} />
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
      {/* Tenant logo header */}
      {tenantBranding?.logoUrl && (
        <div className="flex justify-center pt-6 pb-2">
          <img
            src={tenantBranding.logoUrl}
            alt={tenantName}
            className="h-10 w-auto max-w-[180px] object-contain"
          />
        </div>
      )}
      <NominationsVotingForm form={form} />
    </RecaptchaProvider>
  );
}
