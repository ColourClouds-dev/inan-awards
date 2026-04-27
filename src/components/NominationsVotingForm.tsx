'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import confetti from 'canvas-confetti';
import { useGoogleReCaptcha } from 'react-google-recaptcha-v3';
import { submitNominationsVote, hasEmailVoted, hasAnonymousVoted } from '../lib/nominationsFirestore';
import { getAllEmployees } from '../lib/employeesFirestore';
import { useTenant } from '../contexts/TenantContext';
import type { NominationsForm } from '../types';
import Button from './Button';
import Input from './Input';

interface Props {
  form: NominationsForm;
}

function toDate(v: unknown): Date {
  if (v instanceof Date) return v;
  if (v && typeof (v as any).toDate === 'function') return (v as any).toDate();
  if (v && typeof (v as any).seconds === 'number') return new Date((v as any).seconds * 1000);
  return new Date();
}

const ANON_KEY = (formId: string) => `nom_anon_${formId}`;

// Only renders if the form has a bannerImageUrl set
const Banner = ({ form }: { form: NominationsForm }) =>
  form.bannerImageUrl ? (
    <img src={form.bannerImageUrl} alt={form.title} className="h-24 mx-auto object-contain" />
  ) : null;

const PoweredBy = ({ tenant }: { tenant: import('../types').Tenant | null }) =>
  !tenant?.features?.hidePoweredBy ? (
    <div className="text-center mt-8 text-xs text-gray-400">
      Powered by{' '}
      <a href="https://inanmanagement.com" target="_blank" rel="noopener noreferrer" className="hover:text-gray-600">
        Inan Management Ltd
      </a>
    </div>
  ) : null;

