'use client';

import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { QRCodeSVG } from 'qrcode.react';
import Input from './Input';
import Button from './Button';
import type { FeedbackForm, FeedbackQuestion } from '../types';

interface FeedbackFormBuilderProps {
  onSave: (form: FeedbackForm) => Promise<void>;
}

const QuestionTypeInfo = {
  rating: {
    icon: '⭐',
    label: 'Rating',
    description: 'Collect ratings from 1-5 stars',
    placeholder: 'e.g., How would you rate your overall experience?'
  },
  text: {
    icon: '📝',
    label: 'Text Response',
    description: 'Collect detailed written feedback',
    placeholder: 'e.g., What could we improve?'
  },
  multiChoice: {
    icon: '☑️',
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
  const [currentStep, setCurrentStep] = useState<'basics' | 'questions' | 'preview'>('basics');
  const [previewMode, setPreviewMode] = useState(false);

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
      isActive: true
    };

    try {
      try {
        await onSave(form);
        const formUrl = `${window.location.origin}/feedback/${form.id}`;
        setFormUrl(formUrl);
        setShowQR(true);
      } catch (error) {
        console.error('Error saving form:', error);
        throw error; // Re-throw to be handled by the dashboard
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
          <div className="flex space-x-4">
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
                  type="radio"
                  name={question.id}
                  disabled
                  className="h-4 w-4 text-purple-600"
                />
                <span className="text-gray-700">{option}</span>
              </label>
            ))}
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
                <div className="text-2xl mb-2">{info.icon}</div>
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
                    <span className="text-lg">{QuestionTypeInfo[question.type].icon}</span>
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
                      {question.options?.map((option, optIndex) => (
                        <div key={optIndex} className="flex items-center space-x-2">
                          <span className="text-gray-500">•</span>
                          <Input
                            value={option}
                            onChange={(e) => updateOption(question.id, optIndex, e.target.value)}
                            placeholder={`Option ${optIndex + 1}`}
                            required
                          />
                          <Button
                            onClick={() => removeOption(question.id, optIndex)}
                          >
                            Remove
                          </Button>
                        </div>
                      ))}
                      <Button
                        onClick={() => addOption(question.id)}
                        className="ml-4"
                      >
                        Add Option
                      </Button>
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

      <div className="flex justify-between">
        <Button onClick={() => setCurrentStep('basics')}>
          ← Back to Details
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={questions.length === 0}
        >
          Create Form
        </Button>
      </div>
    </div>
  );

  if (showQR) {
    return (
      <div className="bg-white p-6 rounded-lg shadow text-center">
        <h2 className="text-2xl font-bold mb-2">Form Created Successfully!</h2>
        <p className="text-gray-600 mb-6">Share this QR code or link with your customers</p>
        <div className="flex flex-col items-center space-y-4 mb-8">
          <QRCodeSVG value={formUrl} size={200} />
          <p className="text-sm text-gray-600 break-all">{formUrl}</p>
        </div>
        <Button onClick={() => window.location.reload()}>
          Create Another Form
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Create Feedback Form</h1>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className={`h-3 w-3 rounded-full ${currentStep === 'basics' ? 'bg-purple-600' : 'bg-gray-300'}`} />
              <div className={`h-3 w-3 rounded-full ${currentStep === 'questions' ? 'bg-purple-600' : 'bg-gray-300'}`} />
            </div>
          </div>
        </div>
      </div>

      {currentStep === 'basics' ? renderBasicsStep() : renderQuestionsStep()}
    </div>
  );
};

export default FeedbackFormBuilder;
