'use client';

import React, { useState } from 'react';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import Button from './Button';
import type { Poll } from '../types';

interface PollFormProps {
  poll: Poll;
}

export default function PollForm({ poll }: PollFormProps) {
  const [selectedOption, setSelectedOption] = useState<string>('');
  const [respondent, setRespondent] = useState<string>('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedOption) {
      setError('Please select an option');
      return;
    }
    
    try {
      setSubmitting(true);
      setError(null);
      
      await addDoc(collection(db, 'poll-responses'), {
        pollId: poll.id,
        selectedOption,
        respondent: respondent.trim() || 'Anonymous',
        location: poll.location,
        submittedAt: new Date()
      });
      
      setSubmitted(true);
    } catch (error: any) {
      console.error('Error submitting response:', error);
      setError(`Failed to submit: ${error.message || 'Unknown error'}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 flex flex-col items-center">
        <div className="max-w-md w-full bg-white shadow-md rounded-lg p-8 text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
            <svg className="h-6 w-6 text-green-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">Thank You!</h2>
          <p className="text-gray-600 mb-6">Your response has been submitted successfully.</p>
          <p className="text-sm text-gray-500 mb-6">You selected: <span className="font-medium">{selectedOption}</span></p>
          
          <div className="mt-4">
            <a 
              href={`/polls/${poll.id}/results`}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
            >
              View Poll Results
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl w-full mx-auto">
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
          <div className="bg-purple-600 px-6 py-4">
            <h1 className="text-xl font-bold text-white">{poll.title}</h1>
            <p className="text-purple-100 mt-1">{poll.question}</p>
          </div>
          
          <form onSubmit={handleSubmit} className="p-6">
            {poll.description && (
              <div className="mb-6 text-gray-600">{poll.description}</div>
            )}
            
            <div className="mb-6">
              <fieldset>
                <div className="space-y-4">
                  {poll.options.map((option, index) => (
                    <div key={index} className="flex items-center">
                      <input
                        id={`option-${index}`}
                        name="poll-option"
                        type="radio"
                        value={option}
                        checked={selectedOption === option}
                        onChange={() => setSelectedOption(option)}
                        className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300"
                        required
                      />
                      <label htmlFor={`option-${index}`} className="ml-3 block text-sm font-medium text-gray-700">
                        {option}
                      </label>
                    </div>
                  ))}
                </div>
              </fieldset>
            </div>
            
            <div className="mb-6">
              <label htmlFor="respondent" className="block text-sm font-medium text-gray-700 mb-1">
                Your Name (Optional)
              </label>
              <input
                type="text"
                id="respondent"
                value={respondent}
                onChange={(e) => setRespondent(e.target.value)}
                className="shadow-sm focus:ring-purple-500 focus:border-purple-500 block w-full sm:text-sm border-gray-300 rounded-md"
                placeholder="Anonymous"
              />
            </div>
            
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
                disabled={submitting || submitted}
                className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 ${
                  (submitting || submitted) ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {submitting ? 'Submitting...' : submitted ? 'Submitted' : 'Submit Vote'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Thank you message */}
      {submitted && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-10">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
                <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="mt-3 text-lg font-medium text-gray-900">Thank you for your vote!</h3>
              <p className="mt-2 text-sm text-gray-500">
                Your vote has been recorded. We appreciate your participation.
              </p>
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => window.location.href = '/'}
                  className="inline-flex justify-center px-4 py-2 text-sm font-medium text-purple-700 bg-purple-100 border border-transparent rounded-md hover:bg-purple-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-purple-500"
                >
                  Return Home
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 