const NominationsVotingForm: React.FC<Props> = ({ form }) => {
  const { executeRecaptcha } = useGoogleReCaptcha();
  const { tenant } = useTenant();
  const [step, setStep] = useState<'gate' | 'voting' | 'submitted' | 'closed' | 'duplicate'>('gate');
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [votes, setVotes] = useState<{ [catId: string]: string }>({});
  const [currentCatIdx, setCurrentCatIdx] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Check voting window and active status
  useEffect(() => {
    const now = new Date();
    const open = toDate(form.openAt);
    const close = toDate(form.closeAt);
    if (!form.isActive || now < open || now > close) {
      setStep('closed');
      return;
    }
    if (!form.requireEmail) {
      const anonId = localStorage.getItem(ANON_KEY(form.id));
      if (anonId) {
        hasAnonymousVoted(form.id, anonId).then(voted => {
          if (voted) setStep('duplicate');
          else setStep('voting');
        });
      } else {
        setStep('voting');
      }
    }
  }, [form]);

  const triggerConfetti = useCallback(() => {
    const end = Date.now() + 3000;
    const frame = () => {
      confetti({ particleCount: 50, spread: 360, startVelocity: 30, origin: { x: Math.random(), y: Math.random() - 0.2 } });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();
  }, []);

  const handleEmailVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError('');
    const trimmed = email.trim().toLowerCase();

    // Domain validation: only if tenant has emailDomain configured
    if (tenant?.emailDomain) {
      if (!trimmed.endsWith('@' + tenant.emailDomain)) {
        setEmailError(`Please use your company email (@${tenant.emailDomain}).`);
        return;
      }
    } else {
      // No domain restriction — just validate it's a valid email format
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        setEmailError('Please enter a valid email address.');
        return;
      }
    }

    try {
      const empList = await getAllEmployees();
      const found = empList.find(e => e.Email.toLowerCase() === trimmed && e.Status === 'Active');
      if (!found) { setEmailError('Email not found in active employee records.'); return; }
      const already = await hasEmailVoted(form.id, trimmed);
      if (already) { setStep('duplicate'); return; }
      setStep('voting');
    } catch {
      setEmailError('Could not verify email. Please try again.');
    }
  };

  const handleVote = (catId: string, nominee: string) => {
    setVotes(prev => ({ ...prev, [catId]: nominee }));
    if (currentCatIdx < form.categories.length - 1) {
      setCurrentCatIdx(i => i + 1);
    }
  };

  const handleSubmit = async () => {
    const allVoted = form.categories.every(c => votes[c.id]);
    if (!allVoted) { setError('Please vote in all categories before submitting.'); return; }
    setError('');
    setSubmitting(true);
    try {
      if (executeRecaptcha) {
        const token = await executeRecaptcha('nominations_submit');
        const res = await fetch('/api/verify-recaptcha', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        const data = await res.json();
        if (!data.success) { setError('Bot detection triggered. Please try again.'); setSubmitting(false); return; }
      }

      const voteId = form.requireEmail ? `${form.id}_${email.trim().toLowerCase()}` : uuidv4();

      await submitNominationsVote({
        id: voteId,
        formId: form.id,
        categoryVotes: votes,
        ...(form.requireEmail ? { email: email.trim().toLowerCase() } : {}),
        submittedAt: new Date(),
      });

      if (!form.requireEmail) {
        localStorage.setItem(ANON_KEY(form.id), voteId);
      }

      setStep('submitted');
      triggerConfetti();
    } catch {
      setError('Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Closed ─────────────────────────────────────────────────────────────────
  if (step === 'closed') {
    const now = new Date();
    const open = toDate(form.openAt);
    const close = toDate(form.closeAt);
    const notYet = now < open;
    const disabled = !form.isActive;
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center space-y-4">
          <Banner form={form} />
          <h2 className="text-2xl font-bold text-gray-800">
            {disabled ? 'Voting Unavailable' : notYet ? 'Voting Not Open Yet' : 'Voting Has Closed'}
          </h2>
          <p className="text-gray-500 text-sm">
            {disabled
              ? 'This nominations form is currently disabled.'
              : notYet
              ? `Voting opens on ${open.toLocaleDateString()} at ${open.toLocaleTimeString()}.`
              : `Voting closed on ${close.toLocaleDateString()} at ${close.toLocaleTimeString()}.`}
          </p>
          <PoweredBy tenant={tenant} />
        </div>
      </div>
    );
  }

  // ── Duplicate ──────────────────────────────────────────────────────────────
  if (step === 'duplicate') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center space-y-4">
          <Banner form={form} />
          <h2 className="text-2xl font-bold text-yellow-600">Already Voted</h2>
          <p className="text-gray-500 text-sm">You have already submitted your nominations for this round.</p>
          <PoweredBy tenant={tenant} />
        </div>
      </div>
    );
  }

  // ── Submitted ──────────────────────────────────────────────────────────────
  if (step === 'submitted') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center space-y-4">
          <Banner form={form} />
          <h2 className="text-2xl font-bold text-green-600">Thank You!</h2>
          <p className="text-gray-600">Your nominations have been submitted successfully.</p>
          <p className="text-gray-400 text-sm">We appreciate your participation in the Staff Awards.</p>
          <PoweredBy tenant={tenant} />
        </div>
      </div>
    );
  }

  if (step === 'gate') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full space-y-6">
          <div className="text-center space-y-3">
            <Banner form={form} />
            <h1 className="text-2xl font-bold text-gray-800">{form.title}</h1>
            {form.description && <p className="text-gray-500 text-sm">{form.description}</p>}
            <p className="text-gray-600 text-sm">
              {tenant?.emailDomain
                ? `Enter your @${tenant.emailDomain} email to proceed.`
                : 'Enter your company email to proceed.'}
            </p>
          </div>
          <form onSubmit={handleEmailVerify} className="space-y-4">
            <Input type="email" value={email} onChange={e => { setEmail(e.target.value); setEmailError(''); }}
              placeholder={tenant?.emailDomain ? `yourname@${tenant.emailDomain}` : 'your@email.com'} error={emailError} required />
            <Button type="submit" loadingText="Verifying…">Verify & Continue</Button>
          </form>
          <PoweredBy tenant={tenant} />
        </div>
      </div>
    );
  }

  // ── Voting ─────────────────────────────────────────────────────────────────
  const cat = form.categories[currentCatIdx];
  const progress = ((currentCatIdx + 1) / form.categories.length) * 100;
  const allVoted = form.categories.every(c => votes[c.id]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-6">
        {/* Header */}
        <div className="text-center space-y-1">
          <Banner form={form} />
          <h1 className="text-xl font-bold text-gray-800">{form.title}</h1>
        </div>

        {/* Progress */}
        <div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="bg-purple-600 h-2 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-xs text-gray-500 text-right mt-1">{currentCatIdx + 1} of {form.categories.length}</p>
        </div>

        {/* Category card */}
        <div className="bg-white rounded-xl shadow-lg p-6 space-y-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{cat.title}</h2>
            {cat.description && <p className="text-gray-500 text-sm mt-1">{cat.description}</p>}
          </div>

          <Input as="select" value={votes[cat.id] ?? ''}
            onChange={e => handleVote(cat.id, e.target.value)}>
            <option value="">Select a nominee…</option>
            {cat.nominees.map(n => <option key={n} value={n}>{n}</option>)}
          </Input>

          <div className="flex justify-between gap-3">
            {currentCatIdx > 0 && (
              <Button fullWidth={false} onClick={() => setCurrentCatIdx(i => i - 1)}>← Back</Button>
            )}
            {currentCatIdx < form.categories.length - 1 ? (
              <Button fullWidth={false} onClick={() => setCurrentCatIdx(i => i + 1)}
                disabled={!votes[cat.id]} className="ml-auto">
                Next →
              </Button>
            ) : (
              <Button fullWidth={false} onClick={handleSubmit}
                disabled={!allVoted || submitting} isLoading={submitting} loadingText="Submitting…" className="ml-auto">
                Submit Nominations
              </Button>
            )}
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        {/* Category nav dots */}
        <div className="flex justify-center gap-1.5 flex-wrap">
          {form.categories.map((c, i) => (
            <button key={c.id} onClick={() => setCurrentCatIdx(i)}
              className={`w-2.5 h-2.5 rounded-full transition-colors ${
                i === currentCatIdx ? 'bg-purple-600' : votes[c.id] ? 'bg-green-400' : 'bg-gray-300'
              }`} title={c.title} />
          ))}
        </div>

        <PoweredBy tenant={tenant} />
      </div>
    </div>
  );
};

export default NominationsVotingForm;
