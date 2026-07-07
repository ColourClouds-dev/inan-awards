'use client';

import React, { useState, useRef, useEffect } from 'react';
import { generateResponsePDF } from '../lib/pdfBuilder';
import { downloadCSV } from '../lib/csvBuilder';
import type { FeedbackForm } from '../types';

interface ShareResponseButtonProps {
  responseId: string;
  form: FeedbackForm;
  responses: { [questionId: string]: string | number };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  submittedAt?: any;
}

export default function ShareResponseButton({
  responseId,
  form,
  responses,
  submittedAt,
}: ShareResponseButtonProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [whatsappOpen, setWhatsappOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const formatDate = (val: unknown): string => {
    if (!val) return new Date().toLocaleDateString();
    if (val instanceof Date) return val.toLocaleDateString();
    if (typeof val === 'object' && val !== null && 'seconds' in val) {
      return new Date((val as { seconds: number }).seconds * 1000).toLocaleDateString();
    }
    if (typeof val === 'string') return new Date(val).toLocaleDateString();
    return new Date().toLocaleDateString();
  };

  const formattedDate = formatDate(submittedAt);

  const getQas = () =>
    form.questions.map(q => {
      const raw = responses[q.id];
      let answer = '';
      if (Array.isArray(raw)) {
        answer = raw
          .map(v => (typeof v === 'string' && v.startsWith('__others__:') ? v.slice(11) : v))
          .join(', ');
      } else {
        answer = raw !== undefined && raw !== null ? String(raw) : '—';
      }
      return { question: q.question, answer };
    });

  const qas = getQas();

  const getShareLink = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}/responses/${responseId}`;
  };

  const getPlainText = () => {
    let txt = `${form.title}\nSubmitted: ${formattedDate}\nLocation: ${form.location}\n\n`;
    qas.forEach(qa => {
      txt += `• ${qa.question}\n  ${qa.answer}\n\n`;
    });
    return txt.trim();
  };

  // ── Actions ───────────────────────────────────────────────────────────────

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(getPlainText());
      setCopied(true);
      setDropdownOpen(false);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API unavailable — silent fail
    }
  };

  const handleDownloadPDF = () => {
    setDropdownOpen(false);
    const blob = generateResponsePDF(form.title, formattedDate, qas);
    const safeName = form.title.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
    const safeDate = formattedDate.replace(/\//g, '-');
    const filename = `${safeName}_Response_${safeDate}.pdf`;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadCSV = () => {
    setDropdownOpen(false);
    const safeName = form.title.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
    const safeDate = formattedDate.replace(/\//g, '-');
    const filename = `${safeName}_Response_${safeDate}.csv`;
    downloadCSV(filename, qas);
  };

  const handleWhatsAppLink = () => {
    const text = `Here's my response to the feedback form: "${form.title}"\n${getShareLink()}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
    setWhatsappOpen(false);
  };

  const handleWhatsAppText = () => {
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(getPlainText())}`, '_blank');
    setWhatsappOpen(false);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="relative inline-block text-left" ref={containerRef}>

        {/* Trigger button */}
        <button
          onClick={() => setDropdownOpen(prev => !prev)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-base font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 btn-brand shadow-md"
          aria-haspopup="true"
          aria-expanded={dropdownOpen}
        >
          {/* Share icon */}
          <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 10.742l4.636-2.318m0 0a3 3 0 102.684-4.858 3 3 0 00-2.684 4.858m-4.636 2.318a3 3 0 11-2.684 4.858 3 3 0 012.684-4.858m4.636-2.318l-4.636 2.318" />
          </svg>
          <span>{copied ? 'Copied!' : 'Share Response'}</span>
          {/* Chevron */}
          <svg
            className={`w-4 h-4 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Dropdown menu */}
        {dropdownOpen && (
          <div className="absolute left-1/2 -translate-x-1/2 mt-2 w-52 rounded-lg shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50 overflow-hidden">

            {/* Copy Text */}
            <button
              onClick={handleCopyText}
              className="flex items-center w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors gap-3"
            >
              <svg className="w-5 h-5 text-gray-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
              </svg>
              Copy as Text
            </button>

            <div className="h-px bg-gray-100" />

            {/* Download PDF */}
            <button
              onClick={handleDownloadPDF}
              className="flex items-center w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors gap-3"
            >
              <svg className="w-5 h-5 text-gray-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download PDF
            </button>

            <div className="h-px bg-gray-100" />

            {/* Download CSV */}
            <button
              onClick={handleDownloadCSV}
              className="flex items-center w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors gap-3"
            >
              <svg className="w-5 h-5 text-gray-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download CSV
            </button>

            <div className="h-px bg-gray-100" />

            {/* Share on WhatsApp */}
            <button
              onClick={() => { setDropdownOpen(false); setWhatsappOpen(true); }}
              className="flex items-center w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors gap-3"
            >
              <svg className="w-5 h-5 text-green-500 shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
              </svg>
              Share on WhatsApp
            </button>

          </div>
        )}
      </div>

      {/* WhatsApp sub-modal */}
      {whatsappOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={() => setWhatsappOpen(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl w-full max-w-sm overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="text-base font-semibold text-gray-900">Share on WhatsApp</h3>
              <button
                onClick={() => setWhatsappOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Options */}
            <div className="p-5 space-y-3">
              {/* Send Link */}
              <button
                onClick={handleWhatsAppLink}
                className="flex items-center justify-between w-full p-4 border border-gray-200 rounded-lg hover:border-green-400 hover:bg-green-50 transition-all text-left group"
              >
                <div>
                  <p className="text-sm font-semibold text-gray-900 group-hover:text-green-700">Send Link</p>
                  <p className="text-xs text-gray-500 mt-0.5">Share a direct link to this response.</p>
                </div>
                <svg className="w-5 h-5 text-gray-400 group-hover:text-green-500 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </button>

              {/* Send Full Text */}
              <button
                onClick={handleWhatsAppText}
                className="flex items-center justify-between w-full p-4 border border-gray-200 rounded-lg hover:border-green-400 hover:bg-green-50 transition-all text-left group"
              >
                <div>
                  <p className="text-sm font-semibold text-gray-900 group-hover:text-green-700">Send Full Text</p>
                  <p className="text-xs text-gray-500 mt-0.5">Share all questions and answers as a message.</p>
                </div>
                <svg className="w-5 h-5 text-gray-400 group-hover:text-green-500 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
