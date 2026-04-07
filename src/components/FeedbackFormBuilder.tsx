'use client';

import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { QRCodeSVG } from 'qrcode.react';
import Input from './Input';
import Button from './Button';
import Toast from './Toast';
import { useToast } from '../hooks/useToast';
import type { FeedbackForm, FeedbackQuestion, CustomTagRule } from '../types';

interface FeedbackFormBuilderProps {
  onSave: (form: FeedbackForm) => Promise<void>;
}

const QuestionTypeInfo = {
  rating: {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
      </svg>
    ),
    label: 'Rating',
    description: 'Collect ratings from 1-5 stars',
    placeholder: 'e.g., How would you rate your overall experience?'
  },
  text: {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
    label: 'Text Response',
    description: 'Collect detailed written feedback',
    placeholder: 'e.g., What could we improve?'
  },
  multiChoice: {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
    label: 'Multiple Choice',
    description: 'Let users choose from predefined options',
    placeholder: 'e.g., Which amenities did you use during your stay?'
  }
};

const FeedbackFormBuilder: React.FC<FeedbackFormBuilderProps> = ({ onSave }) => {
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [questions, setQuestions] = useState<FeedbackQuestion[]>([]);
  const [showQR, setShowQR] = useState(false);
  const [formUrl, setFormUrl] = useState('');
  const [currentStep, setCurrentStep] = useState<'basics' | 'questions' | 'tags' | 'preview'>('basics');
  const [previewMode, setPreviewMode] = useState(false);
  const [customTagRules, setCustomTagRules] = useState<CustomTagRule[]>([]);
  const { toasts, showToast, dismissToast } = useToast();

  const locations = [
    'Qaras Hotels: House 3',
    'Qaras Hotels: Bluxton'
  ];

  const addQuestion = (type: FeedbackQuestion['type']) => {
    const newQuestion: FeedbackQuestion = {
      id: uuidv4(),
      type,
      question: '',
      required: true,
      ...(type === 'multiChoice' ? { options: [''] } : {})
    };
    setQuestions([...questions, newQuestion]);
  };

  const updateQuestion = (id: string, updates: Partial<FeedbackQuestion>) => {
    setQuestions(questions.map(q => 
      q.id === id ? { ...q, ...updates } : q
    ));
  };

  const removeQuestion = (id: string) => {
    setQuestions(questions.filter(q => q.id !== id));
  };

  const moveQuestion = (id: string, direction: 'up' | 'down') => {
    const index = questions.findIndex(q => q.id === id);
    if (
      (direction === 'up' && index === 0) || 
      (direction === 'down' && index === questions.length - 1)
    ) return;

    const newQuestions = [...questions];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    [newQuestions[index], newQuestions[newIndex]] = [newQuestions[newIndex], newQuestions[index]];
    setQuestions(newQuestions);
  };

  const addOption = (questionId: string) => {
    setQuestions(questions.map(q =>
      q.id === questionId ? {
        ...q,
        options: [...(q.options || []), '']
      } : q
    ));
  };

  const updateOption = (questionId: string, index: number, value: string) => {
    setQuestions(questions.map(q =>
      q.id === questionId ? {
        ...q,
        options: q.options?.map((opt, i) => i === index ? value : opt)
      } : q
    ));
  };

  const removeOption = (questionId: string, index: number) => {
    setQuestions(questions.map(q =>
      q.id === questionId ? {
        ...q,
        options: q.options?.filter((_, i) => i !== index)
      } : q
    ));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !location || questions.length === 0) return;

    const form: FeedbackForm = {
      id: uuidv4(),
      title,
      location,
      questions,
      createdAt: new Date(),
      isActive: true,
      customTagRules: customTagRules.length > 0 ? customTagRules : undefined,
    };

    try {
      try {
        await onSave(form);
        const formUrl = `${window.location.origin}/feedback/${form.id}`;
        setFormUrl(formUrl);
        showToast('Form created successfully!', 'success');
        setShowQR(true);
      } catch (error) {
        console.error('Error saving form:', error);
        showToast('Failed to create form. Please try again.', 'error');
        throw error;
      }
    } catch (error) {
      console.error('Error saving form:', error);
    }
  };

  const renderQuestionPreview = (question: FeedbackQuestion) => {
    return (
      <div className="mb-6 p-4 bg-white rounded-lg shadow">
        <h3 className="text-lg font-medium mb-2">
          {question.question}
          {question.required && <span className="text-red-500 ml-1">*</span>}
        </h3>

        {question.type === 'rating' && (
          <div className="flex gap-3 flex-wrap">
            {[1, 2, 3, 4, 5].map((rating) => (
              <button
                key={rating}
                type="button"
                className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-lg font-medium"
                disabled
              >
                {rating}
              </button>
            ))}
          </div>
        )}

        {question.type === 'text' && (
          <Input
            placeholder="User's response will appear here"
            disabled
          />
        )}

        {question.type === 'multiChoice' && question.options && (
          <div className="space-y-2">
            {question.options.map((option, index) => (
              <label key={index} className="flex items-center space-x-2">
                <input
                  type={question.multiSelect ? 'checkbox' : 'radio'}
                  name={question.id}
                  disabled
                  className="h-4 w-4 text-purple-600"
                />
                <span className="text-gray-700">
                  {option === '__others__' ? 'Others (Please Specify)' : option}
                </span>
              </label>
            ))}
            {question.multiSelect && question.minSelections && (
              <p className="text-xs text-gray-400 mt-1">Select at least {question.minSelections}</p>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderBasicsStep = () => (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Form Details</h2>
        <div className="space-y-4">
          <Input
            label="Form Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Guest Satisfaction Survey"
            required
          />
          <Input
            label="Location"
            as="select"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            required
          >
            <option value="">Select Location</option>
            {locations.map(loc => (
              <option key={loc} value={loc}>{loc}</option>
            ))}
          </Input>
        </div>
      </div>
      <div className="flex justify-end">
        <Button
          onClick={() => setCurrentStep('questions')}
          disabled={!title || !location}
        >
          Next: Add Questions →
        </Button>
      </div>
    </div>
  );

  const renderQuestionsStep = () => (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">Questions</h2>
          <div className="flex items-center space-x-2">
            <Button onClick={() => setPreviewMode(!previewMode)}>
              {previewMode ? 'Edit Mode' : 'Preview Mode'}
            </Button>
          </div>
        </div>

        {!previewMode && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {Object.entries(QuestionTypeInfo).map(([type, info]) => (
              <button
                key={type}
                onClick={() => addQuestion(type as FeedbackQuestion['type'])}
                className="p-4 border-2 border-gray-200 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-colors text-left"
              >
                <div className="text-purple-600 mb-2">{info.icon}</div>
                <h3 className="font-medium">{info.label}</h3>
                <p className="text-sm text-gray-600">{info.description}</p>
              </button>
            ))}
          </div>
        )}

        {previewMode ? (
          <div className="space-y-6">
            {questions.map(question => renderQuestionPreview(question))}
          </div>
        ) : (
          <div className="space-y-4">
            {questions.map((question, index) => (
              <div key={question.id} className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <span className="text-purple-600">{QuestionTypeInfo[question.type].icon}</span>
                    <span className="font-medium">{QuestionTypeInfo[question.type].label}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => moveQuestion(question.id, 'up')}
                      disabled={index === 0}
                      className="p-1 hover:bg-gray-200 rounded"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => moveQuestion(question.id, 'down')}
                      disabled={index === questions.length - 1}
                      className="p-1 hover:bg-gray-200 rounded"
                    >
                      ↓
                    </button>
                    <Button
                      onClick={() => removeQuestion(question.id)}
                    >
                      Remove
                    </Button>
                  </div>
                </div>

                <div className="space-y-4">
                  <Input
                    value={question.question}
                    onChange={(e) => updateQuestion(question.id, { question: e.target.value })}
                    placeholder={QuestionTypeInfo[question.type].placeholder}
                    required
                  />

                  {question.type === 'multiChoice' && (
                    <div className="space-y-2 ml-4">
                      {/* Single / Multiple answer toggle */}
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-sm text-gray-600">Answer type:</span>
                        <button
                          type="button"
                          onClick={() => updateQuestion(question.id, { multiSelect: false, minSelections: undefined })}
                          className={`px-3 py-1 text-xs rounded-full font-medium border transition-colors ${
                            !question.multiSelect
                              ? 'bg-purple-600 text-white border-purple-600'
                              : 'bg-white text-gray-600 border-gray-300 hover:border-purple-400'
                          }`}
                        >
                          Single answer
                        </button>
                        <button
                          type="button"
                          onClick={() => updateQuestion(question.id, { multiSelect: true, minSelections: 1 })}
                          className={`px-3 py-1 text-xs rounded-full font-medium border transition-colors ${
                            question.multiSelect
                              ? 'bg-purple-600 text-white border-purple-600'
                              : 'bg-white text-gray-600 border-gray-300 hover:border-purple-400'
                          }`}
                        >
                          Multiple answers
                        </button>
                      </div>

                      {/* Min selections input */}
                      {question.multiSelect && (
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-sm text-gray-600">Min selections required:</span>
                          <input
                            type="number"
                            min={1}
                            max={question.options?.filter(o => o !== '__others__').length || 1}
                            value={question.minSelections ?? 1}
                            onChange={e => updateQuestion(question.id, { minSelections: Math.max(1, parseInt(e.target.value) || 1) })}
                            className="w-16 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                          />
                        </div>
                      )}

                      {question.options?.map((option, optIndex) => (
                        <div key={optIndex} className="flex items-center space-x-2">
                          <span className="text-gray-400 text-xs">{question.multiSelect ? '☐' : '○'}</span>
                          {option === '__others__' ? (
                            <span className="text-sm text-gray-500 italic px-2 py-1 bg-gray-100 rounded">
                              Others (Please Specify) — text input shown to guest
                            </span>
                          ) : (
                            <Input
                              value={option}
                              onChange={(e) => updateOption(question.id, optIndex, e.target.value)}
                              placeholder={`Option ${optIndex + 1}`}
                              required
                            />
                          )}
                          <Button onClick={() => removeOption(question.id, optIndex)}>Remove</Button>
                        </div>
                      ))}
                      <div className="flex items-center space-x-2 ml-4">
                        <Button onClick={() => addOption(question.id)}>Add Option</Button>
                        {!question.options?.includes('__others__') && (
                          <Button
                            onClick={() =>
                              updateQuestion(question.id, {
                                options: [...(question.options || []), '__others__'],
                              })
                            }
                          >
                            + Others (Please Specify)
                          </Button>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center space-x-2 mt-2">
                    <input
                      type="checkbox"
                      checked={question.required}
                      onChange={(e) => updateQuestion(question.id, { required: e.target.checked })}
                      className="h-4 w-4 text-purple-600"
                    />
                    <span className="text-sm text-gray-600">Required question</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-between gap-8">
        <Button onClick={() => setCurrentStep('basics')}>
          ← Back to Details
        </Button>
        <Button
          onClick={() => setCurrentStep('tags')}
          disabled={questions.length === 0}
        >
          Next: Logic Tags →
        </Button>
      </div>
    </div>
  );

  if (showQR) {
    const handleDownloadQR = () => {
      const svg = document.querySelector('#qr-code-svg svg') as SVGElement;
      if (!svg) return;
      const svgData = new XMLSerializer().serializeToString(svg);
      const canvas = document.createElement('canvas');
      canvas.width = 400;
      canvas.height = 400;
      const ctx = canvas.getContext('2d');
      const img = new Image();
      img.onload = () => {
        ctx?.drawImage(img, 0, 0, 400, 400);
        const a = document.createElement('a');
        a.download = 'feedback-form-qr.png';
        a.href = canvas.toDataURL('image/png');
        a.click();
      };
      img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
    };

    const handleDownloadLink = () => {
      const blob = new Blob([formUrl], { type: 'text/plain' });
      const a = document.createElement('a');
      a.download = 'feedback-form-link.txt';
      a.href = URL.createObjectURL(blob);
      a.click();
      URL.revokeObjectURL(a.href);
    };

    const handleCopyLink = () => {
      navigator.clipboard.writeText(formUrl);
      showToast('Link copied to clipboard!', 'success');
    };

    return (
      <div className="bg-white p-6 rounded-lg shadow text-center">
        <Toast toasts={toasts} onDismiss={dismissToast} />
        <h2 className="text-2xl font-bold mb-2">Form Created Successfully!</h2>
        <p className="text-gray-600 mb-6">Share this QR code or link with your customers</p>
        <div className="flex flex-col items-center space-y-4 mb-6" id="qr-code-svg">
          <QRCodeSVG value={formUrl} size={200} />
          <p className="text-sm text-gray-600 break-all">{formUrl}</p>
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-6">
          <button
            onClick={handleDownloadQR}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-md hover:bg-purple-700"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download QR Code (PNG)
          </button>
          <button
            onClick={handleDownloadLink}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-200"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Download Link (TXT)
          </button>
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-200"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Copy Link
          </button>
        </div>
        <Button onClick={() => window.location.reload()}>
          Create Another Form
        </Button>
      </div>
    );
  }

  const renderTagsStep = () => {
    const colorOptions: CustomTagRule['color'][] = ['green', 'yellow', 'red', 'blue', 'gray'];
    const operatorOptions: CustomTagRule['condition']['operator'][] = ['contains', 'equals', 'less_than', 'greater_than'];
    const operatorLabels: Record<string, string> = {
      contains: 'contains text',
      equals: 'equals',
      less_than: 'is less than',
      greater_than: 'is greater than',
    };

    const addRule = () => {
      if (questions.length === 0) return;
      setCustomTagRules(prev => [...prev, {
        id: uuidv4(),
        label: '',
        color: 'blue',
        condition: { questionId: questions[0].id, operator: 'contains', value: '' },
      }]);
    };

    const updateRule = (id: string, updates: Partial<CustomTagRule>) => {
      setCustomTagRules(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
    };

    const updateCondition = (id: string, updates: Partial<CustomTagRule['condition']>) => {
      setCustomTagRules(prev => prev.map(r =>
        r.id === id ? { ...r, condition: { ...r.condition, ...updates } } : r
      ));
    };

    const removeRule = (id: string) => {
      setCustomTagRules(prev => prev.filter(r => r.id !== id));
    };

    return (
      <div className="space-y-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-xl font-semibold">Logic Tags</h2>
              <p className="text-sm text-gray-500 mt-1">Define custom tags that auto-apply to responses based on conditions.</p>
            </div>
            <Button onClick={addRule} disabled={questions.length === 0}>+ Add Tag Rule</Button>
          </div>

          {customTagRules.length === 0 ? (
            <p className="text-sm text-gray-400 italic">No custom tag rules yet. Click "Add Tag Rule" to create one.</p>
          ) : (
            <div className="space-y-4">
              {customTagRules.map(rule => (
                <div key={rule.id} className="bg-gray-50 p-4 rounded-lg space-y-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex-1 min-w-[140px]">
                      <label className="text-xs text-gray-500 mb-1 block">Tag Label</label>
                      <input
                        type="text"
                        value={rule.label}
                        onChange={e => updateRule(rule.id, { label: e.target.value })}
                        placeholder="e.g. Needs Follow-up"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Colour</label>
                      <select
                        value={rule.color}
                        onChange={e => updateRule(rule.id, { color: e.target.value as CustomTagRule['color'] })}
                        className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                      >
                        {colorOptions.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <button onClick={() => removeRule(rule.id)} className="text-red-500 hover:text-red-700 text-sm mt-4">Remove</button>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex-1 min-w-[160px]">
                      <label className="text-xs text-gray-500 mb-1 block">If question</label>
                      <select
                        value={rule.condition.questionId}
                        onChange={e => updateCondition(rule.id, { questionId: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                      >
                        {questions.map(q => (
                          <option key={q.id} value={q.id}>{q.question || `Question (${q.type})`}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Operator</label>
                      <select
                        value={rule.condition.operator}
                        onChange={e => updateCondition(rule.id, { operator: e.target.value as CustomTagRule['condition']['operator'] })}
                        className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                      >
                        {operatorOptions.map(op => <option key={op} value={op}>{operatorLabels[op]}</option>)}
                      </select>
                    </div>
                    <div className="flex-1 min-w-[120px]">
                      <label className="text-xs text-gray-500 mb-1 block">Value</label>
                      <input
                        type="text"
                        value={rule.condition.value}
                        onChange={e => updateCondition(rule.id, { value: e.target.value })}
                        placeholder="e.g. dirty or 3"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-between gap-8">
          <Button onClick={() => setCurrentStep('questions')}>← Back to Questions</Button>
          <Button onClick={handleSubmit}>Create Form</Button>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto">
      <Toast toasts={toasts} onDismiss={dismissToast} />
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Create Feedback Form</h1>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className={`h-3 w-3 rounded-full ${currentStep === 'basics' ? 'bg-purple-600' : 'bg-gray-300'}`} />
              <div className={`h-3 w-3 rounded-full ${currentStep === 'questions' ? 'bg-purple-600' : 'bg-gray-300'}`} />
              <div className={`h-3 w-3 rounded-full ${currentStep === 'tags' ? 'bg-purple-600' : 'bg-gray-300'}`} />
            </div>
          </div>
        </div>
      </div>

      {currentStep === 'basics' && renderBasicsStep()}
      {currentStep === 'questions' && renderQuestionsStep()}
      {currentStep === 'tags' && renderTagsStep()}
    </div>
  );
};

export default FeedbackFormBuilder;
