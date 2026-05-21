'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { QRCodeSVG } from 'qrcode.react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  motion,
  AnimatePresence,
} from 'framer-motion';
import Input from './Input';
import Button from './Button';
import Toast from './Toast';
import ImageUpload from './ImageUpload';
import { useToast } from '../hooks/useToast';
import { useTenant } from '../contexts/TenantContext';
import type { FeedbackForm, FeedbackQuestion, CustomTagRule, LocationSettings } from '../types';

// ── Types ─────────────────────────────────────────────────────────────────────

interface FeedbackFormBuilderProps {
  onSave: (form: FeedbackForm) => Promise<void>;
}

type Step = 'basics' | 'questions' | 'tags';

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

const stepTransition = { type: 'tween' as const, ease: 'easeInOut' as const, duration: 0.28 };

const trayVariants = {
  hidden: { opacity: 0, scale: 0.85, y: 8 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring' as const, stiffness: 400, damping: 28 } },
  exit: { opacity: 0, scale: 0.85, y: 8, transition: { duration: 0.15 } },
};

const previewPanelVariants = {
  // Desktop: slide in from right
  hiddenDesktop: { x: '100%', opacity: 0 },
  visibleDesktop: { x: 0, opacity: 1, transition: { type: 'tween' as const, ease: 'easeOut' as const, duration: 0.3 } },
  exitDesktop: { x: '100%', opacity: 0, transition: { type: 'tween' as const, ease: 'easeIn' as const, duration: 0.25 } },
  // Mobile: slide up from bottom
  hiddenMobile: { y: '100%', opacity: 0 },
  visibleMobile: { y: 0, opacity: 1, transition: { type: 'tween' as const, ease: 'easeOut' as const, duration: 0.3 } },
  exitMobile: { y: '100%', opacity: 0, transition: { type: 'tween' as const, ease: 'easeIn' as const, duration: 0.25 } },
};

const DRAFT_KEY = 'feedbackFormBuilderDraft';

// ── Step order for direction tracking ────────────────────────────────────────

const STEP_ORDER: Step[] = ['basics', 'questions', 'tags'];

// ── Preview panel — read-only form render ─────────────────────────────────────

function PreviewPanel({
  title,
  description,
  location,
  ogImageUrl,
  questions,
  stepByStep,
  onClose,
}: {
  title: string;
  description: string;
  location: string;
  ogImageUrl: string;
  questions: FeedbackQuestion[];
  stepByStep: boolean;
  onClose: () => void;
}) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const panelContent = (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Panel header */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-red-400" />
          <div className="w-2 h-2 rounded-full bg-yellow-400" />
          <div className="w-2 h-2 rounded-full bg-green-400" />
          <span className="ml-2 text-xs text-gray-400 font-medium">Preview</span>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          aria-label="Close preview"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Scrollable form preview */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Form header card */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          {ogImageUrl && (
            <img src={ogImageUrl} alt={title} className="w-full h-32 object-cover rounded-lg mb-4" />
          )}
          <h2 className="text-base font-bold text-gray-900 mb-1">{title || 'Untitled Form'}</h2>
          {location && (
            <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-2">
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {location}
            </div>
          )}
          {description && <p className="text-xs text-gray-600">{description}</p>}
          {stepByStep && (
            <span className="inline-flex mt-2 px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700">
              Step-by-step
            </span>
          )}
        </div>

        {/* Questions */}
        {questions.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">
            No questions added yet
          </div>
        ) : (
          questions.map((q, i) => (
            <div key={q.id} className="bg-white rounded-xl shadow-sm p-4">
              <div className="flex items-start gap-3 mb-3">
                <span
                  className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0"
                  style={{ backgroundColor: 'var(--brand)' }}
                >
                  {i + 1}
                </span>
                <p className="text-sm font-medium text-gray-900">
                  {q.question || <span className="text-gray-400 italic">Question text…</span>}
                  {q.required && <span className="text-red-500 ml-1">*</span>}
                </p>
              </div>

              {q.type === 'rating' && (
                <div className="flex gap-2 ml-9">
                  {[1, 2, 3, 4, 5].map(r => (
                    <div key={r} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-sm text-gray-500">
                      {r}
                    </div>
                  ))}
                </div>
              )}

              {q.type === 'text' && (
                <div className="ml-9">
                  <div className="w-full h-16 rounded-lg bg-gray-50 border border-gray-200" />
                </div>
              )}

              {q.type === 'multiChoice' && q.options && (
                <div className="ml-9 space-y-2">
                  {q.options.map((opt, oi) => (
                    <div key={oi} className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded-${q.multiSelect ? 'sm' : 'full'} border-2 border-gray-300 shrink-0`} />
                      <span className="text-xs text-gray-600">
                        {opt === '__others__' ? 'Others (Please Specify)' : opt || `Option ${oi + 1}`}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}

        {/* Submit button preview */}
        {questions.length > 0 && (
          <div className="flex justify-end pb-4">
            <div
              className="px-5 py-2.5 rounded-lg text-sm font-medium text-white opacity-70"
              style={{ backgroundColor: 'var(--brand)' }}
            >
              Submit Feedback
            </div>
          </div>
        )}
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <motion.div
        key="preview-mobile"
        className="fixed inset-0 z-50 flex flex-col"
        initial="hiddenMobile"
        animate="visibleMobile"
        exit="exitMobile"
        variants={previewPanelVariants}
      >
        {panelContent}
      </motion.div>
    );
  }

  return (
    <motion.div
      key="preview-desktop"
      className="fixed top-0 right-0 bottom-0 z-40 w-[380px] shadow-2xl border-l border-gray-200 overflow-hidden"
      initial="hiddenDesktop"
      animate="visibleDesktop"
      exit="exitDesktop"
      variants={previewPanelVariants}
    >
      {panelContent}
    </motion.div>
  );
}

// ── Floating add-question tray ────────────────────────────────────────────────

function FloatingAddTray({ onAdd }: { onAdd: (type: FeedbackQuestion['type']) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleAdd = (type: FeedbackQuestion['type']) => {
    onAdd(type);
    setOpen(false);
  };

  return (
    <div ref={ref} className="flex justify-end mt-4 relative">
      {/* Tray */}
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

      {/* + button */}
      <motion.button
        onClick={() => setOpen(o => !o)}
        whileTap={{ scale: 0.92 }}
        className="w-12 h-12 rounded-full text-white shadow-lg flex items-center justify-center transition-transform"
        style={{ backgroundColor: 'var(--brand)' }}
        aria-label="Add question"
      >
        <motion.svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          animate={{ rotate: open ? 45 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </motion.svg>
      </motion.button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const FeedbackFormBuilder: React.FC<FeedbackFormBuilderProps> = ({ onSave }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [questions, setQuestions] = useState<FeedbackQuestion[]>([]);
  const [showQR, setShowQR] = useState(false);
  const [formUrl, setFormUrl] = useState('');
  const [currentStep, setCurrentStep] = useState<Step>('basics');
  const [direction, setDirection] = useState(1);
  const [showPreview, setShowPreview] = useState(false);
  const [customTagRules, setCustomTagRules] = useState<CustomTagRule[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [ogImageUrl, setOgImageUrl] = useState('');
  const [stepByStep, setStepByStep] = useState(false);
  const { toasts, showToast, dismissToast } = useToast();
  const { tenant, tenantId } = useTenant();

  const isOverFormLimit = tenant != null && tenant.formCount >= tenant.formLimit;

  const goToStep = useCallback((next: Step) => {
    const cur = STEP_ORDER.indexOf(currentStep);
    const nxt = STEP_ORDER.indexOf(next);
    setDirection(nxt >= cur ? 1 : -1);
    setCurrentStep(next);
  }, [currentStep]);

  // ── Draft persistence ──────────────────────────────────────────────────────
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(DRAFT_KEY);
      if (saved) {
        const d = JSON.parse(saved);
        if (d.title) setTitle(d.title);
        if (d.description) setDescription(d.description);
        if (d.location) setLocation(d.location);
        if (d.questions) setQuestions(d.questions);
        if (d.currentStep) setCurrentStep(d.currentStep);
        if (d.customTagRules) setCustomTagRules(d.customTagRules);
        if (d.ogImageUrl) setOgImageUrl(d.ogImageUrl);
        if (d.stepByStep !== undefined) setStepByStep(d.stepByStep);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (showQR) return;
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({
        title, description, location, questions, currentStep, customTagRules, ogImageUrl, stepByStep,
      }));
    } catch { /* ignore */ }
  }, [title, description, location, questions, currentStep, customTagRules, ogImageUrl, stepByStep, showQR]);

  // ── Locations ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const snap = await getDoc(doc(db, 'tenant-settings', tenantId, 'config', 'locations'));
        if (snap.exists()) {
          const fetched = (snap.data() as LocationSettings).locations || [];
          setLocations(fetched);
        }
      } catch { /* ignore */ }
    };
    fetchLocations();
  }, [tenantId]);

  // ── Question helpers ───────────────────────────────────────────────────────
  const addQuestion = (type: FeedbackQuestion['type']) => {
    setQuestions(prev => [...prev, {
      id: uuidv4(), type, question: '', required: true,
      ...(type === 'multiChoice' ? { options: [''] } : {}),
    }]);
  };

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

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!title || !location || questions.length === 0) return;
    if (!tenant) { showToast('Still loading your account. Please try again.', 'error'); return; }

    const form: FeedbackForm = {
      id: uuidv4(), title, description, location, questions,
      createdAt: new Date(), isActive: true, stepByStep,
      ...(customTagRules.length > 0 ? { customTagRules } : {}),
      ...(ogImageUrl ? { ogImageUrl } : {}),
    };

    try {
      await onSave(form);
      const url = `${window.location.origin}/feedback/${form.id}`;
      setFormUrl(url);
      showToast('Form created successfully!', 'success');
      sessionStorage.removeItem(DRAFT_KEY);
      setShowQR(true);
    } catch {
      showToast('Failed to create form. Please try again.', 'error');
    }
  };
  
  // ── QR success screen ──────────────────────────────────────────────────────
  if (showQR) {
    const handleDownloadQR = () => {
      const svg = document.querySelector('#qr-code-svg svg') as SVGElement;
      if (!svg) return;
      const svgData = new XMLSerializer().serializeToString(svg);
      const canvas = document.createElement('canvas');
      canvas.width = 400; canvas.height = 400;
      const ctx = canvas.getContext('2d');
      const img = new Image();
      img.onload = () => {
        ctx?.drawImage(img, 0, 0, 400, 400);
        const a = document.createElement('a');
        a.download = 'feedback-form-qr.png';
        a.href = canvas.toDataURL('image/png');
        a.click();
      };
      img.src = 'data:image/svg+xml;base64,' + btoa(encodeURIComponent(svgData).replace(/%([0-9A-F]{2})/g, (_, p1) => String.fromCharCode(parseInt(p1, 16))));
    };
    const shareText = encodeURIComponent(`Share your feedback: ${formUrl}`);

    return (
      <div className="bg-white p-6 rounded-xl shadow text-center max-w-lg mx-auto">
        <Toast toasts={toasts} onDismiss={dismissToast} />
        <h2 className="text-xl font-bold mb-2">Form Created!</h2>
        <p className="text-gray-500 text-sm mb-6">Share this QR code or link with your customers</p>
        <div className="flex flex-col items-center gap-3 mb-6" id="qr-code-svg">
          <QRCodeSVG value={formUrl} size={180} />
          <p className="text-xs text-gray-500 break-all">{formUrl}</p>
        </div>
        <div className="flex items-center justify-center gap-2 flex-wrap mb-6">
          <button onClick={handleDownloadQR} title="Download QR" className="p-2.5 rounded-lg text-white transition-colors" style={{ backgroundColor: 'var(--brand)' }}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
          </button>
          <button onClick={() => { navigator.clipboard.writeText(formUrl); showToast('Link copied!', 'success'); }} title="Copy Link" className="p-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
          </button>
          <div className="w-px h-8 bg-gray-200" />
          <a href={`https://wa.me/?text=${shareText}`} target="_blank" rel="noopener noreferrer" title="WhatsApp" className="p-2.5 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          </a>
          {typeof navigator !== 'undefined' && 'share' in navigator && (
            <button onClick={() => navigator.share({ title: 'Feedback Form', url: formUrl }).catch(() => {})} title="Share" className="p-2.5 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
            </button>
          )}
        </div>
        <Button fullWidth={false} onClick={() => window.location.reload()}>Create Another Form</Button>
      </div>
    );
  }

  // ── Step renderers ─────────────────────────────────────────────────────────

  const renderBasicsStep = () => (
    <div className="space-y-6">
      {isOverFormLimit && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
          You&apos;ve reached your form limit ({tenant?.formLimit} forms). Please contact support to upgrade.
        </div>
      )}
      <div className="bg-white p-5 sm:p-6 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-lg font-semibold mb-4">Form Details</h2>
        <div className="space-y-4">
          <Input label="Form Title" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g., Guest Satisfaction Survey" required />
          <Input label="Description" value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe what this form will do…" />
          <Input label="Location" as="select" value={location} onChange={e => setLocation(e.target.value)} required>
            <option value="">Select Location</option>
            {locations.map(loc => <option key={loc} value={loc}>{loc}</option>)}
          </Input>
          <ImageUpload label="Banner Image (optional)" hint="Shown at the top of the form and when shared on social media." currentUrl={ogImageUrl} folder="inan/forms/og-images" onUploaded={url => setOgImageUrl(url)} onRemoved={() => setOgImageUrl('')} />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Question display</label>
            <div className="flex rounded-lg border border-gray-200 overflow-hidden w-fit">
              <button type="button" onClick={() => setStepByStep(false)} className={`px-4 py-2 text-sm font-medium transition-colors border-r border-gray-200 ${!stepByStep ? 'text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`} style={!stepByStep ? { backgroundColor: 'var(--brand)' } : undefined}>All at once</button>
              <button type="button" onClick={() => setStepByStep(true)} className={`px-4 py-2 text-sm font-medium transition-colors ${stepByStep ? 'text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`} style={stepByStep ? { backgroundColor: 'var(--brand)' } : undefined}>One at a time</button>
            </div>
            <p className="mt-1.5 text-xs text-gray-400">{stepByStep ? 'Respondents answer one question per screen.' : 'All questions on a single scrollable page.'}</p>
          </div>
        </div>
      </div>
      <div className="flex justify-between items-center">
        {(title || description || location || questions.length > 0) ? (
          <button onClick={() => { sessionStorage.removeItem(DRAFT_KEY); setTitle(''); setDescription(''); setLocation(''); setQuestions([]); setCustomTagRules([]); setStepByStep(false); setCurrentStep('basics'); }} className="text-sm text-gray-400 hover:text-red-500 transition-colors">Clear draft</button>
        ) : <span />}
        <Button fullWidth={false} onClick={() => goToStep('questions')} disabled={!title || !location || isOverFormLimit}>Next: Add Questions →</Button>
      </div>
    </div>
  );

  const renderQuestionsStep = () => (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Questions</h2>
        <button
          onClick={() => setShowPreview(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          Preview
        </button>
      </div>

      {/* Empty state — show type cards */}
      {questions.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-3"
        >
          {(Object.entries(QuestionTypeInfo) as [FeedbackQuestion['type'], typeof QuestionTypeInfo[keyof typeof QuestionTypeInfo]][]).map(([type, info]) => (
            <button
              key={type}
              onClick={() => addQuestion(type)}
              className="p-4 bg-white border-2 border-gray-200 rounded-xl hover:border-purple-400 hover:bg-purple-50 transition-colors text-left group"
            >
              <span className="text-gray-400 group-hover:text-purple-600 transition-colors mb-2 block">{info.icon}</span>
              <p className="text-sm font-semibold text-gray-800">{info.label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{info.description}</p>
            </button>
          ))}
        </motion.div>
      )}

      {/* Question list */}
      {questions.length > 0 && (
        <div className="space-y-3">
          <AnimatePresence initial={false}>
            {questions.map((question, index) => (
              <motion.div
                key={question.id}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                transition={{ duration: 0.2 }}
                className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden"
              >
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

          {/* Floating add tray */}
          <FloatingAddTray onAdd={addQuestion} />
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between gap-3 pt-2">
        <Button fullWidth={false} onClick={() => goToStep('basics')}>← Back</Button>
        <div className="flex gap-2">
          <Button fullWidth={false} onClick={handleSubmit} disabled={questions.length === 0 || isOverFormLimit}>Create Form</Button>
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
      <div className="space-y-6">
        <div className="bg-white p-5 sm:p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-lg font-semibold">Logic Tags</h2>
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
        </div>
        <div className="flex justify-between gap-3">
          <Button fullWidth={false} onClick={() => goToStep('questions')}>← Back to Questions</Button>
          <Button fullWidth={false} onClick={handleSubmit}>Create Form</Button>
        </div>
      </div>
    );
  };

  // ── Main render ────────────────────────────────────────────────────────────

  const stepLabels: Record<Step, string> = { basics: 'Details', questions: 'Questions', tags: 'Logic Tags' };

  return (
    <div className="max-w-2xl mx-auto">
      <Toast toasts={toasts} onDismiss={dismissToast} />

      {/* Preview panel */}
      <AnimatePresence>
        {showPreview && (
          <PreviewPanel
            title={title}
            description={description}
            location={location}
            ogImageUrl={ogImageUrl}
            questions={questions}
            stepByStep={stepByStep}
            onClose={() => setShowPreview(false)}
          />
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Create Feedback Form</h1>
        {/* Step indicator */}
        <div className="flex items-center gap-1.5">
          {STEP_ORDER.map((step, i) => (
            <React.Fragment key={step}>
              <div
                className={`h-2 rounded-full transition-all duration-300 ${currentStep === step ? 'w-6' : 'w-2'}`}
                style={{ backgroundColor: currentStep === step ? 'var(--brand)' : '#D1D5DB' }}
                title={stepLabels[step]}
              />
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Animated step content */}
      <div className="overflow-hidden">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentStep}
            custom={direction}
            variants={stepVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: 'tween' as const, ease: 'easeInOut' as const, duration: 0.28 }}
          >
            {currentStep === 'basics' && renderBasicsStep()}
            {currentStep === 'questions' && renderQuestionsStep()}
            {currentStep === 'tags' && renderTagsStep()}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default FeedbackFormBuilder;
