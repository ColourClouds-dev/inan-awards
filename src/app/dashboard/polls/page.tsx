'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { getAllNominationsForms, getVotesForForm, deleteNominationsForm, toggleNominationsFormActive } from '../../../lib/nominationsFirestore';
import NominationsFormBuilder from '../../../components/NominationsFormBuilder';
import { saveNominationsForm } from '../../../lib/nominationsFirestore';
import Modal from '../../../components/Modal';
import Toast from '../../../components/Toast';
import { useToast } from '../../../hooks/useToast';
import type { NominationsForm, NominationsVote } from '../../../types';

function toDate(v: unknown): Date {
  if (v instanceof Date) return v;
  if (v && typeof (v as any).toDate === 'function') return (v as any).toDate();
  if (v && typeof (v as any).seconds === 'number') return new Date((v as any).seconds * 1000);
  return new Date();
}

const ChevronIcon = ({ open }: { open: boolean }) => (
  <svg className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

function ResultsPanel({ form, votes }: { form: NominationsForm; votes: NominationsVote[] }) {
  const [selectedCatId, setSelectedCatId] = useState(form.categories[0]?.id ?? '');

  const cat = form.categories.find(c => c.id === selectedCatId);
  const tally: Record<string, number> = {};
  votes.forEach(v => {
    const pick = v.categoryVotes[selectedCatId];
    if (pick) tally[pick] = (tally[pick] ?? 0) + 1;
  });
  const sorted = Object.entries(tally).sort(([, a], [, b]) => b - a);
  const maxVotes = sorted[0]?.[1] ?? 1;

  const exportCSV = () => {
    const rows = ['Category,Nominee,Votes'];
    form.categories.forEach(c => {
      const t: Record<string, number> = {};
      votes.forEach(v => { const p = v.categoryVotes[c.id]; if (p) t[p] = (t[p] ?? 0) + 1; });
      Object.entries(t).sort(([, a], [, b]) => b - a).forEach(([n, cnt]) => {
        rows.push(`"${c.title}","${n}",${cnt}`);
      });
    });
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${form.title.replace(/\s+/g, '-').toLowerCase()}-results.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-gray-500">{votes.length} total submission{votes.length !== 1 ? 's' : ''}</p>
        <button onClick={exportCSV}
          className="px-3 py-1.5 text-xs font-medium bg-purple-600 text-white rounded-md hover:bg-purple-700">
          Export CSV
        </button>
      </div>

      {form.categories.length > 0 && (
        <div>
          <label className="text-xs text-gray-500 uppercase font-medium block mb-1">Category</label>
          <select value={selectedCatId} onChange={e => setSelectedCatId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500">
            {form.categories.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </div>
      )}

      {sorted.length === 0 ? (
        <p className="text-sm text-gray-400 italic">No votes yet for this category.</p>
      ) : (
        <div className="space-y-2">
          {sorted.map(([name, count]) => (
            <div key={name}>
              <div className="flex justify-between text-sm mb-0.5">
                <span className="text-gray-700 truncate">{name}</span>
                <span className="text-gray-500 shrink-0 ml-2">{count} vote{count !== 1 ? 's' : ''}</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div className="bg-purple-500 h-2 rounded-full transition-all"
                  style={{ width: `${(count / maxVotes) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FormCard({ form, votes, onDelete, onToggle, onCopyLink }: {
  form: NominationsForm;
  votes: NominationsVote[];
  onDelete: () => void;
  onToggle: () => void;
  onCopyLink: () => void;
}) {
  const [resultsOpen, setResultsOpen] = useState(false);
  const createdAt = toDate(form.createdAt);
  const openAt = toDate(form.openAt);
  const closeAt = toDate(form.closeAt);
  const now = new Date();
  const isLive = now >= openAt && now <= closeAt && form.isActive;

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-5 py-4 flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-semibold text-gray-900 truncate">{form.title}</h3>
            <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${
              isLive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
            }`}>
              {isLive ? 'Live' : form.isActive ? 'Inactive' : 'Disabled'}
            </span>
            {form.requireEmail && (
              <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
                Email verified
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
            <span>🗓 Created {createdAt.toLocaleDateString()}</span>
            <span>🗳 {votes.length} vote{votes.length !== 1 ? 's' : ''}</span>
            <span>📂 {form.categories.length} categor{form.categories.length !== 1 ? 'ies' : 'y'}</span>
          </div>
          <div className="text-xs text-gray-400 mt-0.5">
            {openAt.toLocaleDateString()} {openAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} →{' '}
            {closeAt.toLocaleDateString()} {closeAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button onClick={onCopyLink} title="Copy voting link"
            className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-md transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
          <button onClick={onToggle} title={form.isActive ? 'Disable form' : 'Enable form'}
            className={`p-1.5 rounded-md transition-colors ${form.isActive ? 'text-yellow-600 hover:bg-yellow-50' : 'text-green-600 hover:bg-green-50'}`}>
            {form.isActive ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          </button>
          <button onClick={onDelete} title="Delete form"
            className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      <div className="border-t border-gray-100">
        <button onClick={() => setResultsOpen(o => !o)}
          className="w-full flex items-center justify-between px-5 py-2.5 bg-gray-50 hover:bg-gray-100 text-xs font-medium text-gray-600 uppercase tracking-wide">
          <span>Results ({votes.length})</span>
          <ChevronIcon open={resultsOpen} />
        </button>
        {resultsOpen && <ResultsPanel form={form} votes={votes} />}
      </div>
    </div>
  );
}

export default function PollsPage() {
  const { toasts, showToast, dismissToast } = useToast();
  const [forms, setForms] = useState<NominationsForm[]>([]);
  const [votesMap, setVotesMap] = useState<Record<string, NominationsVote[]>>({});
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<NominationsForm | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [formSearch, setFormSearch] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const allForms = await getAllNominationsForms();
      setForms(allForms);
      const map: Record<string, NominationsVote[]> = {};
      await Promise.all(allForms.map(async f => {
        map[f.id] = await getVotesForForm(f.id);
      }));
      setVotesMap(map);
    } catch {
      showToast('Failed to load nominations data.', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSaveForm = async (form: NominationsForm) => {
    await saveNominationsForm(form);
    await fetchData();
  };

  const handleToggle = async (form: NominationsForm) => {
    try {
      await toggleNominationsFormActive(form.id, !form.isActive);
      setForms(prev => prev.map(f => f.id === form.id ? { ...f, isActive: !f.isActive } : f));
      showToast(form.isActive ? 'Form disabled.' : 'Form enabled.', 'success');
    } catch {
      showToast('Failed to update form.', 'error');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteNominationsForm(deleteTarget.id);
      setForms(prev => prev.filter(f => f.id !== deleteTarget.id));
      showToast('Form deleted.', 'success');
    } catch {
      showToast('Failed to delete form.', 'error');
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const handleCopyLink = (formId: string) => {
    const url = `${window.location.origin}/nominations/${formId}`;
    navigator.clipboard.writeText(url);
    setCopiedId(formId);
    showToast('Voting link copied!', 'success');
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-10">
      <Toast toasts={toasts} onDismiss={dismissToast} />

      <section>
        <NominationsFormBuilder onSave={handleSaveForm} />
      </section>

      <section>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <h2 className="text-xl font-semibold">Nominations Forms ({forms.length})</h2>
          <input
            type="text"
            value={formSearch}
            onChange={e => setFormSearch(e.target.value)}
            placeholder="Search by title…"
            className="w-full sm:w-64 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
        {forms.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500 min-h-[120px] flex items-center justify-center">
            No nominations forms yet. Use the builder above to create one.
          </div>
        ) : (
          <div className="space-y-4 min-h-[120px]">
            {forms
              .filter(f => f.title.toLowerCase().includes(formSearch.toLowerCase()))
              .map(form => (
                <FormCard
                  key={form.id}
                  form={form}
                  votes={votesMap[form.id] ?? []}
                  onDelete={() => setDeleteTarget(form)}
                  onToggle={() => handleToggle(form)}
                  onCopyLink={() => handleCopyLink(form.id)}
                />
              ))}
            {forms.filter(f => f.title.toLowerCase().includes(formSearch.toLowerCase())).length === 0 && (
              <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">
                No forms match your search.
              </div>
            )}
          </div>
        )}
      </section>

      <Modal
        isOpen={!!deleteTarget}
        variant="danger"
        title="Delete this nominations form?"
        message={`"${deleteTarget?.title}" and all its data will be permanently removed. This cannot be undone.`}
        confirmLabel={deleting ? 'Deleting…' : 'Yes, delete'}
        cancelLabel="Cancel"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
