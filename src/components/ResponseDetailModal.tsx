'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toDate } from '../hooks/useFeedbackFilters';
import type { FeedbackResponse, FeedbackForm, ResponseTag, FormSection } from '../types';

interface ResponseDetailModalProps {
  response: FeedbackResponse;
  form: FeedbackForm;
  isOpen: boolean;
  onClose: () => void;
}

const tagColorClasses: Record<string, string> = {
  green:  'bg-green-100 text-green-800',
  yellow: 'bg-yellow-100 text-yellow-800',
  red:    'bg-red-100 text-red-800',
  blue:   'bg-blue-100 text-blue-800',
  gray:   'bg-gray-100 text-gray-600',
};

function TagBadge({ tag }: { tag: ResponseTag }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${tagColorClasses[tag.color] ?? 'bg-gray-100 text-gray-600'}`}>
      {tag.label}
    </span>
  );
}

const ResponseDetailModal: React.FC<ResponseDetailModalProps> = ({ response, form, isOpen, onClose }) => {
  if (!isOpen) return null;

  const submittedAt = toDate(response.submittedAt);

  // Group questions by sections
  const groupedQuestions = React.useMemo(() => {
    const sections = form.sections || [];
    const groups: Array<{ section: FormSection | null; questions: typeof form.questions }> = [];
    
    // Add sections with their questions
    sections.forEach(section => {
      const sectionQuestions = form.questions.filter(q => q.sectionId === section.id);
      if (sectionQuestions.length > 0) {
        groups.push({ section, questions: sectionQuestions });
      }
    });
    
    // Add unsectioned questions
    const unsectionedQuestions = form.questions.filter(q => !q.sectionId);
    if (unsectionedQuestions.length > 0) {
      groups.push({ section: null, questions: unsectionedQuestions });
    }
    
    return groups;
  }, [form.questions, form.sections]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0 print:hidden">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Response Details</h2>
              <p className="text-sm text-gray-500 mt-0.5">{form.title}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrint}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Print
              </button>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Scrollable Body */}
          <div className="flex-1 overflow-y-auto px-6 py-6">
            {/* Response Metadata */}
            <div className="bg-gray-50 rounded-xl p-4 mb-6 print:bg-gray-100">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                {response.respondentName && (
                  <div className="md:col-span-2 lg:col-span-3">
                    <span className="text-gray-500 font-medium">Respondent</span>
                    <p className="text-gray-900 font-semibold">{response.respondentName}</p>
                  </div>
                )}
                <div>
                  <span className="text-gray-500 font-medium">Submitted</span>
                  <p className="text-gray-900">{submittedAt.toLocaleString()}</p>
                </div>
                <div>
                  <span className="text-gray-500 font-medium">Location</span>
                  <p className="text-gray-900">{form.location}</p>
                </div>
                <div>
                  <span className="text-gray-500 font-medium">Time Spent</span>
                  <p className="text-gray-900">
                    {response.timeSpentSeconds != null
                      ? `${Math.floor(response.timeSpentSeconds / 60)}m ${response.timeSpentSeconds % 60}s`
                      : '—'}
                  </p>
                </div>
                {response.visitorCountry && (
                  <div>
                    <span className="text-gray-500 font-medium">Country</span>
                    <p className="text-gray-900">{response.visitorCountry}</p>
                  </div>
                )}
                {response.visitorCity && (
                  <div>
                    <span className="text-gray-500 font-medium">City</span>
                    <p className="text-gray-900">{response.visitorCity}</p>
                  </div>
                )}
                {response.tags && response.tags.length > 0 && (
                  <div className="md:col-span-2 lg:col-span-3">
                    <span className="text-gray-500 font-medium block mb-2">Tags</span>
                    <div className="flex flex-wrap gap-1">
                      {response.tags.map((tag, i) => (
                        <TagBadge key={i} tag={tag} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Response Content - Grouped by Sections */}
            <div className="space-y-8">
              {groupedQuestions.map((group, groupIndex) => (
                <div key={group.section?.id || 'unsectioned'} className="space-y-4">
                  {/* Section Header */}
                  {group.section && (
                    <div className="border-b border-gray-200 pb-2 mb-4 print:border-gray-400">
                      <h3 className="text-lg font-semibold text-gray-800">{group.section.name}</h3>
                      {group.section.description && (
                        <p className="text-sm text-gray-600 mt-1">{group.section.description}</p>
                      )}
                    </div>
                  )}
                  
                  {/* Questions and Responses */}
                  <div className="grid gap-4">
                    {group.questions.map((question, questionIndex) => {
                      const overallIndex = form.questions.findIndex(q => q.id === question.id);
                      const answer = response.responses[question.id];
                      const hasAnswer = answer !== undefined && answer !== '' && answer !== null;

                      return (
                        <div
                          key={question.id}
                          className={`border rounded-lg p-4 print:border-gray-400 ${
                            hasAnswer ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <span
                              className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold text-white print:bg-gray-600"
                              style={{ backgroundColor: 'var(--brand)' }}
                            >
                              {overallIndex + 1}
                            </span>
                            <div className="flex-grow">
                              <h4 className="text-sm font-medium text-gray-900 mb-2">
                                {question.question}
                                {question.required && <span className="text-red-500 ml-1">*</span>}
                              </h4>
                              {hasAnswer ? (
                                <div className="text-sm text-gray-700">
                                  {question.type === 'rating' && (
                                    <div className="flex items-center gap-1">
                                      <span className="font-medium">{answer}/5</span>
                                      <div className="flex">
                                        {[1, 2, 3, 4, 5].map(star => (
                                          <svg
                                            key={star}
                                            className={`w-4 h-4 ${
                                              star <= (answer as number) ? 'text-yellow-400' : 'text-gray-200'
                                            }`}
                                            fill="currentColor"
                                            viewBox="0 0 20 20"
                                          >
                                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                                          </svg>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  {question.type === 'text' && (
                                    <div className="whitespace-pre-wrap bg-gray-50 p-3 rounded border print:bg-gray-100">
                                      {String(answer)}
                                    </div>
                                  )}
                                  {question.type === 'multiChoice' && (
                                    <div>
                                      {Array.isArray(answer) ? (
                                        <ul className="list-disc list-inside space-y-1">
                                          {(answer as string[]).map((item, i) => (
                                            <li key={i}>
                                              {item.startsWith('__others__:') 
                                                ? `Others: ${item.replace('__others__:', '')}`
                                                : item
                                              }
                                            </li>
                                          ))}
                                        </ul>
                                      ) : (
                                        <span>
                                          {String(answer).startsWith('__others__:')
                                            ? `Others: ${String(answer).replace('__others__:', '')}`
                                            : String(answer)
                                          }
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <p className="text-sm text-gray-400 italic">No response provided</p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Technical Details */}
            {(response.visitorIp || response.visitorIsp) && (
              <div className="mt-8 pt-4 border-t border-gray-200 text-xs text-gray-400 print:hidden">
                <p>
                  {response.visitorIp && `IP: ${response.visitorIp}`}
                  {response.visitorIp && response.visitorIsp && ' • '}
                  {response.visitorIsp && `ISP: ${response.visitorIsp}`}
                </p>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default ResponseDetailModal;