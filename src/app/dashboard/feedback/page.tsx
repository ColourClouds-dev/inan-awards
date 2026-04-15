'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { getAllForms, getAllResponses, saveForm, deactivateForm, reactivateForm, deleteForm } from '../../../lib/firestore';
import { exportToExcel } from '../../../lib/exportToExcel';
import FeedbackFormBuilder from '../../../components/FeedbackFormBuilder';
import FormAnalyticsPanel from '../../../components/FormAnalyticsPanel';
import Modal from '../../../components/Modal';
import Toast from '../../../components/Toast';
import { useToast } from '../../../hooks/useToast';
import type { FeedbackForm, FeedbackResponse, ResponseTag } from '../../../types';

// ─── Safe date conversion ─────────────────────────────────────────────────────
function toDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (value && typeof (value as any).toDate === 'function') return (value as any).toDate();
  if (value && typeof (value as any).seconds === 'number') return new Date((value as any).seconds * 1000);
  return new Date();
}

// ─── Tag badge ────────────────────────────────────────────────────────────────
const tagColorClasses: Record<string, string> = {
  green: 'bg-green-100 text-green-800',
  yellow: 'bg-yellow-100 text-yellow-800',
  red: 'bg-red-100 text-red-800',
  blue: 'bg-blue-100 text-blue-800',
  gray: 'bg-gray-100 text-gray-600',
};

function TagBadge({ tag }: { tag: ResponseTag }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${tagColorClasses[tag.color] ?? 'bg-gray-100 text-gray-600'}`}>
      {tag.label}
    </span>
  );
}

// ─── Icon buttons ─────────────────────────────────────────────────────────────
function IconBtn({ onClick, title, className, children }: {
  onClick: () => void; title: string; className?: string; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded-md transition-colors ${className}`}
    >
      {children}
    </button>
  );
}

// ─── View icon ────────────────────────────────────────────────────────────────
const EyeIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
);

// ─── Toggle active icon ───────────────────────────────────────────────────────
const ToggleOnIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);
const ToggleOffIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

// ─── Trash icon ───────────────────────────────────────────────────────────────
const TrashIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

