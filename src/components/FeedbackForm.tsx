'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useGoogleReCaptcha } from 'react-google-recaptcha-v3';
import Button from './Button';
import Toast from './Toast';
import { useToast } from '../hooks/useToast';
import { submitFeedback } from '../lib/firestore';
import { hasIpSubmittedForm } from '../lib/firestore';
import { getVisitorInfo } from '../lib/visitorInfo';
import { computeAllTags, isNegativeResponse, hasCustomTags } from '../lib/tagEngine';
import type { FeedbackForm } from '../types';
import type { VisitorInfo } from '../lib/visitorInfo';

interface FeedbackFormProps {
  form: FeedbackForm;
}

const FeedbackForm: React.FC<FeedbackFormProps> = ({ form }) => {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [visitorInfo, setVisitorInfo] = useState<VisitorInfo | null>(null);
  const [duplicateIp, setDuplicateIp] = useState(false);
  const [checkingIp, setCheckingIp] = useState(true);
  const [formOpenedAt] = useState<number>(Date.now());
  const { toasts, showToast, dismissToast } = useToast();
  const { executeRecaptcha } = useGoogleReCaptcha();

  useEffect(() => {
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

  // Build zod schema dynamically from form.questions
  const schema = useMemo(() => {
    const schemaShape = form.questions.reduce((acc, q) => {
      let base: z.ZodTypeAny;
      if (q.type === 'rating') {
        base = z.number().min(1).max(5);
      } else if (q.type === 'multiChoice' && q.multiSelect) {
        // Checkbox: array of strings with minimum selections
        const min = q.minSelections ?? 1;
        base = z.array(z.string()).min(min, {
          message: `Please select at least ${min} option${min > 1 ? 's' : ''}`,
        });
      } else if (q.type === 'multiChoice' && q.options?.includes('__others__')) {
        base = z.preprocess(
          val => (val == null ? '' : val),
          z.string().min(1).refine(
            (val) => val !== '__others__',
            { message: 'You selected "Others" — please type your answer in the box provided.' }
          )
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

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormValues) => {
    setSubmitError(null);
    setSubmitting(true);
    try {
      // reCAPTCHA verification
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

      const feedbackResponse = {
        id: crypto.randomUUID(),
        formId: form.id,
        location: form.location,
        responses,
        submittedAt: new Date(),
        timeSpentSeconds,
        tags,
        ...(visitorInfo ? {
          visitorIp: visitorInfo.ip,
          visitorCity: visitorInfo.city,
          visitorRegion: visitorInfo.region,
          visitorCountry: visitorInfo.country,
          visitorIsp: visitorInfo.isp,
          visitorAccessedAt: visitorInfo.accessedAt,
        } : {}),
      };
      await submitFeedback(feedbackResponse);

      // Send email notification for negative responses OR any custom tag match
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
        }).catch(console.error); // fire-and-forget
      }

      showToast('Your feedback has been submitted successfully!', 'success');
      setSubmitted(true);
    } catch (err) {
      console.error('Error submitting feedback:', err);
      showToast('Failed to submit feedback. Please try again.', 'error');
      setSubmitError('Failed to submit feedback. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!form.isActive) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-white rounded-lg shadow-lg p-8 text-center">
          <p className="text-gray-600 text-lg">This form is no longer active.</p>
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
          <h2 className="text-2xl font-bold text-green-600 mb-4">Thank You!</h2>
          <p className="text-gray-600">Your feedback has been submitted successfully.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <Toast toasts={toasts} onDismiss={dismissToast} />
      <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
        <h1 className="text-3xl font-bold mb-2">{form.title}</h1>
        <div className="flex items-center text-gray-600 mb-6">
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span>{form.location}</span>
        </div>
        {form.description && (
          <p className="text-gray-700 text-sm mb-4">{form.description}</p>
        )}
        <p className="text-gray-600 text-sm">
          Your feedback helps us improve our services. All responses are anonymous.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {form.questions.map((question, index) => (
          <div key={question.id} className="bg-white rounded-lg shadow-lg p-6" data-testid="question-block">
            <div className="flex items-start mb-4">
              <span className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center font-semibold">
                {index + 1}
              </span>
              <div className="ml-4 flex-grow">
                <h3 className="text-lg font-medium text-gray-900">
                  {question.question}
                  {question.required && <span className="text-red-500 ml-1">*</span>}
                </h3>

                {question.type === 'rating' && (
                  <div className="mt-4">
                    <Controller
                      name={question.id as never}
                      control={control}
                      render={({ field }) => (
                        <div>
                          <div className="flex gap-3 flex-wrap" data-testid={`rating-group-${question.id}`}>
                            {[1, 2, 3, 4, 5].map((rating) => (
                              <button
                                key={rating}
                                type="button"
                                onClick={() => field.onChange(rating)}
                                className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-medium transition-all transform hover:scale-110
                                  ${field.value === rating
                                    ? 'bg-purple-600 text-white shadow-lg'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                  }`}
                              >
                                {rating}
                              </button>
                            ))}
                          </div>
                          <div className="flex justify-between text-sm text-gray-500 mt-2" style={{ width: 'calc(5 * 3rem + 4 * 0.75rem)' }}>
                            <span>Poor</span>
                            <span>Excellent</span>
                          </div>
                        </div>
                      )}
                    />
                    {errors[question.id as keyof FormValues] && (
                      <p className="mt-2 text-sm text-red-600" role="alert">
                        {String((errors[question.id as keyof FormValues] as { message?: string })?.message ?? 'Please answer this question before continuing.')}
                      </p>
                    )}
                  </div>
                )}

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
                    {errors[question.id as keyof FormValues] && (
                      <p className="mt-2 text-sm text-red-600" role="alert">
                        {String((errors[question.id as keyof FormValues] as { message?: string })?.message ?? 'Please answer this question before continuing.')}
                      </p>
                    )}
                  </div>
                )}

                {question.type === 'multiChoice' && question.options && (
                  <div className="mt-4 space-y-3">
                    {question.multiSelect ? (
                      // Checkbox mode — multiple selections
                      <Controller
                        name={question.id as never}
                        control={control}
                        defaultValue={[] as any}
                        render={({ field }) => {
                          const selected: string[] = Array.isArray(field.value) ? field.value : [];
                          const [othersText, setOthersText] = useState('');

                          const toggle = (val: string) => {
                            if (val === '__others__') return; // handled separately
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
                              {question.options!.map((option, optIndex) => {
                                if (option === '__others__') {
                                  return (
                                    <label key={optIndex} className="flex items-center p-3 rounded-lg border-2 transition-all cursor-pointer border-gray-200 hover:border-gray-300 hover:bg-gray-50">
                                      <input
                                        type="checkbox"
                                        checked={othersChecked}
                                        onChange={e => toggleOthers(e.target.checked)}
                                        className="h-4 w-4 text-purple-600 focus:ring-purple-500"
                                      />
                                      <span className="ml-3 text-gray-700 mr-3">Others</span>
                                      {othersChecked && (
                                        <input
                                          type="text"
                                          placeholder="Please specify..."
                                          value={othersText}
                                          onChange={e => {
                                            setOthersText(e.target.value);
                                            const next = selected.filter(v => !v.startsWith('__others__:'));
                                            field.onChange([...next, `__others__:${e.target.value}`]);
                                          }}
                                          className="flex-1 border-b border-gray-400 focus:outline-none focus:border-purple-500 text-sm py-1"
                                          autoFocus
                                          onClick={e => e.stopPropagation()}
                                        />
                                      )}
                                    </label>
                                  );
                                }
                                return (
                                  <label key={optIndex} className="flex items-center p-3 rounded-lg border-2 transition-all cursor-pointer border-gray-200 hover:border-gray-300 hover:bg-gray-50">
                                    <input
                                      type="checkbox"
                                      checked={selected.includes(option)}
                                      onChange={() => toggle(option)}
                                      className="h-4 w-4 text-purple-600 focus:ring-purple-500"
                                    />
                                    <span className="ml-3 text-gray-700">{option}</span>
                                  </label>
                                );
                              })}
                              {question.minSelections && (
                                <p className="text-xs text-gray-400">Select at least {question.minSelections}</p>
                              )}
                            </>
                          );
                        }}
                      />
                    ) : (
                      // Radio mode — single selection
                      <Controller
                        name={question.id as never}
                        control={control}
                        render={({ field }) => (
                          <>
                            {question.options!.map((option, optIndex) => {
                              if (option === '__others__') {
                                const fixedOptions = question.options!.filter(o => o !== '__others__');
                                const isSelected = field.value === '__others__' || (
                                  typeof field.value === 'string' &&
                                  field.value !== '' &&
                                  !fixedOptions.includes(field.value as string)
                                );
                                const othersText = isSelected && field.value !== '__others__' ? field.value as string : '';
                                return (
                                  <label key={optIndex} className="flex items-center p-3 rounded-lg border-2 transition-all cursor-pointer border-gray-200 hover:border-gray-300 hover:bg-gray-50">
                                    <input
                                      type="radio"
                                      name={question.id}
                                      value="__others__"
                                      checked={isSelected}
                                      onChange={() => field.onChange('__others__')}
                                      className="h-4 w-4 text-purple-600 focus:ring-purple-500"
                                    />
                                    <span className="ml-3 text-gray-700 mr-3">Others</span>
                                    {isSelected && (
                                      <input
                                        type="text"
                                        placeholder="Please specify..."
                                        value={othersText}
                                        onChange={(e) => field.onChange(e.target.value || '__others__')}
                                        className="flex-1 border-b border-gray-400 focus:outline-none focus:border-purple-500 text-sm py-1"
                                        autoFocus
                                        onClick={(e) => e.stopPropagation()}
                                      />
                                    )}
                                  </label>
                                );
                              }
                              return (
                                <label key={optIndex} className="flex items-center p-3 rounded-lg border-2 transition-all cursor-pointer border-gray-200 hover:border-gray-300 hover:bg-gray-50">
                                  <input
                                    type="radio"
                                    name={question.id}
                                    value={option}
                                    checked={field.value === option}
                                    onChange={() => field.onChange(option)}
                                    className="h-4 w-4 text-purple-600 focus:ring-purple-500"
                                  />
                                  <span className="ml-3 text-gray-700">{option}</span>
                                </label>
                              );
                            })}
                          </>
                        )}
                      />
                    )}
                    {errors[question.id as keyof FormValues] && (
                      <p className="mt-2 text-sm text-red-600" role="alert">
                        {String((errors[question.id as keyof FormValues] as { message?: string })?.message ?? 'Please answer this question before continuing.')}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {submitError && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-600">{submitError}</p>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <Button type="submit" className="px-8" isLoading={submitting} loadingText="Submitting…" disabled={submitting}>
            Submit Feedback
          </Button>
        </div>
      </form>
    </div>
  );
};

export default FeedbackForm;

