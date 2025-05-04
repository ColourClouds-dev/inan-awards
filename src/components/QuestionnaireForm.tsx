'use client';

import React, { useState } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import Button from './Button';
import type { Questionnaire, QuestionnaireQuestion, QuestionnaireResponse } from '../types';
import { useRouter } from 'next/router';

interface QuestionnaireFormProps {
  questionnaire: Questionnaire;
}

export default function QuestionnaireForm({ questionnaire }: QuestionnaireFormProps) {
  const [respondentName, setRespondentName] = useState('');
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleInputChange = (questionId: string, value: string) => {
    setResponses(prev => ({
      ...prev,
      [questionId]: value
    }));
  };

  const handleRatingChange = (questionId: string, rating: number) => {
    setResponses(prev => ({
      ...prev,
      [questionId]: rating
    }));
  };

  const handleMultiSelectChange = (questionId: string, option: string, checked: boolean) => {
    setResponses(prev => {
      const currentValue = prev[questionId] || [];
      if (checked) {
        return {
          ...prev,
          [questionId]: [...currentValue, option]
        };
      } else {
        return {
          ...prev,
          [questionId]: currentValue.filter((item: string) => item !== option)
        };
      }
    });
  };

  const handleSingleSelectChange = (questionId: string, option: string) => {
    setResponses(prev => ({
      ...prev,
      [questionId]: option
    }));
  };

  const isRequiredQuestionsAnswered = () => {
    let allAnswered = true;
    
    questionnaire.questions.forEach(question => {
      if (question.required && question.type !== 'label') {
        const response = responses[question.id];
        if (response === undefined || 
            (Array.isArray(response) && response.length === 0) ||
            response === '') {
          allAnswered = false;
        }
      }
    });
    
    return allAnswered;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isRequiredQuestionsAnswered()) {
      setError('Please answer all required questions');
      return;
    }
    
    try {
      setSubmitting(true);
      setError(null);
      
      const formattedResponses: Record<string, any> = {};
      
      // Format responses in a structured way
      questionnaire.questions.forEach(question => {
        if (question.type !== 'label' && responses[question.id] !== undefined) {
          formattedResponses[question.id] = responses[question.id];
        }
      });
      
      const questionnaireResponse: QuestionnaireResponse = {
        id: crypto.randomUUID(),
        questionnaireId: questionnaire.id,
        respondent: respondentName.trim() || 'Anonymous',
        responses: formattedResponses,
        location: questionnaire.location,
        submittedAt: new Date()
      };
      
      await addDoc(collection(db, 'questionnaire-responses'), questionnaireResponse);
      setSubmitted(true);
      
    } catch (error: any) {
      console.error('Error submitting questionnaire response:', error);
      setError(`Failed to submit: ${error.message || 'Unknown error'}`);
    } finally {
      setSubmitting(false);
    }
  };

  const renderQuestion = (question: QuestionnaireQuestion, questionIndex: number) => {
    const questionKey = `question-${questionIndex}`;
    
    if (question.type === 'label') {
      return (
        <div key={questionKey} className="mb-6">
          <p className="text-gray-700">{question.question}</p>
        </div>
      );
    }
    
    return (
      <div key={questionKey} className="mb-6">
        <div className="mb-2 flex items-start">
          <label className="block text-sm font-medium text-gray-700">
            {question.question}
            {question.required && <span className="text-red-500 ml-1">*</span>}
          </label>
        </div>
        
        {question.type === 'rating' && (
          <div className="flex space-x-2 mt-2">
            {[1, 2, 3, 4, 5].map(rating => (
              <button
                key={rating}
                type="button"
                onClick={() => handleRatingChange(question.id, rating)}
                className={`h-10 w-10 rounded-full flex items-center justify-center ${
                  responses[question.id] === rating 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {rating}
              </button>
            ))}
          </div>
        )}
        
        {question.type === 'text' && (
          <textarea
            value={responses[question.id] || ''}
            onChange={(e) => handleInputChange(question.id, e.target.value)}
            className="mt-2 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            rows={3}
            placeholder="Your answer..."
            required={question.required}
          ></textarea>
        )}
        
        {question.type === 'multiChoice' && question.options && (
          <div className="mt-2 space-y-2">
            {question.options.map((option, optionIndex) => {
              if (question.multipleSelect) {
                return (
                  <label key={optionIndex} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={Array.isArray(responses[question.id]) && responses[question.id]?.includes(option)}
                      onChange={(e) => handleMultiSelectChange(question.id, option, e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-gray-700">{option}</span>
                  </label>
                );
              } else {
                return (
                  <label key={optionIndex} className="flex items-center">
                    <input
                      type="radio"
                      name={`question-${question.id}`}
                      value={option}
                      checked={responses[question.id] === option}
                      onChange={() => handleSingleSelectChange(question.id, option)}
                      className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-gray-700">{option}</span>
                  </label>
                );
              }
            })}
          </div>
        )}
      </div>
    );
  };

  if (submitted) {
    return (
      <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-10">
        <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
              <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="mt-3 text-lg font-medium text-gray-900">Thank you for your response!</h3>
            <p className="mt-2 text-sm text-gray-500">
              Your answers have been recorded. We appreciate your feedback.
            </p>
            <div className="mt-4">
              <button
                type="button"
                onClick={() => router.push('/')}
                className="inline-flex justify-center px-4 py-2 text-sm font-medium text-purple-700 bg-purple-100 border border-transparent rounded-md hover:bg-purple-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-purple-500"
              >
                Return Home
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Handle the multi-section display
  const renderContent = () => {
    if (questionnaire.isMultiSection) {
      // Group questions by section
      const sectionMap: Record<string, QuestionnaireQuestion[]> = {};
      questionnaire.questions.forEach(question => {
        if (question.sectionId) {
          if (!sectionMap[question.sectionId]) {
            sectionMap[question.sectionId] = [];
          }
          sectionMap[question.sectionId].push(question);
        }
      });

      return Object.entries(sectionMap).map(([sectionId, questions], sectionIndex) => {
        const sectionMeta = questions[0]?.sectionMetadata;
        return (
          <div key={`section-${sectionIndex}`} className="mb-8">
            {sectionMeta && (
              <>
                <h2 className="text-lg font-medium text-gray-900 mb-2">{sectionMeta.sectionTitle}</h2>
                {sectionMeta.sectionDescription && (
                  <p className="text-sm text-gray-600 mb-4">{sectionMeta.sectionDescription}</p>
                )}
              </>
            )}
            
            <div className="space-y-4">
              {questions.map((question, questionIndex) => 
                renderQuestion(question, questionIndex)
              )}
            </div>
          </div>
        );
      });
    } else {
      // Just render all questions in order
      return (
        <div className="space-y-4">
          {questionnaire.questions.map((question, index) => 
            renderQuestion(question, index)
          )}
        </div>
      );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl w-full mx-auto">
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
          <div className="bg-purple-600 px-6 py-4">
            <h1 className="text-xl font-bold text-white">{questionnaire.title}</h1>
            {questionnaire.targetAudience && (
              <p className="text-sm text-purple-100 mt-1">For: {questionnaire.targetAudience}</p>
            )}
          </div>
          
          <form onSubmit={handleSubmit} className="p-6">
            {questionnaire.description && (
              <div className="mb-6 text-gray-600">{questionnaire.description}</div>
            )}
            
            <div className="mb-6">
              <label htmlFor="respondentName" className="block text-sm font-medium text-gray-700 mb-1">
                Your Name (Optional)
              </label>
              <input
                type="text"
                id="respondentName"
                value={respondentName}
                onChange={(e) => setRespondentName(e.target.value)}
                className="shadow-sm focus:ring-purple-500 focus:border-purple-500 block w-full sm:text-sm border-gray-300 rounded-md"
                placeholder="Anonymous"
              />
            </div>

            {renderContent()}
            
            {error && (
              <div className="mt-4 bg-red-50 border-l-4 border-red-400 p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                </div>
              </div>
            )}
            
            <div className="mt-6">
              <button
                type="submit"
                disabled={submitted}
                className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 ${
                  submitted ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {submitted ? 'Submitted' : 'Submit'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
} 