// ─── Chevron ──────────────────────────────────────────────────────────────────
const ChevronIcon = ({ open }: { open: boolean }) => (
  <svg className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

// ─── Expandable response row ──────────────────────────────────────────────────
function ResponseRow({ response, form }: { response: FeedbackResponse; form: FeedbackForm }) {
  const [open, setOpen] = useState(false);

  const submittedAt = response.submittedAt instanceof Date
    ? response.submittedAt.toLocaleString()
    : typeof response.submittedAt === 'object' && 'toDate' in response.submittedAt
    ? (response.submittedAt as any).toDate().toLocaleString()
    : String(response.submittedAt);

  return (
    <>
      <tr
        className="hover:bg-gray-50 cursor-pointer"
        onClick={() => setOpen(o => !o)}
      >
        <td className="px-4 py-3 text-sm text-gray-500">{submittedAt}</td>
        <td className="px-4 py-3 text-sm text-gray-500">{response.visitorCountry ?? '—'}</td>
        <td className="px-4 py-3 text-sm text-gray-500">{response.visitorCity ?? '—'}</td>
        <td className="px-4 py-3">
          <div className="flex flex-wrap gap-1">
            {response.tags?.map((tag, i) => <TagBadge key={i} tag={tag} />) ?? <span className="text-xs text-gray-400">—</span>}
          </div>
        </td>
        <td className="px-4 py-3 text-sm text-gray-400">
          {response.timeSpentSeconds != null
            ? `${Math.floor(response.timeSpentSeconds / 60)}m ${response.timeSpentSeconds % 60}s`
            : '—'}
        </td>
        <td className="px-4 py-3 text-purple-600"><ChevronIcon open={open} /></td>
      </tr>
      {open && (
        <tr className="bg-purple-50">
          <td colSpan={6} className="px-6 py-4">
            <div className="space-y-2">
              {form.questions.map(q => {
                const val = response.responses[q.id];
                return val !== undefined ? (
                  <div key={q.id} className="text-sm">
                    <span className="font-medium text-gray-700">{q.question}: </span>
                    <span className="text-gray-600">{String(val)}</span>
                  </div>
                ) : null;
              })}
              {response.visitorIp && (
                <p className="text-xs text-gray-400 pt-1">IP: {response.visitorIp} · ISP: {response.visitorIsp ?? '—'}</p>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Per-form card ────────────────────────────────────────────────────────────
function FormCard({
  form,
  responses,
  onView,
  onToggleActive,
  onDelete,
}: {
  form: FeedbackForm;
  responses: FeedbackResponse[];
  onView: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
}) {
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [responsesOpen, setResponsesOpen] = useState(false);
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);

  const formResponses = responses.filter(r => r.formId === form.id);

  // Collect all unique tag labels across this form's responses
  const allTagLabels = useMemo(() => {
    const labels = new Set<string>();
    formResponses.forEach(r => r.tags?.forEach(t => labels.add(t.label)));
    return Array.from(labels).sort();
  }, [formResponses]);

  // Apply tag filter
  const filteredResponses = useMemo(() => {
    if (!activeTagFilter) return formResponses;
    return formResponses.filter(r => r.tags?.some(t => t.label === activeTagFilter));
  }, [formResponses, activeTagFilter]);

  const createdAt = toDate(form.createdAt);

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      {/* Card header */}
      <div className="px-5 py-4 flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-semibold text-gray-900 truncate">{form.title}</h3>
            <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${
              form.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
            }`}>
              {form.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
          <div className="flex items-center gap-4 mt-1 text-xs text-gray-500 flex-wrap">
            <span>📍 {form.location}</span>
            <span>🗓 {createdAt.toLocaleDateString()}</span>
            <span>💬 {formResponses.length} response{formResponses.length !== 1 ? 's' : ''}</span>
          </div>
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-1 shrink-0">
          <IconBtn onClick={onView} title="View form details" className="text-purple-600 hover:bg-purple-50">
            <EyeIcon />
          </IconBtn>
          <IconBtn
            onClick={onToggleActive}
            title={form.isActive ? 'Deactivate form' : 'Reactivate form'}
            className={form.isActive ? 'text-yellow-600 hover:bg-yellow-50' : 'text-green-600 hover:bg-green-50'}
          >
            {form.isActive ? <ToggleOffIcon /> : <ToggleOnIcon />}
          </IconBtn>
          <IconBtn onClick={onDelete} title="Delete form" className="text-red-500 hover:bg-red-50">
            <TrashIcon />
          </IconBtn>
        </div>
      </div>

      {/* Analytics panel */}
      <div className="border-t border-gray-100">
        <button
          onClick={() => setAnalyticsOpen(o => !o)}
          className="w-full flex items-center justify-between px-5 py-2.5 bg-gray-50 hover:bg-gray-100 text-xs font-medium text-gray-600 uppercase tracking-wide"
        >
          <span>Analytics</span>
          <ChevronIcon open={analyticsOpen} />
        </button>
        {analyticsOpen && (
          <div className="px-5 py-4">
            <FormAnalyticsPanel form={form} responses={responses} />
          </div>
        )}
      </div>

      {/* Responses table */}
      <div className="border-t border-gray-100">
        <button
          onClick={() => setResponsesOpen(o => !o)}
          className="w-full flex items-center justify-between px-5 py-2.5 bg-gray-50 hover:bg-gray-100 text-xs font-medium text-gray-600 uppercase tracking-wide"
        >
          <span>Responses ({formResponses.length})</span>
          <ChevronIcon open={responsesOpen} />
        </button>
        {responsesOpen && (
          formResponses.length === 0 ? (
            <p className="px-5 py-4 text-sm text-gray-400 italic">No responses yet.</p>
          ) : (
            <div>
              {/* Tag filter pills */}
              {allTagLabels.length > 0 && (
                <div className="px-5 py-3 flex flex-wrap gap-2 border-b border-gray-100 bg-gray-50">
                  <span className="text-xs text-gray-500 self-center mr-1">Filter by tag:</span>
                  <button
                    onClick={() => setActiveTagFilter(null)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                      activeTagFilter === null
                        ? 'bg-purple-600 text-white'
                        : 'bg-white border border-gray-300 text-gray-600 hover:border-purple-400'
                    }`}
                  >
                    All ({formResponses.length})
                  </button>
                  {allTagLabels.map(label => {
                    const count = formResponses.filter(r => r.tags?.some(t => t.label === label)).length;
                    const tag = formResponses.flatMap(r => r.tags ?? []).find(t => t.label === label);
                    const colorClass = tag ? tagColorClasses[tag.color] : 'bg-gray-100 text-gray-600';
                    return (
                      <button
                        key={label}
                        onClick={() => setActiveTagFilter(activeTagFilter === label ? null : label)}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors border ${
                          activeTagFilter === label
                            ? `${colorClass} border-transparent ring-2 ring-offset-1 ring-purple-400`
                            : `${colorClass} border-transparent opacity-80 hover:opacity-100`
                        }`}
                      >
                        {label} ({count})
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="overflow-x-auto min-h-[120px]">
                <table className="min-w-full divide-y divide-gray-100 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Submitted</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Country</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">City</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Tags</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Time Spent</th>
                      <th className="px-4 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {filteredResponses.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-6 text-center text-sm text-gray-400 italic">
                          No responses match this tag filter.
                        </td>
                      </tr>
                    ) : (
                      filteredResponses.map(r => (
                        <ResponseRow key={r.id} response={r} form={form} />
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}

// ─── View form modal content ──────────────────────────────────────────────────
function FormDetailContent({ form, responseCount, onCopyLink, onDownloadQR, copied }: {
  form: FeedbackForm;
  responseCount: number;
  onCopyLink: () => void;
  onDownloadQR: () => void;
  copied: boolean;
}) {
  const createdAt = toDate(form.createdAt);

  return (
    <div className="space-y-4 text-left">
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-gray-400 uppercase font-medium">Location</p>
          <p className="text-gray-800">{form.location}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 uppercase font-medium">Status</p>
          <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${
            form.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
          }`}>
            {form.isActive ? 'Active' : 'Inactive'}
          </span>
        </div>
        <div>
          <p className="text-xs text-gray-400 uppercase font-medium">Created</p>
          <p className="text-gray-800">{createdAt.toLocaleDateString()}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 uppercase font-medium">Responses</p>
          <p className="text-gray-800">{responseCount}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 uppercase font-medium">Questions</p>
          <p className="text-gray-800">{form.questions.length}</p>
        </div>
        {form.description && (
          <div className="col-span-2">
            <p className="text-xs text-gray-400 uppercase font-medium">Description</p>
            <p className="text-gray-800">{form.description}</p>
          </div>
        )}
      </div>

      <div className="border-t pt-3 flex flex-col sm:flex-row gap-2">
        <button
          onClick={onCopyLink}
          className="flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium bg-purple-600 text-white rounded-md hover:bg-purple-700 flex-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          {copied ? 'Copied!' : 'Copy Link'}
        </button>
        <button
          onClick={onDownloadQR}
          className="flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 flex-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download QR
        </button>
      </div>

      {/* Hidden QR for download */}
      <div id={`qr-modal-${form.id}`} className="hidden">
        <QRCodeSVG value={`${typeof window !== 'undefined' ? window.location.origin : ''}/feedback/${form.id}`} size={400} />
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
type SortTab = 'title' | 'location' | 'date';

export default function FeedbackDashboardPage() {
  const { toasts, showToast, dismissToast } = useToast();
  const [forms, setForms] = useState<FeedbackForm[]>([]);
  const [responses, setResponses] = useState<FeedbackResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter / sort
  const [sortTab, setSortTab] = useState<SortTab>('date');
  const [search, setSearch] = useState('');

  // Modals
  const [viewForm, setViewForm] = useState<FeedbackForm | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FeedbackForm | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
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

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSaveForm = async (form: FeedbackForm) => {
    await saveForm(form);
    setForms(await getAllForms());
  };

  const handleToggleActive = async (form: FeedbackForm) => {
    setToggling(form.id);
    try {
      if (form.isActive) {
        await deactivateForm(form.id);
        setForms(prev => prev.map(f => f.id === form.id ? { ...f, isActive: false } : f));
        showToast('Form deactivated.', 'success');
      } else {
        await reactivateForm(form.id);
        setForms(prev => prev.map(f => f.id === form.id ? { ...f, isActive: true } : f));
        showToast('Form reactivated.', 'success');
      }
    } catch {
      showToast('Failed to update form status.', 'error');
    } finally {
      setToggling(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(deleteTarget.id);
    try {
      await deleteForm(deleteTarget.id);
      setForms(prev => prev.filter(f => f.id !== deleteTarget.id));
      showToast('Form deleted.', 'success');
    } catch {
      showToast('Failed to delete form.', 'error');
    } finally {
      setDeleting(null);
      setDeleteTarget(null);
    }
  };

  const handleCopyLink = (formId: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/feedback/${formId}`);
    setCopiedId(formId);
    showToast('Link copied to clipboard!', 'success');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDownloadQR = (formId: string, formTitle: string) => {
    const container = document.getElementById(`qr-modal-${formId}`);
    const svg = container?.querySelector('svg') as SVGElement | null;
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    canvas.width = 400; canvas.height = 400;
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      ctx?.drawImage(img, 0, 0, 400, 400);
      const a = document.createElement('a');
      a.download = `${formTitle.replace(/\s+/g, '-').toLowerCase()}-qr.png`;
      a.href = canvas.toDataURL('image/png');
      a.click();
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(encodeURIComponent(svgData).replace(/%([0-9A-F]{2})/g, (_, p1) => String.fromCharCode(parseInt(p1, 16))));
  };

  const sortedForms = useMemo(() => {
    let filtered = forms.filter(f =>
      f.title.toLowerCase().includes(search.toLowerCase()) ||
      f.location.toLowerCase().includes(search.toLowerCase())
    );
    if (sortTab === 'title') filtered = [...filtered].sort((a, b) => a.title.localeCompare(b.title));
    if (sortTab === 'location') filtered = [...filtered].sort((a, b) => a.location.localeCompare(b.location));
    if (sortTab === 'date') filtered = [...filtered].sort((a, b) => {
      const aT = a.createdAt instanceof Date ? a.createdAt.getTime() : (a.createdAt as any).seconds * 1000;
      const bT = b.createdAt instanceof Date ? b.createdAt.getTime() : (b.createdAt as any).seconds * 1000;
      return bT - aT;
    });
    return filtered;
  }, [forms, sortTab, search]);

  if (loading) {
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

  const tabs: { key: SortTab; label: string }[] = [
    { key: 'date', label: 'Date Created' },
    { key: 'title', label: 'Title' },
    { key: 'location', label: 'Location' },
  ];

  return (
    <div className="p-6 space-y-10">
      <Toast toasts={toasts} onDismiss={dismissToast} />

      {/* Form builder */}
      <section>
        <FeedbackFormBuilder onSave={handleSaveForm} />
      </section>

      {/* Feedback Forms */}
      <section>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <h2 className="text-xl font-semibold">Feedback Forms ({forms.length})</h2>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by title or location…"
            className="w-full sm:w-64 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        {/* Sort tabs */}
        <div className="flex gap-1 mb-4 border-b border-gray-200">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setSortTab(tab.key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
                sortTab === tab.key
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {sortedForms.length === 0 ? (
          <div className="min-h-[200px] bg-white rounded-lg shadow p-6 flex items-center justify-center text-gray-500">
            {forms.length === 0 ? 'No forms created yet. Use the builder above to create your first form.' : 'No forms match your search.'}
          </div>
        ) : (
          <div className="space-y-4 min-h-[200px]">
            {sortedForms.map(form => (
              <FormCard
                key={form.id}
                form={form}
                responses={responses}
                onView={() => setViewForm(form)}
                onToggleActive={() => handleToggleActive(form)}
                onDelete={() => setDeleteTarget(form)}
              />
            ))}
          </div>
        )}
      </section>

      {/* View form modal */}
      <Modal
        isOpen={!!viewForm}
        title={viewForm?.title ?? ''}
        onCancel={() => setViewForm(null)}
        cancelLabel="Close"
      >
        {viewForm && (
          <FormDetailContent
            form={viewForm}
            responseCount={responses.filter(r => r.formId === viewForm.id).length}
            onCopyLink={() => handleCopyLink(viewForm.id)}
            onDownloadQR={() => handleDownloadQR(viewForm.id, viewForm.title)}
            copied={copiedId === viewForm.id}
          />
        )}
      </Modal>

      {/* Delete confirm modal */}
      <Modal
        isOpen={!!deleteTarget}
        variant="danger"
        title="Delete this form?"
        message={`"${deleteTarget?.title}" will be permanently removed. This cannot be undone.`}
        confirmLabel={deleting ? 'Deleting…' : 'Yes, delete'}
        cancelLabel="Cancel"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
