'use client';

import React, { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import Button from './Button';
import Input from './Input';
import Toast from './Toast';
import { useToast } from '../hooks/useToast';
import type { NominationsForm, NominationsCategory } from '../types';

interface NominationsFormBuilderProps {
  onSave: (form: NominationsForm) => Promise<void>;
}

const DRAFT_KEY = 'nominationsFormBuilderDraft';

// ── Helpers ────────────────────────────────────────────────────────────────────
function toLocalDatetimeValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const NominationsFormBuilder: React.FC<NominationsFormBuilderProps> = ({ onSave }) => {
  const { toasts, showToast, dismissToast } = useToast();

  // ── Form state ─────────────────────────────────────────────────────────────
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [requireEmail, setRequireEmail] = useState(true);
  const [openAt, setOpenAt] = useState<Date>(new Date());
  const [closeAt, setCloseAt] = useState<Date>(() => {
    const d = new Date(); d.setDate(d.getDate() + 7); return d;
  });
  const [categories, setCategories] = useState<NominationsCategory[]>([]);
  const [currentStep, setCurrentStep] = useState<'basics' | 'categories'>('basics');
  const [saving, setSaving] = useState(false);

  // ── Draft persistence ──────────────────────────────────────────────────────
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(DRAFT_KEY);
      if (saved) {
        const d = JSON.parse(saved);
        if (d.title) setTitle(d.title);
        if (d.description) setDescription(d.description);
        if (d.requireEmail !== undefined) setRequireEmail(d.requireEmail);
        if (d.openAt) setOpenAt(new Date(d.openAt));
        if (d.closeAt) setCloseAt(new Date(d.closeAt));
        if (d.categories) setCategories(d.categories);
        if (d.currentStep) setCurrentStep(d.currentStep);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({
        title, description, requireEmail,
        openAt: openAt.toISOString(), closeAt: closeAt.toISOString(),
        categories, currentStep,
      }));
    } catch { /* ignore */ }
  }, [title, description, requireEmail, openAt, closeAt, categories, currentStep]);

  // ── Category helpers ───────────────────────────────────────────────────────
  const addCategory = () => {
    setCategories(prev => [...prev, { id: uuidv4(), title: '', description: '', nominees: [''] }]);
  };

  const updateCategory = (id: string, updates: Partial<NominationsCategory>) => {
    setCategories(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const removeCategory = (id: string) => {
    setCategories(prev => prev.filter(c => c.id !== id));
  };

  const moveCategory = (id: string, dir: 'up' | 'down') => {
    const idx = categories.findIndex(c => c.id === id);
    if ((dir === 'up' && idx === 0) || (dir === 'down' && idx === categories.length - 1)) return;
    const next = [...categories];
    const swap = dir === 'up' ? idx - 1 : idx + 1;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    setCategories(next);
  };

  const addNominee = (catId: string) => {
    updateCategory(catId, {
      nominees: [...(categories.find(c => c.id === catId)?.nominees ?? []), ''],
    });
  };

  const updateNominee = (catId: string, idx: number, val: string) => {
    const cat = categories.find(c => c.id === catId);
    if (!cat) return;
    const nominees = cat.nominees.map((n, i) => i === idx ? val : n);
    updateCategory(catId, { nominees });
  };

  const removeNominee = (catId: string, idx: number) => {
    const cat = categories.find(c => c.id === catId);
    if (!cat) return;
    updateCategory(catId, { nominees: cat.nominees.filter((_, i) => i !== idx) });
  };

  // ── Import nominees from employees.json ────────────────────────────────────
  const importFromEmployees = async (catId: string) => {
    try {
      const res = await fetch('/employees.json');
      const list: { Employee: string; Status: string }[] = await res.json();
      const names = list.filter(e => e.Status === 'Active').map(e => e.Employee).sort();
      updateCategory(catId, { nominees: names });
      showToast(`Imported ${names.length} employees.`, 'success');
    } catch {
      showToast('Failed to import employees.', 'error');
    }
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!title.trim()) { showToast('Form title is required.', 'error'); return; }
    if (categories.length === 0) { showToast('Add at least one category.', 'error'); return; }
    if (openAt >= closeAt) { showToast('Close date must be after open date.', 'error'); return; }

    const invalid = categories.find(c => !c.title.trim() || c.nominees.filter(n => n.trim()).length === 0);
    if (invalid) { showToast('Each category needs a title and at least one nominee.', 'error'); return; }

    setSaving(true);
    try {
      const form: NominationsForm = {
        id: uuidv4(),
        title: title.trim(),
        description: description.trim() || undefined,
        categories: categories.map(c => ({
          ...c,
          nominees: c.nominees.filter(n => n.trim()),
        })),
        requireEmail,
        openAt,
        closeAt,
        isActive: true,
        createdAt: new Date(),
      };
      await onSave(form);
      sessionStorage.removeItem(DRAFT_KEY);
      showToast('Nominations form created!', 'success');
      // Reset
      setTitle(''); setDescription(''); setCategories([]);
      setRequireEmail(true); setCurrentStep('basics');
    } catch {
      showToast('Failed to save form. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ── Render basics step ─────────────────────────────────────────────────────
  const renderBasics = () => (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow space-y-4">
        <h2 className="text-xl font-semibold">Form Details</h2>
        <Input label="Form Title" value={title} onChange={e => setTitle(e.target.value)}
          placeholder="e.g. INAN Staff Awards 2025" required />
        <Input label="Description (optional)" value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Brief description shown to voters" />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-lg font-medium text-gray-700 mb-1">Voting Opens</label>
            <input type="datetime-local" value={toLocalDatetimeValue(openAt)}
              onChange={e => setOpenAt(new Date(e.target.value))}
              className="w-full px-4 py-3 text-lg rounded-lg border-2 border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all" />
          </div>
          <div>
            <label className="block text-lg font-medium text-gray-700 mb-1">Voting Closes</label>
            <input type="datetime-local" value={toLocalDatetimeValue(closeAt)}
              onChange={e => setCloseAt(new Date(e.target.value))}
              className="w-full px-4 py-3 text-lg rounded-lg border-2 border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all" />
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <input type="checkbox" id="requireEmail" checked={requireEmail}
            onChange={e => setRequireEmail(e.target.checked)}
            className="h-4 w-4 text-purple-600 rounded" />
          <label htmlFor="requireEmail" className="text-sm text-gray-700">
            Require staff email verification before voting
            <span className="block text-xs text-gray-400">Staff must enter their @inan.com.ng email. Prevents duplicate votes.</span>
          </label>
        </div>
      </div>

      <div className="flex justify-between items-center">
        {(title || categories.length > 0) ? (
          <button onClick={() => {
            sessionStorage.removeItem(DRAFT_KEY);
            setTitle(''); setDescription(''); setCategories([]);
            setRequireEmail(true); setCurrentStep('basics');
          }} className="text-sm text-gray-400 hover:text-red-500 transition-colors">
            Clear draft
          </button>
        ) : <span />}
        <Button fullWidth={false} onClick={() => setCurrentStep('categories')} disabled={!title.trim()}>
          Next: Add Categories →
        </Button>
      </div>
    </div>
  );

  // ── Render categories step ─────────────────────────────────────────────────
  const renderCategories = () => (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold">Award Categories</h2>
            <p className="text-sm text-gray-500 mt-1">Add categories and the nominees staff can vote for in each.</p>
          </div>
          <Button fullWidth={false} onClick={addCategory}>+ Add Category</Button>
        </div>

        {categories.length === 0 && (
          <p className="text-sm text-gray-400 italic">No categories yet. Click "Add Category" to start.</p>
        )}

        <div className="space-y-4 min-h-[200px]">
          {categories.map((cat, idx) => (
            <div key={cat.id} className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
              {/* Category header */}
              <div className="flex items-stretch gap-2">
                <div className="flex-1">
                  <Input value={cat.title} onChange={e => updateCategory(cat.id, { title: e.target.value })}
                    placeholder="e.g. Employee of the Year" required />
                </div>
                <div className="flex items-stretch gap-1 shrink-0">
                  <button onClick={() => moveCategory(cat.id, 'up')} disabled={idx === 0}
                    className="px-3 py-3 hover:bg-gray-200 rounded-lg disabled:opacity-30 text-gray-600 font-medium">↑</button>
                  <button onClick={() => moveCategory(cat.id, 'down')} disabled={idx === categories.length - 1}
                    className="px-3 py-3 hover:bg-gray-200 rounded-lg disabled:opacity-30 text-gray-600 font-medium">↓</button>
                  <Button fullWidth={false} onClick={() => removeCategory(cat.id)}>Remove</Button>
                </div>
              </div>

              <Input value={cat.description ?? ''} onChange={e => updateCategory(cat.id, { description: e.target.value })}
                placeholder="Category description (optional)" />

              {/* Nominees */}
              <div className="space-y-2 ml-2">
                <p className="text-xs font-medium text-gray-500 uppercase">Nominees</p>
                {cat.nominees.map((nominee, nIdx) => (
                  <div key={nIdx} className="flex items-center gap-2">
                    <div className="flex-1">
                      <Input value={nominee} onChange={e => updateNominee(cat.id, nIdx, e.target.value)}
                        placeholder={`Nominee ${nIdx + 1}`} />
                    </div>
                    <div className="shrink-0">
                      <Button fullWidth={false} onClick={() => removeNominee(cat.id, nIdx)}
                        disabled={cat.nominees.length <= 1}>Remove</Button>
                    </div>
                  </div>
                ))}
                <div className="flex gap-2 mt-1">
                  <Button fullWidth={false} onClick={() => addNominee(cat.id)}>+ Add Nominee</Button>
                  <button onClick={() => importFromEmployees(cat.id)}
                    className="px-4 py-2 text-sm font-medium text-purple-600 border border-purple-300 rounded-lg hover:bg-purple-50 transition-colors">
                    Import from Employees
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-between gap-4">
        <Button fullWidth={false} onClick={() => setCurrentStep('basics')}>← Back to Details</Button>
        <Button fullWidth={false} onClick={handleSubmit} disabled={saving || categories.length === 0} isLoading={saving}>
          Create Nominations Form
        </Button>
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto">
      <Toast toasts={toasts} onDismiss={dismissToast} />
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Create Nominations Form</h1>
        <div className="flex items-center gap-2">
          <div className={`h-3 w-3 rounded-full ${currentStep === 'basics' ? 'bg-purple-600' : 'bg-gray-300'}`} />
          <div className={`h-3 w-3 rounded-full ${currentStep === 'categories' ? 'bg-purple-600' : 'bg-gray-300'}`} />
        </div>
      </div>
      <div className="min-h-[500px]">
        {currentStep === 'basics' && renderBasics()}
        {currentStep === 'categories' && renderCategories()}
      </div>
    </div>
  );
};

export default NominationsFormBuilder;
