'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getResponseById, getFormById } from '../../../lib/firestore';
import { getTenantById } from '../../../lib/tenantFirestore';
import type { FeedbackResponse, FeedbackForm, Tenant } from '../../../types';

export default function PublicResponsePage() {
  const params = useParams();
  const responseId = params?.responseId as string;

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [sharingDisabled, setSharingDisabled] = useState(false);
  const [response, setResponse] = useState<FeedbackResponse | null>(null);
  const [form, setForm] = useState<FeedbackForm | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);

  useEffect(() => {
    if (!responseId) return;

    const loadData = async () => {
      try {
        // 1. Fetch Response
        const fetchedResponse = await getResponseById(responseId);
        if (!fetchedResponse) {
          setNotFound(true);
          setLoading(false);
          return;
        }
        setResponse(fetchedResponse);

        // 2. Fetch Tenant settings
        const tenantId = fetchedResponse.tenantId || 'inan';
        const fetchedTenant = await getTenantById(tenantId);
        if (fetchedTenant) {
          setTenant(fetchedTenant);
          // Apply branding color dynamically
          if (fetchedTenant.branding?.primaryColor) {
            document.documentElement.style.setProperty('--brand', fetchedTenant.branding.primaryColor);
          }
          // Validate response sharing flag
          if (!fetchedTenant.features?.allowResponseSharing) {
            setSharingDisabled(true);
            setLoading(false);
            return;
          }
        } else {
          // If tenant doesn't exist, block sharing by default for safety
          setSharingDisabled(true);
          setLoading(false);
          return;
        }

        // 3. Fetch Form
        const fetchedForm = await getFormById(fetchedResponse.formId);
        if (!fetchedForm) {
          setNotFound(true);
          setLoading(false);
          return;
        }
        setForm(fetchedForm);

      } catch (err) {
        console.error('Error loading public response data:', err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [responseId]);

  // Format date helper
  const getFormattedDate = (dateVal: any): string => {
    if (!dateVal) return '';
    if (dateVal instanceof Date) return dateVal.toLocaleString();
    if (typeof dateVal === 'object' && dateVal.seconds) {
      return new Date(dateVal.seconds * 1000).toLocaleString();
    }
    if (typeof dateVal === 'string') return new Date(dateVal).toLocaleString();
    return '';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'var(--brand)' }} />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <svg className="w-12 h-12 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Response Not Found</h2>
          <p className="text-gray-600 text-sm">The response link you followed does not exist or may have been deleted.</p>
        </div>
      </div>
    );
  }

  if (sharingDisabled) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <svg className="w-12 h-12 text-yellow-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Sharing Disabled</h2>
          <p className="text-gray-600 text-sm">Public sharing has been disabled by the administrator of this organization.</p>
        </div>
      </div>
    );
  }

  if (!response || !form) return null;

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6">
      <div className="max-w-2xl mx-auto">
        {/* Tenant Logo */}
        {tenant?.branding?.logoUrl && (
          <div className="flex justify-center mb-6">
            <img
              src={tenant.branding.logoUrl}
              alt={`${tenant.name} Logo`}
              className="h-10 w-auto max-w-[180px] object-contain"
            />
          </div>
        )}

        {/* Header Card */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-8 border-t-4" style={{ borderTopColor: 'var(--brand)' }}>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{form.title}</h1>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm text-gray-500 mt-4 border-t pt-4">
            <div className="flex items-center">
              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>{form.location}</span>
            </div>
            <div className="flex items-center">
              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>Submitted: {getFormattedDate(response.submittedAt)}</span>
            </div>
          </div>
        </div>

        {/* Response Cards */}
        <div className="space-y-6">
          {form.questions.map((q, idx) => {
            const ans = response.responses[q.id];
            let ansStr = '';
            if (Array.isArray(ans)) {
              ansStr = ans.map(v => v.startsWith('__others__:') ? v.substring(11) : v).join(', ');
            } else {
              ansStr = ans !== undefined && ans !== null ? String(ans) : '—';
            }

            return (
              <div key={q.id} className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-start">
                  <span
                    className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-semibold text-white mt-0.5"
                    style={{ backgroundColor: 'var(--brand)' }}
                  >
                    {idx + 1}
                  </span>
                  <div className="ml-4 flex-grow">
                    <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">{q.question}</h3>
                    <p className="mt-2 text-base text-gray-900 font-semibold whitespace-pre-line">{ansStr}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer powered-by label */}
        {!tenant?.features?.hidePoweredBy && (
          <div className="text-center mt-12 text-xs text-gray-400">
            Powered by{' '}
            <a href="https://inan.com.ng" target="_blank" rel="noopener noreferrer" className="hover:text-gray-600">
              Inan Management Ltd
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
