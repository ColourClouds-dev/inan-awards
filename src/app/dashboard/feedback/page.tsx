'use client';

import React, { useEffect, useState } from 'react';
import { collection, query, getDocs, orderBy, doc, setDoc, where, deleteDoc } from 'firebase/firestore';
import { exportToCSV, formatFeedbackForCSV } from '../../../lib/exportToCSV';
import { QRCodeSVG } from 'qrcode.react';
import { db, retryOperation } from '../../../lib/firebase';
import FeedbackFormBuilder from '../../../components/FeedbackFormBuilder';
import Button from '../../../components/Button';
import type { FeedbackForm, FeedbackResponse } from '../../../types';
import { motion, AnimatePresence } from 'framer-motion';

export default function FeedbackDashboardPage() {
  const [forms, setForms] = useState<FeedbackForm[]>([]);
  const [responses, setResponses] = useState<FeedbackResponse[]>([]);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingForm, setEditingForm] = useState<FeedbackForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showQR, setShowQR] = useState<{ id: string; url: string } | null>(null);
  const [sortBy, setSortBy] = useState<'date' | 'location' | 'form'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [locationFilter, setLocationFilter] = useState<string>('all');
  const [formFilter, setFormFilter] = useState<string>('all');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  
  // Pagination for responses
  const [currentPage, setCurrentPage] = useState(1);
  const responsesPerPage = 5;

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch forms
        const formsQuery = query(
          collection(db, 'feedback-forms'),
          orderBy('createdAt', 'desc')
        );
        
        try {
          const formsSnapshot = await getDocs(formsQuery);
          const formsData = formsSnapshot.docs.map(doc => {
            const data = doc.data();
            return {
              ...data,
              id: doc.id,
              createdAt: data.createdAt?.toDate() || new Date()
            };
          }) as FeedbackForm[];
          setForms(formsData);
        } catch (formsError) {
          console.error('Error fetching forms:', formsError);
          setError('Failed to load feedback forms. You may be offline.');
        }

        // Fetch responses
        try {
          const responsesQuery = query(
            collection(db, 'feedback-responses'),
            orderBy('submittedAt', 'desc')
          );
          const responsesSnapshot = await getDocs(responsesQuery);
          const responsesData = responsesSnapshot.docs.map(doc => {
            const data = doc.data();
            return {
              ...data,
              id: doc.id,
              submittedAt: data.submittedAt?.toDate() || new Date()
            };
          }) as FeedbackResponse[];
          setResponses(responsesData);
        } catch (responsesError) {
          console.error('Error fetching responses:', responsesError);
          setError('Failed to load feedback responses. You may be offline.');
        }
      } catch (error) {
        console.error('Error fetching feedback data:', error);
        setError('Failed to load feedback data. Please check your internet connection.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleSaveForm = async (form: FeedbackForm) => {
    try {
      setError(null);
      
      // Check if online first
      if (!navigator.onLine) {
        setError('You are currently offline. Please connect to the internet to save forms.');
        return null;
      }
      
      // Determine if this is an edit or a new form
      const isEditing = editingForm !== null;
      
      // If editing, use the existing ID; otherwise use the new ID
      const formId = isEditing ? editingForm.id : form.id;
      const formToSave = isEditing ? { ...form, id: formId } : form;
      
      // Save with a specific ID
      const formRef = doc(collection(db, 'feedback-forms'), formId);
      
      try {
        // Use retry mechanism for better resilience with network issues
        await retryOperation(async () => {
          await setDoc(formRef, formToSave);
        }, 3, 1000);
        
        // Update forms list
        if (isEditing) {
          setForms(forms.map(f => f.id === formId ? formToSave : f));
        } else {
          setForms([formToSave, ...forms]);
        }
        
        // Reset states
        setShowBuilder(false);
        setEditingForm(null);
        
        return formId; // Return the ID on success
      } catch (firestoreError: any) {
        console.error('Firestore error saving form:', firestoreError);
        
        // Handle specific Firestore errors
        if (firestoreError.code === 'unavailable' || 
            firestoreError.code === 'deadline-exceeded' ||
            firestoreError.message?.includes('network')) {
          setError('Network error. The form could not be saved despite multiple attempts. Please check your internet connection.');
        } else {
          setError(`Failed to save form: ${firestoreError.message || 'Unknown error'}`);
        }
        return null;
      }
    } catch (error: any) {
      console.error('Error saving form:', error);
      setError(`Failed to save form: ${error.message || 'Unknown error'}`);
      return null;
    }
  };

  const handleDeleteForm = async (formId: string) => {
    try {
      await deleteDoc(doc(db, 'feedback-forms', formId));
      setForms(forms.filter(f => f.id !== formId));
      setShowDeleteConfirm(null);
    } catch (error) {
      console.error('Error deleting form:', error);
      setError('Failed to delete form');
    }
  };

  const getFormTitle = (formId: string) => {
    const form = forms.find(f => f.id === formId);
    return form?.title || 'Unknown Form';
  };

  const getQuestionText = (questionId: string, formId: string) => {
    const form = forms.find(f => f.id === formId);
    if (!form) return 'Unknown Question';
    
    const question = form.questions.find(q => q.id === questionId);
    return question?.question || 'Unknown Question';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (showBuilder) {
    return (
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">
            {editingForm ? `Edit Form: ${editingForm.title}` : 'Create Feedback Form'}
          </h1>
          <Button 
            variant="custom"
            onClick={() => {
              setShowBuilder(false);
              setEditingForm(null);
            }}
            className="text-red-500 hover:text-red-700 hover:bg-gray-100 rounded-md px-3 py-1 text-sm"
          >
            Cancel
          </Button>
        </div>
        <FeedbackFormBuilder onSave={handleSaveForm} initialForm={editingForm} />
      </div>
    );
  }

  if (showQR) {
    return (
      <div className="p-6">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md mx-auto text-center">
          <h2 className="text-2xl font-bold mb-2">Share Feedback Form</h2>
          <p className="text-gray-600 mb-6">Share this QR code or link with your customers</p>
          <div className="flex flex-col items-center space-y-4 mb-8">
            <QRCodeSVG value={showQR.url} size={200} />
            <p className="text-sm text-gray-600 break-all">{showQR.url}</p>
          </div>
          <div className="flex justify-center space-x-4">
            <Button onClick={() => navigator.clipboard.writeText(showQR.url)}>
              Copy Link
            </Button>
            <Button onClick={() => setShowQR(null)}>
              Close
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0">
        <h1 className="text-2xl font-bold">Feedback Management</h1>
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center space-x-4">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'date' | 'location' | 'form')}
              className="rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 h-10 p-2"
            >
              <option value="date">Sort by Date</option>
              <option value="location">Sort by Location</option>
              <option value="form">Sort by Form</option>
            </select>
            <button
              onClick={() => setSortOrder(order => order === 'asc' ? 'desc' : 'asc')}
              className="p-2 hover:bg-gray-100 rounded"
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </button>
            <select
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 h-10 p-2"
            >
              <option value="all">All Locations</option>
              <option value="Qaras Hotels: House 3">House 3</option>
              <option value="Qaras Hotels: Bluxton">Bluxton</option>
            </select>
            <select
              value={formFilter}
              onChange={(e) => setFormFilter(e.target.value)}
              className="rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 h-10 p-2"
            >
              <option value="all">All Forms</option>
              {forms.filter(form => form.isActive).map(form => (
                <option key={form.id} value={form.id}>{form.title}</option>
              ))}
            </select>
          </div>
          <div className="flex space-x-4">
            <Button
              className="rounded-full h-10 w-10 flex items-center justify-center text-lg bg-purple-600 hover:bg-purple-700 text-white"
              onClick={() => {
                const csvData = formatFeedbackForCSV(responses);
                exportToCSV(csvData, `feedback-responses-${new Date().toISOString().split('T')[0]}.csv`);
              }}
              title="Export feedback responses to CSV"
            >
              📊
            </Button>
            <Button 
              className="rounded-full h-10 w-10 flex items-center justify-center text-lg bg-white border border-gray-300 hover:bg-gray-100 text-gray-800"
              onClick={() => setShowBuilder(true)}
              title="Create a new feedback form"
            >
              ➕
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md mx-auto">
            <h3 className="text-lg font-medium mb-4">Confirm Deletion</h3>
            <p className="mb-6">Are you sure you want to delete this form? This action cannot be undone.</p>
            <div className="flex justify-end space-x-4">
              <Button 
                onClick={() => setShowDeleteConfirm(null)}
                variant="custom"
                className="text-red-500 hover:text-red-700 px-3 py-1 text-sm rounded-md hover:bg-gray-100"
              >
                Cancel
              </Button>
              <Button 
                onClick={() => handleDeleteForm(showDeleteConfirm)}
                className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 text-sm rounded-md"
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Active Forms</h2>
          <div className="space-y-4">
            {forms.filter(form => form.isActive).map(form => (
              <div 
                key={form.id} 
                className={`border rounded-lg p-4 hover:border-purple-500 transition-colors cursor-pointer ${
                  formFilter === form.id ? 'border-purple-500 bg-purple-50' : ''
                }`}
                onClick={() => {
                  // Reset to page 1 when changing forms
                  setCurrentPage(1);
                  
                  // Toggle filter: if already selected, show all forms again
                  setFormFilter(current => current === form.id ? 'all' : form.id);
                }}
              >
                <h3 className="font-medium">{form.title}</h3>
                <p className="text-sm text-gray-600 mb-3">{form.location}</p>
                <div className="flex items-center space-x-4">
                  <a
                    href={`/feedback/${form.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-purple-600 hover:text-purple-800 p-1.5 flex items-center justify-center rounded-full hover:bg-purple-50"
                    title="View the form as your customers would see it"
                    onClick={(e) => e.stopPropagation()} // Prevent triggering parent onClick
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </a>
                  <button
                    onClick={(e) => {
                      e.stopPropagation(); // Prevent triggering parent onClick
                      const url = `${window.location.origin}/feedback/${form.id}`;
                      setShowQR({ id: form.id, url });
                    }}
                    className="text-purple-600 hover:text-purple-800 p-1.5 flex items-center justify-center rounded-full hover:bg-purple-50"
                    title="Display QR code for sharing"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation(); // Prevent triggering parent onClick
                      setEditingForm(form);
                      setShowBuilder(true);
                    }}
                    className="text-blue-600 hover:text-blue-800 p-1.5 flex items-center justify-center rounded-full hover:bg-blue-50"
                    title="Edit this form"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation(); // Prevent triggering parent onClick
                      setShowDeleteConfirm(form.id);
                    }}
                    className="text-red-600 hover:text-red-800 p-1.5 flex items-center justify-center rounded-full hover:bg-red-50"
                    title="Delete this form permanently"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">
            {formFilter !== 'all' ? `Feedback for ${getFormTitle(formFilter)}` : 'Recent Feedback'}
            {formFilter !== 'all' && (
              <button 
                onClick={() => setFormFilter('all')}
                className="ml-2 text-sm text-purple-600 hover:text-purple-800"
              >
                (Show All)
              </button>
            )}
          </h2>
          <AnimatePresence mode="wait">
            <motion.div 
              key={formFilter} 
              className="space-y-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              {responses
                .filter(response => locationFilter === 'all' || response.location === locationFilter)
                .filter(response => formFilter === 'all' || response.formId === formFilter)
                .sort((a, b) => {
                  if (sortBy === 'date') {
                    const dateA = a.submittedAt instanceof Date ? a.submittedAt : new Date(a.submittedAt.seconds * 1000);
                    const dateB = b.submittedAt instanceof Date ? b.submittedAt : new Date(b.submittedAt.seconds * 1000);
                    return sortOrder === 'asc' ? dateA.getTime() - dateB.getTime() : dateB.getTime() - dateA.getTime();
                  } else if (sortBy === 'location') {
                    return sortOrder === 'asc'
                      ? a.location.localeCompare(b.location)
                      : b.location.localeCompare(a.location);
                  } else {
                    // Sort by form title
                    const formTitleA = getFormTitle(a.formId);
                    const formTitleB = getFormTitle(b.formId);
                    return sortOrder === 'asc'
                      ? formTitleA.localeCompare(formTitleB)
                      : formTitleB.localeCompare(formTitleA);
                  }
                })
                .slice((currentPage - 1) * responsesPerPage, currentPage * responsesPerPage)
                .map(response => (
                <motion.div 
                  key={response.id} 
                  className="border rounded-lg p-4 shadow-sm bg-white"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2 }}
                  layout
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 rounded-full bg-purple-200 flex items-center justify-center text-purple-700 font-bold text-sm">
                        {response.location.charAt(0)}
                      </div>
                      <div>
                        <h3 className="font-medium text-purple-900">{getFormTitle(response.formId)}</h3>
                        <p className="text-xs text-gray-600">{response.location}</p>
                      </div>
                    </div>
                    <span className="text-xs text-gray-700 bg-gray-100 px-2 py-1 rounded-full font-medium">
                      {(response.submittedAt instanceof Date 
                        ? response.submittedAt
                        : new Date(response.submittedAt.seconds * 1000)).toLocaleDateString()}
                    </span>
                  </div>
                  
                  <div className="bg-gray-100 rounded-2xl p-4 shadow-sm relative ml-4">
                    {/* Chat bubble pointer */}
                    <div className="absolute top-4 left-0 transform -translate-x-2 rotate-45 w-3 h-3 bg-gray-100"></div>
                    
                    <div className="space-y-4">
                      {Object.entries(response.responses).map(([questionId, answer], index) => (
                        <div key={questionId} className={`${index !== 0 ? 'border-t border-gray-200 pt-4' : ''}`}>
                          <div className="flex items-start">
                            <div className="flex-1">
                              <p className="font-medium text-sm text-gray-800 mb-1">
                                {getQuestionText(questionId, response.formId)}
                              </p>
                              <p className="text-sm text-gray-700">
                                {answer.toString()}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                </motion.div>
              ))}
              
              {/* "No responses" message when filter is active but no results */}
              {responses.filter(response => formFilter === 'all' || response.formId === formFilter).length === 0 && (
                <motion.div 
                  className="text-center py-8 text-gray-500"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  {formFilter !== 'all' ? 
                    `No feedback responses for ${getFormTitle(formFilter)} yet.` : 
                    'No feedback responses yet.'
                  }
                </motion.div>
              )}
              
              {/* Pagination Controls */}
              {(() => {
                const filteredResponses = responses
                  .filter(response => locationFilter === 'all' || response.location === locationFilter)
                  .filter(response => formFilter === 'all' || response.formId === formFilter);
                  
                const totalPages = Math.ceil(filteredResponses.length / responsesPerPage);
                
                if (totalPages <= 1) return null;
                
                return (
                  <motion.div 
                    className="flex justify-center items-center space-x-2 mt-6"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                  >
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className={`p-2 rounded ${
                        currentPage === 1 
                          ? 'text-gray-400 cursor-not-allowed' 
                          : 'text-purple-600 hover:bg-purple-50'
                      }`}
                      title="Previous page"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </button>
                    
                    <div className="text-sm">
                      Page {currentPage} of {totalPages}
                    </div>
                    
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className={`p-2 rounded ${
                        currentPage === totalPages 
                          ? 'text-gray-400 cursor-not-allowed' 
                          : 'text-purple-600 hover:bg-purple-50'
                      }`}
                      title="Next page"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </motion.div>
                );
              })()}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
