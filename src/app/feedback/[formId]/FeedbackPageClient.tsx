'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getFormById, getFormBySlug } from '../../../lib/firestore';
import FeedbackForm from '../../../components/FeedbackForm';
import type { FeedbackForm as FeedbackFormType, Tenant } from '../../../types';

/** Simple UUID v4 shape check — slugs never look like this */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function FeedbackPageClient() {
  const params = useParams();
  const formId = params?.formId as string;

  const [form, setForm] = useState<FeedbackFormType | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [inactive, setInactive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tenantBranding, setTenantBranding] = useState<Tenant['branding'] | undefined>(undefined);
  const [tenantFeatures, setTenantFeatures] = useState<Tenant['features'] | undefined>(undefined);
  const [tenantId, setTenantId] = useState<string | null>(null);

  useEffect(() => {
    // Fetch tenant branding for public page styling
    fetch('/api/tenant/current')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.tenant?.branding) {
          setTenantBranding(data.tenant.branding);
          if (data.tenant.branding.primaryColor) {
            document.documentElement.style.setProperty('--brand', data.tenant.branding.primaryColor);
          }
        }
        if (data?.tenant?.features) {
          setTenantFeatures(data.tenant.features);
        }
        const resolvedId = data?.tenant?.id || data?.tenantId || 'inan';
        setTenantId(resolvedId);
      })
      .catch(() => {
        setTenantId('inan');
      });
  }, []);

  useEffect(() => {
    if (!formId) return;

    const isUUID = UUID_RE.test(formId);

    // For UUID: fetch immediately
    // For slug: wait for tenantId
    if (!isUUID && !tenantId) return;

    const fetchForm = async () => {
      try {
        // 1. Try server Admin API lookup (bypasses client security rules and index limitations)
        const lookupUrl = `/api/forms/lookup?idOrSlug=${encodeURIComponent(formId)}${tenantId ? `&tenantId=${encodeURIComponent(tenantId)}` : ''}`;
        const res = await fetch(lookupUrl);
        if (res.ok) {
          const data = await res.json();
          if (data?.form) {
            if (data.form.isActive === false) {
              setInactive(true);
              return;
            }
            setForm(data.form);
            return;
          }
        }

        // 2. Fallback to client-side Firestore SDK
        let fetchedForm: FeedbackFormType | null = null;
        if (isUUID) {
          fetchedForm = await getFormById(formId);
        } else if (tenantId) {
          fetchedForm = await getFormBySlug(formId, tenantId);
        }

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
  }, [formId, tenantId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'var(--brand)' }} />
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

  return <FeedbackForm form={form} tenantBranding={tenantBranding} tenantFeatures={tenantFeatures} />;
}
