'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { motion, AnimatePresence } from 'framer-motion';
import Input from './Input';
import Button from './Button';
import ImageUpload from './ImageUpload';
import Toast from './Toast';
import { useToast } from '../hooks/useToast';
import { useTenant } from '../contexts/TenantContext';
import { sanitizeAndLimit } from '../lib/sanitize';
import type { FeedbackForm, FeedbackQuestion, CustomTagRule, LocationSettings } from '../types';

// ── Types ─────────────────────────────────────────────────────────────────────

interface FeedbackFormEditorProps {
  form: FeedbackForm;
  onSave: (updated: FeedbackForm) => Promise<void>;
  onClose: () => void;
}

type Step = 'basics' | 'questions' | 'tags';
const STEP_ORDER: Step[] = ['basics', 'questions', 'tags'];

// ── Question type metadata ────────────────────────────────────────────────────

const QuestionTypeInfo = {
  rating: {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
      </svg>
    ),
    label: 'Rating',
    description: '1–5 star scale',
    placeholder: 'e.g., How would you rate your overall experience?',
  },
  text: {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
    label: 'Text Response',
    description: 'Open-ended answer',
    placeholder: 'e.g., What could we improve?',
  },
  multiChoice: {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
    label: 'Multiple Choice',
    description: 'Predefined options',
    placeholder: 'e.g., Which amenities did you use?',
  },
} as const;

// ── Animation variants ────────────────────────────────────────────────────────

const stepVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? '100%' : '-100%', opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? '-100%' : '100%', opacity: 0 }),
};

