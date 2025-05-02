'use client';

import React, { useState } from 'react';
import { addDoc, collection } from 'firebase/firestore';
import { db } from '../lib/firebase';
import Input from './Input';
import Button from './Button';
import type { FeedbackForm, FeedbackQuestion, FeedbackResponse } from '../types';

interface FeedbackFormProps {
  form: FeedbackForm;
}

const FeedbackForm: React.FC<FeedbackFormProps> = ({ form }) => {
  const [responses, setResponses] = useState<{ [key: string]: string | number | string[] }>({});
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInputChange = (questionId: string, value: string | number | string[]) => {
    setResponses(prev => ({
      ...prev,
      [questionId]: value
    }));
  };

  const handleMultiSelectChange = (questionId: string, option: string, checked: boolean) => {
    setResponses(prev => {
      const currentSelections = Array.isArray(prev[questionId]) ? prev[questionId] as string[] : [];
      
      if (checked) {
        return {
          ...prev,
          [questionId]: [...currentSelections, option]
        };
      } else {
        return {
          ...prev,
          [questionId]: currentSelections.filter(item => item !== option)
        };
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate required fields
    const missingRequired = form.questions
      .filter(q => q.required)
      .some(q => {
        if (Array.isArray(responses[q.id])) {
          return (responses[q.id] as string[]).length === 0;
        }
        return !responses[q.id];
      });

    if (missingRequired) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      // Convert array responses to comma-separated strings for storage
      const processedResponses = Object.fromEntries(
        Object.entries(responses).map(([key, value]) => {
          if (Array.isArray(value)) {
            return [key, value.join(', ')];
          }
          return [key, value];
        })
      );

      const feedbackResponse: FeedbackResponse = {
        id: crypto.randomUUID(),
        formId: form.id,
        location: form.location,
        responses: processedResponses,
        submittedAt: new Date()
      };

      await addDoc(collection(db, 'feedback-responses'), feedbackResponse);
      setSubmitted(true);
    } catch (error) {
      console.error('Error submitting feedback:', error);
      setError('Failed to submit feedback. Please try again.');
    }
  };

  if (submitted) {
    return (
      <div className="text-center py-8">
        <h2 className="text-2xl font-bold text-green-600 mb-4">Thank You!</h2>
        <p className="text-gray-600">Your feedback has been submitted successfully.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
        <h1 className="text-3xl font-bold mb-2">{form.title}</h1>
        <div className="flex items-center text-gray-600 mb-6">
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span>{form.location}</span>
        </div>
        <p className="text-gray-600 text-sm">
          Your feedback helps us improve our services. All responses are anonymous.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {form.questions.map((question, index) => (
          <div key={question.id} className="bg-white rounded-lg shadow-lg p-6">
            {question.type === 'label' ? (
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-gray-700">{question.question}</p>
              </div>
            ) : (
              <div className="flex items-start">
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
                      <div className="flex space-x-4">
                        {[1, 2, 3, 4, 5].map((rating) => (
                          <button
                            key={rating}
                            type="button"
                            onClick={() => handleInputChange(question.id, rating)}
                            className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-medium transition-all transform hover:scale-110
                              ${responses[question.id] === rating
                                ? 'bg-purple-600 text-white shadow-lg'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                              }`}
                          >
                            {rating}
                          </button>
                        ))}
                      </div>
                      <div className="flex justify-between text-sm text-gray-500 mt-2 px-2">
                        <span>Poor</span>
                        <span>Excellent</span>
                      </div>
                    </div>
                  )}

                  {question.type === 'text' && (
                    <div className="mt-4">
                      <Input
                        as="textarea"
                        value={responses[question.id] as string || ''}
                        onChange={(e) => handleInputChange(question.id, e.target.value)}
                        placeholder="Share your thoughts here..."
                        required={question.required}
                      />
                    </div>
                  )}

                  {question.type === 'multiChoice' && question.options && (
                    <div className="mt-4 space-y-3">
                      {question.options.map((option, optIndex) => (
                        <label
                          key={optIndex}
                          className={`flex items-center p-3 rounded-lg border-2 transition-all cursor-pointer ${
                            question.multipleSelect
                              ? (Array.isArray(responses[question.id]) && 
                                 (responses[question.id] as string[])?.includes(option))
                                ? 'border-purple-500 bg-purple-50'
                                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                              : responses[question.id] === option
                                ? 'border-purple-500 bg-purple-50'
                                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          {question.multipleSelect ? (
                            <input
                              type="checkbox"
                              name={`${question.id}[]`}
                              value={option}
                              checked={Array.isArray(responses[question.id]) && 
                                      (responses[question.id] as string[])?.includes(option)}
                              onChange={(e) => handleMultiSelectChange(question.id, option, e.target.checked)}
                              className="h-4 w-4 text-purple-600 focus:ring-purple-500"
                              required={question.required && 
                                      (!Array.isArray(responses[question.id]) || 
                                      (responses[question.id] as string[])?.length === 0)}
                            />
                          ) : (
                            <input
                              type="radio"
                              name={question.id}
                              value={option}
                              checked={responses[question.id] === option}
                              onChange={(e) => handleInputChange(question.id, e.target.value)}
                              className="h-4 w-4 text-purple-600 focus:ring-purple-500"
                              required={question.required}
                            />
                          )}
                          <span className="ml-3 text-gray-700">{option}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}

        {error && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <Button type="submit" className="px-8">
            Submit Feedback
          </Button>
        </div>
      </form>
    </div>
  );
};

export default FeedbackForm;
