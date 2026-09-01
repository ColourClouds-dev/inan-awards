'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Input from './Input';
import Button from './Button';
import Toast from './Toast';
import { useToast } from '../hooks/useToast';
import { useTenant } from '../contexts/TenantContext';
import { createPoll, validateEmployeeNominees } from '../lib/pollsFirestore';
import RichTextEditor from './RichTextEditor';
import EmployeeSelector from './EmployeeSelector';
import type { Poll, PollQuestion } from '../types';

/** Trash icon for remove buttons */
function TrashIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}

interface PollBuilderProps {
  onSave?: (poll: Omit<Poll, 'id' | 'createdAt'>) => Promise<string>;
}

type Step = 'basics' | 'questions' | 'nominees';

export default function PollBuilder({ onSave }: PollBuilderProps) {
  const router = useRouter();
  const { tenantId, currentUid } = useTenant();
  const { toasts, showToast, dismissToast } = useToast();

  const [step, setStep] = useState<Step>('basics');
  
  // Basics state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [pollType, setPollType] = useState<'opinion' | 'staff_nomination'>('opinion');
  const [allowMultipleVotes, setAllowMultipleVotes] = useState(false);
  const [showResults, setShowResults] = useState<'after_voting' | 'always' | 'never'>('after_voting');
  const [endDateStr, setEndDateStr] = useState('');
  
  // Questions state (for opinion polls)
  const [questions, setQuestions] = useState<PollQuestion[]>([
    {
      id: 'q1',
      question: '',
      type: 'single_choice',
      options: ['', ''],
      required: true,
    },
  ]);

  // Nominees state (for staff nomination polls)
  const [nominees, setNominees] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [shareModal, setShareModal] = useState<{ open: boolean; url: string }>({ open: false, url: '' });
  const [copied, setCopied] = useState(false);

  // Auto-generate a question for staff nomination if type is staff_nomination
  const getPreparedQuestions = (): PollQuestion[] => {
    if (pollType === 'staff_nomination') {
      return [
        {
          id: 'nomination_question',
          question: 'Select your nominee for Staff of the Month',
          type: 'single_choice',
          options: nominees, // Options are the nominee employee IDs
          required: true,
        },
      ];
    }
    return questions;
  };

  const handleNextStep = async () => {
    if (step === 'basics') {
      if (!title.trim()) {
        showToast('Please enter a poll title.', 'error');
        return;
      }
      if (pollType === 'staff_nomination') {
        setStep('nominees');
      } else {
        setStep('questions');
      }
    }
  };

  const handlePrevStep = () => {
    if (step === 'questions' || step === 'nominees') {
      setStep('basics');
    }
  };

  // Opinion Question actions
  const handleAddQuestion = () => {
    setQuestions([
      ...questions,
      {
        id: `q-${Date.now()}`,
        question: '',
        type: 'single_choice',
        options: ['', ''],
        required: true,
      },
    ]);
  };

  const handleRemoveQuestion = (qId: string) => {
    if (questions.length <= 1) {
      showToast('A poll must have at least one question.', 'error');
      return;
    }
    setQuestions(questions.filter(q => q.id !== qId));
  };

  const handleQuestionTextChange = (qId: string, text: string) => {
    setQuestions(
      questions.map(q => (q.id === qId ? { ...q, question: text } : q))
    );
  };

  const handleQuestionTypeChange = (qId: string, val: 'single_choice' | 'multiple_choice') => {
    setQuestions(
      questions.map(q => (q.id === qId ? { ...q, type: val } : q))
    );
  };

  const handleAddOption = (qId: string) => {
    setQuestions(
      questions.map(q => {
        if (q.id === qId) {
          return { ...q, options: [...q.options, ''] };
        }
        return q;
      })
    );
  };

  const handleRemoveOption = (qId: string, index: number) => {
    setQuestions(
      questions.map(q => {
        if (q.id === qId) {
          if (q.options.length <= 2) {
            showToast('A question must have at least two options.', 'error');
            return q;
          }
          const nextOpts = [...q.options];
          nextOpts.splice(index, 1);
          return { ...q, options: nextOpts };
        }
        return q;
      })
    );
  };

  const handleOptionTextChange = (qId: string, index: number, text: string) => {
    setQuestions(
      questions.map(q => {
        if (q.id === qId) {
          const nextOpts = [...q.options];
          nextOpts[index] = text;
          return { ...q, options: nextOpts };
        }
        return q;
      })
    );
  };

  const handleSavePoll = async () => {
    if (saving) return;

    // Validation
    if (!title.trim()) {
      showToast('Please enter a poll title.', 'error');
      return;
    }

    if (pollType === 'staff_nomination') {
      if (nominees.length === 0) {
        showToast('Please select at least one employee nominee.', 'error');
        return;
      }
      // Validate nominees exist and belong to tenant
      const valid = await validateEmployeeNominees(nominees, tenantId);
      if (!valid) {
        showToast('Some selected nominees are invalid or do not exist.', 'error');
        return;
      }
    } else {
      // Validate opinion questions
      for (const q of questions) {
        if (!q.question.trim()) {
          showToast('Please fill out all question texts.', 'error');
          return;
        }
        const filledOptions = q.options.filter(opt => opt.trim());
        if (filledOptions.length < 2) {
          showToast('Each question must have at least two choices.', 'error');
          return;
        }
      }
    }

    setSaving(true);
    try {
      const finalQuestions = getPreparedQuestions().map(q => ({
        ...q,
        options: q.options.filter(opt => opt.trim()),
      }));

      const pollData: Omit<Poll, 'id' | 'createdAt'> = {
        title: title.trim(),
        ...(description.trim() && { description: description.trim() }),
        type: pollType,
        questions: finalQuestions,
        ...(pollType === 'staff_nomination' && { nominees }),
        isActive: true,
        allowMultipleVotes,
        showResults,
        ...(endDateStr && { endDate: new Date(endDateStr) }),
        createdBy: currentUid || 'system',
        tenantId,
      };

      let newId = '';
      if (onSave) {
        newId = await onSave(pollData);
      } else {
        newId = await createPoll(pollData);
      }

      showToast('Poll created successfully!', 'success');
      
      // Show share modal instead of immediately redirecting
      const pollUrl = `${window.location.origin}/poll/${newId}`;
      setShareModal({ open: true, url: pollUrl });
    } catch (err) {
      console.error('Failed to save poll:', err);
      showToast('Failed to save poll.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareModal.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      showToast('Could not copy to clipboard.', 'error');
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-white p-4 sm:p-6 md:p-8 rounded-xl shadow border border-gray-100 space-y-6">
      <Toast toasts={toasts} onDismiss={dismissToast} />

      {/* ── Share modal shown after successful poll creation ── */}
      {shareModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 sm:p-8 space-y-5">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-black text-gray-900">Poll Created!</h3>
              <p className="text-sm text-gray-500">Share this link with your participants so they can vote.</p>
            </div>

            <div className="flex gap-2 items-center bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
              <span className="flex-1 text-xs text-gray-700 truncate select-all font-mono">{shareModal.url}</span>
              <button
                onClick={handleCopyLink}
                className="shrink-0 flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors bg-purple-600 text-white hover:bg-purple-700"
              >
                {copied ? (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Copied!
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Copy Link
                  </>
                )}
              </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <a
                href={shareModal.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 inline-flex justify-center items-center gap-1.5 py-2 border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Preview Poll
              </a>
              <button
                onClick={() => { setShareModal({ open: false, url: '' }); router.push('/dashboard/feedback/polls'); }}
                className="flex-1 inline-flex justify-center items-center py-2 rounded-lg text-sm font-semibold text-white transition-colors"
                style={{ backgroundColor: 'var(--brand, #7c3aed)' }}
              >
                Go to Polls List
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Progress header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b pb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Create New Poll</h2>
          <p className="text-xs text-gray-500 mt-0.5">Set up an opinion question or Staff of the Month nomination.</p>
        </div>
        <div className="flex gap-1.5 text-xs font-semibold shrink-0">
          <span className={`px-2.5 py-1 rounded-full ${step === 'basics' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-400'}`}>1. Details</span>
          <span className={`px-2.5 py-1 rounded-full ${step === 'questions' || step === 'nominees' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-400'}`}>
            {pollType === 'staff_nomination' ? '2. Nominees' : '2. Questions'}
          </span>
        </div>
      </div>

      {/* STEP 1: BASICS */}
      {step === 'basics' && (
        <div className="space-y-5">
          <Input
            label="Poll Title"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g., Staff of the Month - September"
            required
          />

          <RichTextEditor
            label="Description"
            value={description}
            onChange={val => setDescription(val || '')}
            placeholder="Provide any instructions or context for voters..."
            maxLength={500}
            compact
          />
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Poll Type</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
              <label className={`flex flex-col p-4 border rounded-xl cursor-pointer hover:bg-purple-50 transition-colors ${pollType === 'opinion' ? 'border-purple-600 bg-purple-50/50 ring-1 ring-purple-600' : 'border-gray-200'}`}>
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={pollType === 'opinion'}
                    onChange={() => setPollType('opinion')}
                    className="text-purple-600 focus:ring-purple-500 h-4 w-4 shrink-0"
                  />
                  <span className="font-bold text-sm text-gray-900">Opinion Poll</span>
                </div>
                <span className="text-xs text-gray-500 mt-2">Custom questions & multiple choice options (WhatsApp/Twitter style).</span>
              </label>

              <label className={`flex flex-col p-4 border rounded-xl cursor-pointer hover:bg-purple-50 transition-colors ${pollType === 'staff_nomination' ? 'border-purple-600 bg-purple-50/50 ring-1 ring-purple-600' : 'border-gray-200'}`}>
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={pollType === 'staff_nomination'}
                    onChange={() => setPollType('staff_nomination')}
                    className="text-purple-600 focus:ring-purple-500 h-4 w-4 shrink-0"
                  />
                  <span className="font-bold text-sm text-gray-900">Staff Nomination</span>
                </div>
                <span className="text-xs text-gray-500 mt-2">Vote for registered employees as Staff of the Month.</span>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t pt-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Show Results to Voters</label>
              <select
                value={showResults}
                onChange={e => setShowResults(e.target.value as any)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-600 focus:outline-none text-sm"
              >
                <option value="after_voting">After Voting</option>
                <option value="always">Always Visible</option>
                <option value="never">Never (Only Admins)</option>
              </select>
            </div>
            
            <Input
              label="End Date (Optional)"
              type="datetime-local"
              value={endDateStr}
              onChange={e => setEndDateStr(e.target.value)}
            />
          </div>

          <div className="flex justify-between items-center py-2">
            <div className="min-w-0 flex-1 mr-3">
              <p className="text-sm font-medium text-gray-900">Allow Multiple Choices</p>
              <p className="text-xs text-gray-500 mt-0.5">Voters can select more than one option.</p>
            </div>
            <button
              onClick={() => setAllowMultipleVotes(!allowMultipleVotes)}
              type="button"
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${allowMultipleVotes ? 'bg-purple-600' : 'bg-gray-200'}`}
            >
              <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${allowMultipleVotes ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>

          <div className="flex justify-end pt-4 border-t">
            <Button onClick={handleNextStep} fullWidth={false}>Next Step</Button>
          </div>
        </div>
      )}

      {/* STEP 2: QUESTIONS (For Opinion Polls) */}
      {step === 'questions' && (
        <div className="space-y-6">
          <div className="space-y-6 divide-y divide-gray-100">
            {questions.map((q, qIndex) => (
              <div key={q.id} className={`${qIndex > 0 ? 'pt-6' : ''} space-y-4`}>
                <div className="flex justify-between items-start">
                  <h4 className="font-semibold text-gray-800 text-sm">Question {qIndex + 1}</h4>
                  {questions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveQuestion(q.id)}
                      className="text-red-400 hover:text-red-600 transition-colors p-1.5 rounded-lg hover:bg-red-50"
                      title="Remove question"
                    >
                      <TrashIcon />
                    </button>
                  )}
                </div>

                <Input
                  label="Question Text"
                  value={q.question}
                  onChange={e => handleQuestionTextChange(q.id, e.target.value)}
                  placeholder="e.g., Which service improvements should we prioritize?"
                  required
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Question Type</label>
                    <select
                      value={q.type}
                      onChange={e => handleQuestionTypeChange(q.id, e.target.value as any)}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-600 focus:outline-none text-sm"
                    >
                      <option value="single_choice">Single Choice (Radio buttons)</option>
                      <option value="multiple_choice">Multiple Choice (Checkboxes)</option>
                    </select>
                  </div>
                  
                  <div className="flex items-center sm:items-end pb-2 pt-1 sm:pt-0">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={q.required}
                        onChange={e => setQuestions(questions.map(item => item.id === q.id ? { ...item, required: e.target.checked } : item))}
                        className="rounded text-purple-600 focus:ring-purple-500 h-4 w-4 border-gray-300"
                      />
                      <span className="text-sm font-semibold text-gray-700">Required question</span>
                    </label>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">Options</label>
                  {q.options.map((opt, oIndex) => (
                    <div key={oIndex} className="flex gap-2 items-center">
                      <div className="flex-1 min-w-0">
                        <Input
                          placeholder={`Option ${oIndex + 1}`}
                          value={opt}
                          onChange={e => handleOptionTextChange(q.id, oIndex, e.target.value)}
                        />
                      </div>
                      {q.options.length > 2 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveOption(q.id, oIndex)}
                          className="text-red-400 hover:text-red-600 transition-colors p-2 shrink-0 rounded-lg hover:bg-red-50"
                          title="Remove option"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => handleAddOption(q.id)}
                    className="text-xs font-semibold text-purple-600 hover:text-purple-800 flex items-center gap-1 pt-1"
                  >
                    + Add option choice
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={handleAddQuestion}
            className="w-full py-2.5 border-2 border-dashed border-purple-200 text-purple-600 hover:border-purple-400 hover:text-purple-700 text-sm font-bold rounded-lg transition-colors"
          >
            + Add Another Question
          </button>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-3 pt-4 border-t">
            <Button variant="secondary" onClick={handlePrevStep} fullWidth={false}>Back</Button>
            <Button onClick={handleSavePoll} disabled={saving} isLoading={saving} loadingText="Saving..." fullWidth={false}>
              Create Poll
            </Button>
          </div>
        </div>
      )}

      {/* STEP 2: NOMINEES (For Staff Nominations) */}
      {step === 'nominees' && (
        <div className="space-y-6">
          <EmployeeSelector
            selectedEmployees={nominees}
            onSelectionChange={setNominees}
            tenantId={tenantId}
          />

          <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-3 pt-4 border-t">
            <Button variant="secondary" onClick={handlePrevStep} fullWidth={false}>Back</Button>
            <Button onClick={handleSavePoll} disabled={saving || nominees.length === 0} isLoading={saving} loadingText="Saving..." fullWidth={false}>
              Create Nomination Poll
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