const trayVariants = {
  hidden: { opacity: 0, scale: 0.85, y: 8 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring' as const, stiffness: 400, damping: 28 } },
  exit: { opacity: 0, scale: 0.85, y: 8, transition: { duration: 0.15 } },
};

// ── Floating add-question tray ────────────────────────────────────────────────

function FloatingAddTray({ onAdd }: { onAdd: (type: FeedbackQuestion['type']) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleAdd = (type: FeedbackQuestion['type']) => { onAdd(type); setOpen(false); };

  return (
    <div ref={ref} className="flex justify-end mt-4 relative">
      <AnimatePresence>
        {open && (
          <motion.div
            key="tray"
            variants={trayVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="absolute bottom-14 right-0 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden w-52 z-10"
          >
            {(Object.entries(QuestionTypeInfo) as [FeedbackQuestion['type'], typeof QuestionTypeInfo[keyof typeof QuestionTypeInfo]][]).map(([type, info]) => (
              <button
                key={type}
                onClick={() => handleAdd(type)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0"
              >
                <span className="shrink-0" style={{ color: 'var(--brand)' }}>{info.icon}</span>
                <div>
                  <p className="text-sm font-medium text-gray-800">{info.label}</p>
                  <p className="text-xs text-gray-400">{info.description}</p>
                </div>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
      <motion.button
        onClick={() => setOpen(o => !o)}
        whileTap={{ scale: 0.92 }}
        className="w-12 h-12 rounded-full text-white shadow-lg flex items-center justify-center"
        style={{ backgroundColor: 'var(--brand)' }}
        aria-label="Add question"
      >
        <motion.svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" animate={{ rotate: open ? 45 : 0 }} transition={{ duration: 0.2 }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </motion.svg>
      </motion.button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const FeedbackFormEditor: React.FC<FeedbackFormEditorProps> = ({ form, onSave, onClose }) => {
  const { tenantId } = useTenant();
  const { toasts, showToast, dismissToast } = useToast();

  const [title, setTitle] = useState(form.title);
  const [description, setDescription] = useState(form.description ?? '');
  const [location, setLocation] = useState(form.location);
  const [questions, setQuestions] = useState<FeedbackQuestion[]>(form.questions);
  const [ogImageUrl, setOgImageUrl] = useState(form.ogImageUrl ?? '');
  const [stepByStep, setStepByStep] = useState(form.stepByStep ?? false);
  const [customTagRules, setCustomTagRules] = useState<CustomTagRule[]>(form.customTagRules ?? []);
  const [locations, setLocations] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [currentStep, setCurrentStep] = useState<Step>('basics');
  const [direction, setDirection] = useState(1);

  // Load tenant locations
  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const snap = await getDoc(doc(db, 'tenant-settings', tenantId, 'config', 'locations'));
        if (snap.exists()) {
          setLocations((snap.data() as LocationSettings).locations || []);
        }
      } catch { /* ignore */ }
    };
    fetchLocations();
  }, [tenantId]);

  const goToStep = useCallback((next: Step) => {
    const cur = STEP_ORDER.indexOf(currentStep);
    const nxt = STEP_ORDER.indexOf(next);
    setDirection(nxt >= cur ? 1 : -1);
    setCurrentStep(next);
  }, [currentStep]);

  // ── Question helpers ─────────────────────────────────────────────────────

  const addQuestion = (type: FeedbackQuestion['type']) =>
    setQuestions(prev => [...prev, { id: uuidv4(), type, question: '', required: true, ...(type === 'multiChoice' ? { options: [''] } : {}) }]);

  const updateQuestion = (id: string, updates: Partial<FeedbackQuestion>) =>
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, ...updates } : q));

  const removeQuestion = (id: string) =>
    setQuestions(prev => prev.filter(q => q.id !== id));

  const moveQuestion = (id: string, dir: 'up' | 'down') => {
    const idx = questions.findIndex(q => q.id === id);
    if ((dir === 'up' && idx === 0) || (dir === 'down' && idx === questions.length - 1)) return;
    const next = [...questions];
    const swap = dir === 'up' ? idx - 1 : idx + 1;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    setQuestions(next);
  };

  const addOption = (qId: string) =>
    setQuestions(prev => prev.map(q => q.id === qId ? { ...q, options: [...(q.options || []), ''] } : q));

  const updateOption = (qId: string, i: number, val: string) =>
    setQuestions(prev => prev.map(q => q.id === qId ? { ...q, options: q.options?.map((o, j) => j === i ? val : o) } : q));

  const removeOption = (qId: string, i: number) =>
    setQuestions(prev => prev.map(q => q.id === qId ? { ...q, options: q.options?.filter((_, j) => j !== i) } : q));

  // ── Save ─────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!title || !location || questions.length === 0) return;
    setSaving(true);
    try {
      const updated: FeedbackForm = {
        ...form,
        title: sanitizeAndLimit(title, 100),
        description: sanitizeAndLimit(description, 500),
        location,
        questions: questions.map(q => ({
          ...q,
          question: sanitizeAndLimit(q.question, 200),
          options: q.options?.map(o => sanitizeAndLimit(o, 100)),
        })),
        stepByStep,
        customTagRules: customTagRules.length > 0 ? customTagRules : undefined,
        ogImageUrl: ogImageUrl || undefined,
      };
      await onSave(updated);
    } catch {
      showToast('Failed to save changes. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ── Step renderers ───────────────────────────────────────────────────────

  const renderBasicsStep = () => (
    <div className="space-y-4">
      <div className="space-y-4">
        <Input label="Form Title" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g., Guest Satisfaction Survey" required maxLength={100} />
        <Input label="Description" value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe what this form will do…" maxLength={500} />
        <Input label="Location" as="select" value={location} onChange={e => setLocation(e.target.value)} required>
          <option value="">Select Location</option>
          {/* Always show the current location even if not in the fetched list */}
          {[...new Set([form.location, ...locations])].filter(Boolean).map(loc => (
            <option key={loc} value={loc}>{loc}</option>
          ))}
        </Input>
        <ImageUpload
          label="Banner Image (optional)"
          hint="Shown at the top of the form and when shared on social media."
          currentUrl={ogImageUrl}
          folder="inan/forms/og-images"
          onUploaded={url => setOgImageUrl(url)}
          onRemoved={() => setOgImageUrl('')}
        />
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Question display</label>
          <div className="flex rounded-lg border border-gray-200 overflow-hidden w-fit">
            <button type="button" onClick={() => setStepByStep(false)} className={`px-4 py-2 text-sm font-medium transition-colors border-r border-gray-200 ${!stepByStep ? 'text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`} style={!stepByStep ? { backgroundColor: 'var(--brand)' } : undefined}>All at once</button>
            <button type="button" onClick={() => setStepByStep(true)} className={`px-4 py-2 text-sm font-medium transition-colors ${stepByStep ? 'text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`} style={stepByStep ? { backgroundColor: 'var(--brand)' } : undefined}>One at a time</button>
          </div>
          <p className="mt-1.5 text-xs text-gray-400">{stepByStep ? 'Respondents answer one question per screen.' : 'All questions on a single scrollable page.'}</p>
        </div>
      </div>
      <div className="flex justify-end pt-2">
        <Button fullWidth={false} onClick={() => goToStep('questions')} disabled={!title || !location}>Next: Questions →</Button>
      </div>
    </div>
  );

  const renderQuestionsStep = () => (
    <div className="space-y-4">
      <h3 className="text-base font-semibold text-gray-800">Questions</h3>

      {questions.length === 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {(Object.entries(QuestionTypeInfo) as [FeedbackQuestion['type'], typeof QuestionTypeInfo[keyof typeof QuestionTypeInfo]][]).map(([type, info]) => (
            <button key={type} onClick={() => addQuestion(type)} className="p-4 bg-white border-2 border-gray-200 rounded-xl hover:border-purple-400 hover:bg-purple-50 transition-colors text-left group">
              <span className="text-gray-400 group-hover:text-purple-600 transition-colors mb-2 block">{info.icon}</span>
              <p className="text-sm font-semibold text-gray-800">{info.label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{info.description}</p>
            </button>
          ))}
        </motion.div>
      )}

      {questions.length > 0 && (
        <div className="space-y-3">
          <AnimatePresence initial={false}>
            {questions.map((question, index) => (
              <motion.div key={question.id} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0, marginBottom: 0 }} transition={{ duration: 0.2 }} className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
                {/* Question header */}
                <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <span style={{ color: 'var(--brand)' }}>{QuestionTypeInfo[question.type].icon}</span>
                    <span className="text-sm font-medium text-gray-700">{QuestionTypeInfo[question.type].label}</span>
                    <span className="text-xs text-gray-400">#{index + 1}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => moveQuestion(question.id, 'up')} disabled={index === 0} className="p-1.5 rounded-md hover:bg-gray-200 disabled:opacity-30 text-gray-500 transition-colors" title="Move up">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                    </button>
                    <button onClick={() => moveQuestion(question.id, 'down')} disabled={index === questions.length - 1} className="p-1.5 rounded-md hover:bg-gray-200 disabled:opacity-30 text-gray-500 transition-colors" title="Move down">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                    <button onClick={() => removeQuestion(question.id)} className="p-1.5 rounded-md hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors" title="Remove question">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                </div>

                {/* Question body */}
                <div className="p-4 space-y-3">
                  <Input value={question.question} onChange={e => updateQuestion(question.id, { question: e.target.value })} placeholder={QuestionTypeInfo[question.type].placeholder} required />

                  {question.type === 'multiChoice' && (
                    <div className="space-y-2 pl-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-gray-500">Answer type:</span>
                        <button type="button" onClick={() => updateQuestion(question.id, { multiSelect: false, minSelections: undefined })} className={`px-2.5 py-1 text-xs rounded-full font-medium border transition-colors ${!question.multiSelect ? 'text-white border-transparent' : 'bg-white text-gray-600 border-gray-300 hover:border-purple-400'}`} style={!question.multiSelect ? { backgroundColor: 'var(--brand)', borderColor: 'var(--brand)' } : undefined}>Single</button>
                        <button type="button" onClick={() => updateQuestion(question.id, { multiSelect: true, minSelections: 1 })} className={`px-2.5 py-1 text-xs rounded-full font-medium border transition-colors ${question.multiSelect ? 'text-white border-transparent' : 'bg-white text-gray-600 border-gray-300 hover:border-purple-400'}`} style={question.multiSelect ? { backgroundColor: 'var(--brand)', borderColor: 'var(--brand)' } : undefined}>Multiple</button>
                      </div>
                      {question.multiSelect && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">Min selections:</span>
                          <input type="number" min={1} max={question.options?.filter(o => o !== '__others__').length || 1} value={question.minSelections ?? 1} onChange={e => updateQuestion(question.id, { minSelections: Math.max(1, parseInt(e.target.value) || 1) })} className="w-14 px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2" />
                        </div>
                      )}
                      {question.options?.map((option, oi) => (
                        <div key={oi} className="flex items-center gap-2">
                          <span className="text-gray-400 text-xs shrink-0">{question.multiSelect ? '☐' : '○'}</span>
                          {option === '__others__' ? (
                            <span className="flex-1 text-xs text-gray-400 italic px-2 py-1 bg-gray-50 rounded">Others (Please Specify)</span>
                          ) : (
                            <div className="flex-1">
                              <Input value={option} onChange={e => updateOption(question.id, oi, e.target.value)} placeholder={`Option ${oi + 1}`} required />
                            </div>
                          )}
                          <button onClick={() => removeOption(question.id, oi)} className="p-1 text-red-400 hover:text-red-600 transition-colors shrink-0">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </div>
                      ))}
                      <div className="flex gap-2 flex-wrap">
                        <button onClick={() => addOption(question.id)} className="text-xs font-medium px-2.5 py-1 rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">+ Add option</button>
                        {!question.options?.includes('__others__') && (
                          <button onClick={() => updateQuestion(question.id, { options: [...(question.options || []), '__others__'] })} className="text-xs font-medium px-2.5 py-1 rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">+ Others</button>
                        )}
                      </div>
                    </div>
                  )}

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={question.required} onChange={e => updateQuestion(question.id, { required: e.target.checked })} className="h-4 w-4 rounded" />
                    <span className="text-xs text-gray-600">Required</span>
                  </label>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          <FloatingAddTray onAdd={addQuestion} />
        </div>
      )}

      <div className="flex justify-between gap-3 pt-2">
        <Button fullWidth={false} onClick={() => goToStep('basics')}>← Back</Button>
        <div className="flex gap-2">
          <Button fullWidth={false} onClick={handleSave} disabled={questions.length === 0 || saving}>
            {saving ? 'Saving…' : 'Save Changes'}
          </Button>
          <Button fullWidth={false} onClick={() => goToStep('tags')} disabled={questions.length === 0}>Logic Tags →</Button>
        </div>
      </div>
    </div>
  );

  const renderTagsStep = () => {
    const colorOptions: CustomTagRule['color'][] = ['green', 'yellow', 'red', 'blue', 'gray'];
    const operatorOptions: CustomTagRule['condition']['operator'][] = ['contains', 'equals', 'less_than', 'greater_than'];
    const operatorLabels: Record<string, string> = { contains: 'contains', equals: 'equals', less_than: '< less than', greater_than: '> greater than' };

    const addRule = () => {
      if (questions.length === 0) return;
      setCustomTagRules(prev => [...prev, { id: uuidv4(), label: '', color: 'blue', condition: { questionId: questions[0].id, operator: 'contains', value: '' }, conditions: [{ questionId: questions[0].id, operator: 'contains', value: '' }] }]);
    };
    const updateRule = (id: string, updates: Partial<CustomTagRule>) => setCustomTagRules(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
    const removeRule = (id: string) => setCustomTagRules(prev => prev.filter(r => r.id !== id));
    const updateConditionAt = (ruleId: string, index: number, updates: Partial<CustomTagRule['condition']>) => {
      setCustomTagRules(prev => prev.map(r => {
        if (r.id !== ruleId) return r;
        const conditions = [...(r.conditions ?? [r.condition])];
        conditions[index] = { ...conditions[index], ...updates };
        return { ...r, conditions, condition: conditions[0] };
      }));
    };
    const addCondition = (ruleId: string) => {
      if (questions.length === 0) return;
      setCustomTagRules(prev => prev.map(r => {
        if (r.id !== ruleId) return r;
        const conditions = [...(r.conditions ?? [r.condition]), { questionId: questions[0].id, operator: 'contains' as const, value: '' }];
        return { ...r, conditions };
      }));
    };
    const removeCondition = (ruleId: string, index: number) => {
      setCustomTagRules(prev => prev.map(r => {
        if (r.id !== ruleId) return r;
        const conditions = (r.conditions ?? [r.condition]).filter((_, i) => i !== index);
        if (conditions.length === 0) return r;
        return { ...r, conditions, condition: conditions[0] };
      }));
    };

    return (
      <div className="space-y-4">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-base font-semibold text-gray-800">Logic Tags</h3>
            <p className="text-sm text-gray-500 mt-0.5">Auto-apply tags to responses when conditions match (AND logic).</p>
          </div>
          <Button fullWidth={false} onClick={addRule} disabled={questions.length === 0}>+ Add Rule</Button>
        </div>

        {customTagRules.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No rules yet. Click "Add Rule" to create one.</p>
        ) : (
          <div className="space-y-4">
            {customTagRules.map(rule => {
              const conditions = rule.conditions ?? [rule.condition];
              return (
                <div key={rule.id} className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-3">
                  <div className="flex items-end gap-3 flex-wrap">
                    <div className="flex-1 min-w-[140px]">
                      <label className="text-xs text-gray-500 mb-1 block">Tag Label</label>
                      <input type="text" value={rule.label} onChange={e => updateRule(rule.id, { label: e.target.value })} placeholder="e.g. Needs Follow-up" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Colour</label>
                      <select value={rule.color} onChange={e => updateRule(rule.id, { color: e.target.value as CustomTagRule['color'] })} className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2">
                        {colorOptions.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <button onClick={() => removeRule(rule.id)} className="text-red-400 hover:text-red-600 text-xs pb-2 transition-colors">Remove</button>
                  </div>
                  <div className="space-y-2">
                    {conditions.map((cond, ci) => (
                      <div key={ci} className="flex items-end gap-2 flex-wrap">
                        <span className={`text-xs font-semibold w-8 pb-2.5 ${ci === 0 ? 'text-gray-500' : 'text-purple-600'}`}>{ci === 0 ? 'IF' : 'AND'}</span>
                        <div className="flex-1 min-w-[120px]">
                          {ci === 0 && <label className="text-xs text-gray-500 mb-1 block">Question</label>}
                          <select value={cond.questionId} onChange={e => updateConditionAt(rule.id, ci, { questionId: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2">
                            {questions.map(q => <option key={q.id} value={q.id}>{q.question || `Question (${q.type})`}</option>)}
                          </select>
                        </div>
                        <div>
                          {ci === 0 && <label className="text-xs text-gray-500 mb-1 block">Operator</label>}
                          <select value={cond.operator} onChange={e => updateConditionAt(rule.id, ci, { operator: e.target.value as CustomTagRule['condition']['operator'] })} className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2">
                            {operatorOptions.map(op => <option key={op} value={op}>{operatorLabels[op]}</option>)}
                          </select>
                        </div>
                        <div className="flex-1 min-w-[80px]">
                          {ci === 0 && <label className="text-xs text-gray-500 mb-1 block">Value</label>}
                          <input type="text" value={cond.value} onChange={e => updateConditionAt(rule.id, ci, { value: e.target.value })} placeholder="e.g. dirty" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2" />
                        </div>
                        {conditions.length > 1 && (
                          <button onClick={() => removeCondition(rule.id, ci)} className="text-red-400 hover:text-red-600 text-xs pb-2.5 transition-colors">✕</button>
                        )}
                      </div>
                    ))}
                  </div>
                  <button onClick={() => addCondition(rule.id)} className="text-xs text-purple-600 hover:text-purple-800 font-medium transition-colors">+ Add AND condition</button>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex justify-between gap-3 pt-2">
          <Button fullWidth={false} onClick={() => goToStep('questions')}>← Back to Questions</Button>
          <Button fullWidth={false} onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Changes'}
          </Button>
        </div>
      </div>
    );
  };

  // ── Step labels + indicator ──────────────────────────────────────────────

  const stepLabels: Record<Step, string> = { basics: 'Details', questions: 'Questions', tags: 'Logic Tags' };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      <Toast toasts={toasts} onDismiss={dismissToast} />

      {/* Backdrop */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Edit Form</h2>
              <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{form.title}</p>
            </div>
            <div className="flex items-center gap-3">
              {/* Step indicator */}
              <div className="flex items-center gap-1.5">
                {STEP_ORDER.map(step => (
                  <button
                    key={step}
                    onClick={() => goToStep(step)}
                    title={stepLabels[step]}
                    className={`h-2 rounded-full transition-all duration-300 ${currentStep === step ? 'w-6' : 'w-2'}`}
                    style={{ backgroundColor: currentStep === step ? 'var(--brand)' : '#D1D5DB' }}
                  />
                ))}
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors" aria-label="Close">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-6 py-5 overflow-hidden">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={currentStep}
                custom={direction}
                variants={stepVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ type: 'tween', ease: 'easeInOut', duration: 0.25 }}
              >
                {currentStep === 'basics' && renderBasicsStep()}
                {currentStep === 'questions' && renderQuestionsStep()}
                {currentStep === 'tags' && renderTagsStep()}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </>
  );
};

export default FeedbackFormEditor;
