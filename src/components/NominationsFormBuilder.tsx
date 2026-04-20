'use client';

import React, { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import Button from './Button';
import Input from './Input';
import Toast from './Toast';
import ImageUpload from './ImageUpload';
import { useToast } from '../hooks/useToast';
import { getAllEmployees } from '../lib/employeesFirestore';
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
  const [bannerImageUrl, setBannerImageUrl] = useState('');
  const [createdFormId, setCreatedFormId] = useState<string | null>(null);

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
        if (d.bannerImageUrl) setBannerImageUrl(d.bannerImageUrl);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({
        title, description, requireEmail,
        openAt: openAt.toISOString(), closeAt: closeAt.toISOString(),
        categories, currentStep, bannerImageUrl,
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

  // ── Import nominees from Firestore employees ──────────────────────────────
  const importFromEmployees = async (catId: string) => {
    try {
      const list = await getAllEmployees();
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
        ...(bannerImageUrl ? { bannerImageUrl } : {}),
      };
      await onSave(form);
      sessionStorage.removeItem(DRAFT_KEY);
      setCreatedFormId(form.id);
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

        <ImageUpload
          label="Banner Image (optional)"
          hint="Shown at the top of every screen on the voting page. Leave empty to show no banner."
          currentUrl={bannerImageUrl}
          storagePath={`nominations/banners/draft`}
          onUploaded={url => setBannerImageUrl(url)}
          onRemoved={() => setBannerImageUrl('')}
        />
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
        <Button fullWidth={false} onClick={handleSubmit} disabled={saving || categories.length === 0} isLoading={saving} loadingText="Creating…">
          Create Nominations Form
        </Button>
      </div>
    </div>
  );

  // ── Success / share screen ─────────────────────────────────────────────────
  if (createdFormId) {
    const votingUrl = typeof window !== 'undefined'
      ? `${window.location.origin}/nominations/${createdFormId}`
      : `/nominations/${createdFormId}`;

    const handleCopy = () => {
      navigator.clipboard.writeText(votingUrl);
      showToast('Link copied to clipboard!', 'success');
    };

    const handleShare = () => {
      if (navigator.share) {
        navigator.share({ title: 'Vote in our Staff Nominations', url: votingUrl })
          .catch(() => {}); // user cancelled — ignore
      } else {
        // Fallback: open WhatsApp share
        window.open(`https://wa.me/?text=${encodeURIComponent(`Vote in our Staff Nominations: ${votingUrl}`)}`, '_blank');
      }
    };

    const shareLinks = [
      {
        label: 'WhatsApp',
        href: `https://wa.me/?text=${encodeURIComponent(`Vote in our Staff Nominations: ${votingUrl}`)}`,
        icon: (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
        ),
        color: 'bg-green-500 hover:bg-green-600',
      },
      {
        label: 'Email',
        href: `mailto:?subject=${encodeURIComponent('Staff Nominations — Cast Your Vote')}&body=${encodeURIComponent(`You are invited to vote in our Staff Nominations.\n\nClick the link below to cast your vote:\n${votingUrl}`)}`,
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        ),
        color: 'bg-gray-600 hover:bg-gray-700',
      },
      {
        label: 'Twitter / X',
        href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(`Cast your vote in our Staff Nominations: ${votingUrl}`)}`,
        icon: (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
          </svg>
        ),
        color: 'bg-black hover:bg-gray-800',
      },
    ];

    return (
      <div className="max-w-4xl mx-auto">
        <Toast toasts={toasts} onDismiss={dismissToast} />
        <div className="bg-white rounded-xl shadow-lg p-8 text-center space-y-6">
          {/* Success icon */}
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mx-auto">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-gray-900">Nominations Form Created!</h2>
            <p className="text-gray-500 text-sm mt-1">Share the link below with your staff so they can cast their votes.</p>
          </div>

          {/* Link display + copy */}
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
            <span className="flex-1 text-sm text-gray-700 break-all text-left">{votingUrl}</span>
            <button
              onClick={handleCopy}
              title="Copy link"
              className="shrink-0 p-2 text-purple-600 hover:bg-purple-50 rounded-md transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
          </div>

          {/* Share buttons */}
          <div className="space-y-2">
            <p className="text-xs text-gray-400 uppercase font-medium tracking-wide">Share via</p>
            <div className="flex flex-wrap justify-center gap-3">
              {/* Native share (mobile) */}
              {typeof navigator !== 'undefined' && 'share' in navigator && (
                <button
                  onClick={handleShare}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                  Share
                </button>
              )}
              {shareLinks.map(link => (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center gap-2 px-4 py-2 text-white text-sm font-medium rounded-lg transition-colors ${link.color}`}
                >
                  {link.icon}
                  {link.label}
                </a>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-center gap-3 pt-2">
            <Button fullWidth={false} onClick={() => {
              setCreatedFormId(null);
              setTitle(''); setDescription(''); setCategories([]);
              setRequireEmail(true); setCurrentStep('basics');
              setBannerImageUrl('');
            }}>
              Create Another Form
            </Button>
          </div>
        </div>
      </div>
    );
  }

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
