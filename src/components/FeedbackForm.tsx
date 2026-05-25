'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { useGoogleReCaptcha } from 'react-google-recaptcha-v3';
import Button from './Button';
import Toast from './Toast';
import { useToast } from '../hooks/useToast';
import { useTenant } from '../contexts/TenantContext';
import { submitFeedback, hasIpSubmittedForm } from '../lib/firestore';
import { getVisitorInfo } from '../lib/visitorInfo';
import { computeAllTags, isNegativeResponse, hasCustomTags } from '../lib/tagEngine';
import type { FeedbackForm, FeedbackQuestion, Tenant } from '../types';
import type { VisitorInfo } from '../lib/visitorInfo';

interface FeedbackFormProps {
  form: FeedbackForm;
  tenantBranding?: Tenant['branding'];
}

// ── Reusable question renderer ────────────────────────────────────────────────

function QuestionBlock({
  question,
  index,
  control,
  errors,
}: {
  question: FeedbackQuestion;
  index: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  errors: any;
}) {
  return (
    <div className="bg-white rounded-lg shadow-lg p-6" data-testid="question-block">
      <div className="flex items-start mb-4">
        <span
          className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-semibold text-white"
          style={{ backgroundColor: 'var(--brand)' }}
        >
          {index + 1}
        </span>
        <div className="ml-4 flex-grow">
          <h3 className="text-base font-medium text-gray-900">
            {question.question}
            {question.required && <span className="text-red-500 ml-1">*</span>}
          </h3>

          {/* Rating */}
          {question.type === 'rating' && (
            <div className="mt-4">
              <Controller
                name={question.id as never}
                control={control}
                render={({ field }) => (
                  <div>
                    <div className="flex gap-3 flex-wrap" data-testid={`rating-group-${question.id}`}>
                      {[1, 2, 3, 4, 5].map(rating => (
                        <button
                          key={rating}
                          type="button"
                          onClick={() => field.onChange(rating)}
                          className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-medium transition-all transform hover:scale-110 ${
                            field.value === rating
                              ? 'text-white shadow-lg'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                          style={field.value === rating ? { backgroundColor: 'var(--brand)' } : {}}
                        >
                          {rating}
                        </button>
                      ))}
                    </div>
                    <div
                      className="flex justify-between text-sm text-gray-500 mt-2"
                      style={{ width: 'calc(5 * 3rem + 4 * 0.75rem)' }}
                    >
                      <span>Poor</span>
                      <span>Excellent</span>
                    </div>
                  </div>
                )}
              />
              {errors[question.id] && (
                <p className="mt-2 text-sm text-red-600" role="alert">
                  {String(errors[question.id]?.message ?? 'Please answer this question before continuing.')}
                </p>
              )}
            </div>
          )}

          {/* Text */}
          {question.type === 'text' && (
            <div className="mt-4">
              <Controller
                name={question.id as never}
                control={control}
                render={({ field }) => (
                  <div>
                    <textarea
                      {...field}
                      maxLength={256}
                      rows={3}
                      placeholder="Share your thoughts here..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                    />
                    <p className="text-xs text-gray-400 text-right mt-1">
                      {(field.value as string)?.length ?? 0}/256
                    </p>
                  </div>
                )}
              />
              {errors[question.id] && (
                <p className="mt-2 text-sm text-red-600" role="alert">
                  {String(errors[question.id]?.message ?? 'Please answer this question before continuing.')}
                </p>
              )}
            </div>
          )}

          {/* Multiple choice */}
          {question.type === 'multiChoice' && question.options && (
            <div className="mt-4 space-y-3">
              {question.multiSelect ? (
                <Controller
                  name={question.id as never}
                  control={control}
                  defaultValue={[] as never}
                  render={({ field }) => {
                    const selected: string[] = Array.isArray(field.value) ? field.value : [];
                    const [othersText, setOthersText] = useState('');
                    const toggle = (val: string) => {
                      const next = selected.includes(val)
                        ? selected.filter(v => v !== val)
                        : [...selected, val];
                      field.onChange(next);
                    };
                    const toggleOthers = (checked: boolean) => {
                      if (checked) {
                        field.onChange([...selected.filter(v => !v.startsWith('__others__:')), '__others__:']);
                      } else {
                        field.onChange(selected.filter(v => !v.startsWith('__others__:')));
                        setOthersText('');
                      }
                    };
                    const othersChecked = selected.some(v => v.startsWith('__others__:'));
                    return (
                      <>
                        {question.options!.map((option, i) => {
                          if (option === '__others__') {
                            return (
                              <label key={i} className="flex items-center p-3 rounded-lg border-2 transition-all cursor-pointer border-gray-200 hover:border-gray-300 hover:bg-gray-50">
                                <input type="checkbox" checked={othersChecked} onChange={e => toggleOthers(e.target.checked)} className="h-4 w-4 text-purple-600 focus:ring-purple-500" />
                                <span className="ml-3 text-gray-700 mr-3">Others</span>
                                {othersChecked && (
                                  <input type="text" placeholder="Please specify..." value={othersText}
                                    onChange={e => { setOthersText(e.target.value); field.onChange([...selected.filter(v => !v.startsWith('__others__:')), `__others__:${e.target.value}`]); }}
                                    className="flex-1 border-b border-gray-400 focus:outline-none focus:border-purple-500 text-sm py-1" autoFocus onClick={e => e.stopPropagation()} />
                                )}
                              </label>
                            );
                          }
                          return (
                            <label key={i} className="flex items-center p-3 rounded-lg border-2 transition-all cursor-pointer border-gray-200 hover:border-gray-300 hover:bg-gray-50">
                              <input type="checkbox" checked={selected.includes(option)} onChange={() => toggle(option)} className="h-4 w-4 text-purple-600 focus:ring-purple-500" />
                              <span className="ml-3 text-gray-700">{option}</span>
                            </label>
                          );
                        })}
                        {question.minSelections && <p className="text-xs text-gray-400">Select at least {question.minSelections}</p>}
                      </>
                    );
                  }}
                />
              ) : (
                <Controller
                  name={question.id as never}
                  control={control}
                  render={({ field }) => (
                    <>
                      {question.options!.map((option, i) => {
                        if (option === '__others__') {
                          const fixedOptions = question.options!.filter(o => o !== '__others__');
                          const isSelected = field.value === '__others__' || (typeof field.value === 'string' && field.value !== '' && !fixedOptions.includes(field.value as string));
                          const othersText = isSelected && field.value !== '__others__' ? field.value as string : '';
                          return (
                            <label key={i} className="flex items-center p-3 rounded-lg border-2 transition-all cursor-pointer border-gray-200 hover:border-gray-300 hover:bg-gray-50">
                              <input type="radio" name={question.id} value="__others__" checked={isSelected} onChange={() => field.onChange('__others__')} className="h-4 w-4 text-purple-600 focus:ring-purple-500" />
                              <span className="ml-3 text-gray-700 mr-3">Others</span>
                              {isSelected && (
                                <input type="text" placeholder="Please specify..." value={othersText}
                                  onChange={e => field.onChange(e.target.value || '__others__')}
                                  className="flex-1 border-b border-gray-400 focus:outline-none focus:border-purple-500 text-sm py-1" autoFocus onClick={e => e.stopPropagation()} />
                              )}
                            </label>
                          );
                        }
                        return (
                          <label key={i} className="flex items-center p-3 rounded-lg border-2 transition-all cursor-pointer border-gray-200 hover:border-gray-300 hover:bg-gray-50">
                            <input type="radio" name={question.id} value={option} checked={field.value === option} onChange={() => field.onChange(option)} className="h-4 w-4 text-purple-600 focus:ring-purple-500" />
                            <span className="ml-3 text-gray-700">{option}</span>
                          </label>
                        );
                      })}
                    </>
                  )}
                />
              )}
              {errors[question.id] && (
                <p className="mt-2 text-sm text-red-600" role="alert">
                  {String(errors[question.id]?.message ?? 'Please answer this question before continuing.')}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const FeedbackFormComponent: React.FC<FeedbackFormProps> = ({ form, tenantBranding }) => {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [visitorInfo, setVisitorInfo] = useState<VisitorInfo | null>(null);
  const [duplicateIp, setDuplicateIp] = useState(false);
  // Start as true only if localStorage already has a submission flag — avoids any flash
  const [checkingIp, setCheckingIp] = useState(
    () => typeof window === 'undefined' || !localStorage.getItem(`submitted_${form.id}`)
  );

  // Step-by-step state
  const [currentStep, setCurrentStep] = useState(0);
  const [formOpenedAt] = useState<number>(Date.now());

  const { toasts, showToast, dismissToast } = useToast();
  const { executeRecaptcha } = useGoogleReCaptcha();
  const { tenant, tenantId } = useTenant();

  useEffect(() => {
    // If the user already submitted this form (stored locally), block immediately
    if (localStorage.getItem(`submitted_${form.id}`)) {
      setDuplicateIp(true);
      setCheckingIp(false);
      return;
    }

    const init = async () => {
      try {
        const info = await getVisitorInfo();
        setVisitorInfo(info);
        if (info.ip !== 'unknown') {
          const isDuplicate = await hasIpSubmittedForm(form.id, info.ip);
          setDuplicateIp(isDuplicate);
        }
      } catch {
        // proceed without blocking
      } finally {
        setCheckingIp(false);
      }
    };
    init();
  }, [form.id]);

  const schema = useMemo(() => {
    const schemaShape = form.questions.reduce((acc, q) => {
      let base: z.ZodTypeAny;
      if (q.type === 'rating') {
        base = z.number().min(1).max(5);
      } else if (q.type === 'multiChoice' && q.multiSelect) {
        const min = q.minSelections ?? 1;
        base = z.array(z.string()).min(min, { message: `Please select at least ${min} option${min > 1 ? 's' : ''}` });
      } else if (q.type === 'multiChoice' && q.options?.includes('__others__')) {
        base = z.preprocess(
          val => (val == null ? '' : val),
          z.string().min(1).refine(val => val !== '__others__', { message: 'You selected "Others" — please type your answer in the box provided.' })
        );
      } else {
        base = z.preprocess(
          val => (val == null ? '' : val),
          z.string()
            .min(1, { message: 'Please answer this question before continuing.' })
            .max(256, { message: 'Your answer is too long — please keep it under 256 characters.' })
        );
      }
      acc[q.id] = q.required ? base : base.optional();
      return acc;
    }, {} as Record<string, z.ZodTypeAny>);
    return z.object(schemaShape);
  }, [form.questions]);

  type FormValues = z.infer<typeof schema>;

  const { control, handleSubmit, trigger, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormValues) => {
    setSubmitError(null);
    setSubmitting(true);
    try {
      if (executeRecaptcha) {
        const token = await executeRecaptcha('feedback_submit');
        const verifyRes = await fetch('/api/verify-recaptcha', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        const verifyData = await verifyRes.json();
        if (!verifyData.success) {
          showToast('Bot detection triggered. Submission blocked.', 'error');
          setSubmitError('Submission blocked. Please try again.');
          return;
        }
      }

      const timeSpentSeconds = Math.round((Date.now() - formOpenedAt) / 1000);
      const responses = data as { [key: string]: string | number };
      const tags = computeAllTags(responses, form, timeSpentSeconds);

      await submitFeedback({
        id: crypto.randomUUID(),
        formId: form.id,
        location: form.location,
        responses,
        submittedAt: new Date(),
        timeSpentSeconds,
        tags,
        tenantId,
        ...(visitorInfo ? {
          visitorIp: visitorInfo.ip,
          visitorCity: visitorInfo.city,
          visitorRegion: visitorInfo.region,
          visitorCountry: visitorInfo.country,
          visitorIsp: visitorInfo.isp,
          visitorAccessedAt: visitorInfo.accessedAt,
        } : {}),
      });

      if (isNegativeResponse(tags) || hasCustomTags(tags)) {
        fetch('/api/notify-negative', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            formTitle: form.title,
            location: form.location,
            tags,
            timeSpent: `${Math.floor(timeSpentSeconds / 60)}m ${timeSpentSeconds % 60}s`,
            visitorCountry: visitorInfo?.country,
            submittedAt: new Date().toISOString(),
          }),
        }).catch(console.error);
      }

      showToast('Your feedback has been submitted successfully!', 'success');
      // Persist submission flag so the form is blocked immediately on any future visit/refresh
      localStorage.setItem(`submitted_${form.id}`, '1');
      setSubmitted(true);
    } catch (err) {
      console.error('Error submitting feedback:', err);
      showToast('Failed to submit feedback. Please try again.', 'error');
      setSubmitError('Failed to submit feedback. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Guard states ──────────────────────────────────────────────────────────

  if (!form.isActive) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-white rounded-lg shadow-lg p-8 text-center">
          <p className="text-gray-600 text-base">This form is no longer active.</p>
        </div>
      </div>
    );
  }

  if (checkingIp) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
      </div>
    );
  }

  if (duplicateIp) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-white rounded-lg shadow-lg p-8 text-center">
          <svg className="w-12 h-12 text-yellow-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Already Submitted</h2>
          <p className="text-gray-600">You have already submitted a response for this form. Only one submission per device is allowed.</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          {/* Animated checkmark — tick extends beyond the circle */}
          <div className="flex justify-center mb-6">
            <svg viewBox="0 0 80 80" className="w-24 h-24">
              {/* Circle draws itself */}
              <circle
                cx="40" cy="40" r="34"
                fill="none"
                stroke="#22c55e"
                strokeWidth="3"
                strokeLinecap="round"
                style={{
                  strokeDasharray: 214,
                  strokeDashoffset: 214,
                  animation: 'thankCircle 0.55s cubic-bezier(0.65,0,0.45,1) 0.1s forwards',
                }}
              />
              {/* Tick — starts inside, tip extends outside the circle */}
              <polyline
                points="22,42 35,55 62,24"
                fill="none"
                stroke="#22c55e"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  strokeDasharray: 60,
                  strokeDashoffset: 60,
                  animation: 'thankTick 0.38s cubic-bezier(0.65,0,0.45,1) 0.6s forwards',
                }}
              />
            </svg>
          </div>

          <style>{`
            @keyframes thankCircle { to { stroke-dashoffset: 0; } }
            @keyframes thankTick   { to { stroke-dashoffset: 0; } }
          `}</style>

          <h2 className="text-xl font-bold text-green-600 mb-4">Thank You!</h2>
          <p className="text-gray-600">Your feedback has been submitted successfully.</p>
        </div>
      </div>
    );
  }

  // ── Shared header (logo + form title) ─────────────────────────────────────

  const FormHeader = () => (
    <>
      {(tenantBranding?.logoUrl || tenant?.branding?.logoUrl) && (
        <div className="flex justify-center mb-6">
          <img
            src={tenantBranding?.logoUrl ?? tenant?.branding?.logoUrl}
            alt="Organisation logo"
            className="h-10 w-auto max-w-[180px] object-contain"
          />
        </div>
      )}
      <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
        {form.ogImageUrl && (
          <img src={form.ogImageUrl} alt={form.title} className="w-full h-48 object-cover rounded-lg mb-6" />
        )}
        <h1 className="text-xl font-bold mb-2">{form.title}</h1>
        <div className="flex items-center text-gray-600 mb-6">
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span>{form.location}</span>
        </div>
        {form.description && <p className="text-gray-700 text-sm mb-4">{form.description}</p>}
      </div>
    </>
  );

  const PoweredBy = () =>
    !tenant?.features?.hidePoweredBy ? (
      <div className="text-center mt-8 text-xs text-gray-400">
        Powered by{' '}
        <a href="https://inan.com.ng" target="_blank" rel="noopener noreferrer" className="hover:text-gray-600">
          Inan Management Ltd
        </a>
      </div>
    ) : null;

  // ── Step-by-step mode ─────────────────────────────────────────────────────

  if (form.stepByStep) {
    const total = form.questions.length;
    const question = form.questions[currentStep];
    const progress = ((currentStep + 1) / total) * 100;
    const isLast = currentStep === total - 1;

    const handleNext = async () => {
      const valid = await trigger(question.id as never);
      if (valid) {
        setSubmitError(null); // clear any lingering error when moving forward
        setCurrentStep(s => s + 1);
      }
    };

    const handleBack = () => {
      setSubmitError(null);
      setCurrentStep(s => s - 1);
    };

    const handleStepSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      const valid = await trigger();
      if (valid) handleSubmit(onSubmit)(e);
    };

    return (
      <div className="max-w-2xl mx-auto p-6">
        <Toast toasts={toasts} onDismiss={dismissToast} />
        <FormHeader />

        {/* Progress bar */}
        <div className="mb-6">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%`, backgroundColor: 'var(--brand)' }}
            />
          </div>
          <p className="text-xs text-gray-500 text-right mt-1">{currentStep + 1} of {total}</p>
        </div>

        <form onSubmit={handleStepSubmit} className="space-y-6">
          {/* Fixed-height container prevents layout shift between steps */}
          <div className="relative overflow-hidden min-h-[280px]">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }}
                transition={{ type: 'tween' as const, ease: 'easeInOut' as const, duration: 0.22 }}
              >
                {/* Render only the current question — RHF keeps all values via hidden inputs */}
                {form.questions.map((q, i) => (
                  <div key={q.id} className={i === currentStep ? '' : 'hidden'}>
                    <QuestionBlock
                      question={q}
                      index={i}
                      control={control}
                      errors={errors}
                    />
                  </div>
                ))}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Submit error — only shown on last step and only when there's an actual error */}
          {submitError && isLast && (
            <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded">
              <p className="text-sm text-red-600">{submitError}</p>
            </div>
          )}

          <div className="flex items-center justify-between gap-3">
            {currentStep > 0 ? (
              <button
                type="button"
                onClick={handleBack}
                className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                ← Back
              </button>
            ) : <span />}

            {isLast ? (
              <Button type="submit" isLoading={submitting} loadingText="Submitting…" disabled={submitting} fullWidth={false}>
                Submit Feedback
              </Button>
            ) : (
              <Button type="button" onClick={handleNext} fullWidth={false}>
                Next →
              </Button>
            )}
          </div>

          {/* Nav dots */}
          <div className="flex justify-center gap-1.5 flex-wrap pt-2">
            {form.questions.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => { setSubmitError(null); setCurrentStep(i); }}
                className="w-2.5 h-2.5 rounded-full transition-colors"
                style={{
                  backgroundColor: i === currentStep
                    ? 'var(--brand)'
                    : i < currentStep
                    ? '#86EFAC'
                    : '#D1D5DB',
                }}
                title={`Question ${i + 1}`}
              />
            ))}
          </div>
        </form>

        <PoweredBy />
      </div>
    );
  }

  // ── All-at-once mode (default) ────────────────────────────────────────────

  return (
    <div className="max-w-2xl mx-auto p-6">
      <Toast toasts={toasts} onDismiss={dismissToast} />
      <FormHeader />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {/* min-h prevents the form from collapsing while questions render */}
        <div className="space-y-8 min-h-[320px]">
          {form.questions.map((question, index) => (
            <QuestionBlock
              key={question.id}
              question={question}
              index={index}
              control={control}
              errors={errors}
            />
          ))}
        </div>

        {submitError && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded">
            <div className="flex">
              <svg className="h-5 w-5 text-red-400 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <p className="ml-3 text-sm text-red-600">{submitError}</p>
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <Button type="submit" className="px-8" isLoading={submitting} loadingText="Submitting…" disabled={submitting}>
            Submit Feedback
          </Button>
        </div>
      </form>

      <PoweredBy />
    </div>
  );
};

export default FeedbackFormComponent;
