'use client';

import React, { useEffect, useState } from 'react';
import { collection, query, getDocs, orderBy, doc, setDoc, where, deleteDoc } from 'firebase/firestore';
import { exportToCSV } from '../../../lib/exportToCSV';
import { QRCodeSVG } from 'qrcode.react';
import { db, retryOperation } from '../../../lib/firebase';
import QuestionnaireBuilder from '../../../components/QuestionnaireBuilder';
import Button from '../../../components/Button';
import type { Questionnaire, QuestionnaireResponse } from '../../../types';
import { motion, AnimatePresence } from 'framer-motion';

export default function QuestionnaireDashboardPage() {
  const [questionnaires, setQuestionnaires] = useState<Questionnaire[]>([]);
  const [responses, setResponses] = useState<QuestionnaireResponse[]>([]);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingQuestionnaire, setEditingQuestionnaire] = useState<Questionnaire | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showQR, setShowQR] = useState<{ id: string; url: string } | null>(null);
  const [sortBy, setSortBy] = useState<'date' | 'location' | 'category'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [locationFilter, setLocationFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  
  // Pagination for responses
  const [currentPage, setCurrentPage] = useState(1);
  const responsesPerPage = 5;

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch questionnaires
        const questionnairesQuery = query(
          collection(db, 'questionnaires'),
          orderBy('createdAt', 'desc')
        );
        
        try {
          const questionnairesSnapshot = await getDocs(questionnairesQuery);
          const questionnairesData = questionnairesSnapshot.docs.map(doc => {
            const data = doc.data();
            return {
              ...data,
              id: doc.id,
              createdAt: data.createdAt?.toDate() || new Date()
            };
          }) as Questionnaire[];
          setQuestionnaires(questionnairesData);
        } catch (questionnairesError) {
          console.error('Error fetching questionnaires:', questionnairesError);
          setError('Failed to load questionnaires. You may be offline.');
        }

        // Fetch responses
        try {
          const responsesQuery = query(
            collection(db, 'questionnaire-responses'),
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
          }) as QuestionnaireResponse[];
          setResponses(responsesData);
        } catch (responsesError) {
          console.error('Error fetching responses:', responsesError);
          setError('Failed to load questionnaire responses. You may be offline.');
        }
      } catch (error) {
        console.error('Error fetching questionnaire data:', error);
        setError('Failed to load questionnaire data. Please check your internet connection.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleSaveQuestionnaire = async (questionnaire: Questionnaire) => {
    try {
      setError(null);
      
      // Check if online first
      if (!navigator.onLine) {
        setError('You are currently offline. Please connect to the internet to save questionnaires.');
        return null;
      }
      
      // Determine if this is an edit or a new questionnaire
      const isEditing = editingQuestionnaire !== null;
      
      // If editing, use the existing ID; otherwise use the new ID
      const questionnaireId = isEditing ? editingQuestionnaire.id : questionnaire.id;
      const questionnaireToSave = isEditing ? { ...questionnaire, id: questionnaireId } : questionnaire;
      
      // Save with a specific ID
      const questionnaireRef = doc(collection(db, 'questionnaires'), questionnaireId);
      
      try {
        // Use retry mechanism for better resilience with network issues
        await retryOperation(async () => {
          await setDoc(questionnaireRef, questionnaireToSave);
        }, 3, 1000);
        
        // Update questionnaires list
        if (isEditing) {
          setQuestionnaires(questionnaires.map(q => q.id === questionnaireId ? questionnaireToSave : q));
        } else {
          setQuestionnaires([questionnaireToSave, ...questionnaires]);
        }
        
        // Reset states
        setShowBuilder(false);
        setEditingQuestionnaire(null);
        
        return questionnaireId; // Return the ID on success
      } catch (firestoreError: any) {
        console.error('Firestore error saving questionnaire:', firestoreError);
        
        // Handle specific Firestore errors
        if (firestoreError.code === 'unavailable' || 
            firestoreError.code === 'deadline-exceeded' ||
            firestoreError.message?.includes('network')) {
          setError('Network error. The questionnaire could not be saved despite multiple attempts. Please check your internet connection.');
        } else {
          setError(`Failed to save questionnaire: ${firestoreError.message || 'Unknown error'}`);
        }
        return null;
      }
    } catch (error: any) {
      console.error('Error saving questionnaire:', error);
      setError(`Failed to save questionnaire: ${error.message || 'Unknown error'}`);
      return null;
    }
  };

  const handleDeleteQuestionnaire = async (questionnaireId: string) => {
    try {
      await deleteDoc(doc(db, 'questionnaires', questionnaireId));
      setQuestionnaires(questionnaires.filter(q => q.id !== questionnaireId));
      setShowDeleteConfirm(null);
    } catch (error) {
      console.error('Error deleting questionnaire:', error);
      setError('Failed to delete questionnaire');
    }
  };

  const getQuestionnaireTitle = (questionnaireId: string) => {
    const questionnaire = questionnaires.find(q => q.id === questionnaireId);
    return questionnaire?.title || 'Unknown Questionnaire';
  };

  const getQuestionText = (questionId: string, questionnaireId: string) => {
    const questionnaire = questionnaires.find(q => q.id === questionnaireId);
    if (!questionnaire) return 'Unknown Question';
    
    const question = questionnaire.questions.find(q => q.id === questionId);
    return question?.question || 'Unknown Question';
  };

  const handleExportResponses = (questionnaireId: string) => {
    const questionnaireResponses = responses.filter(r => r.questionnaireId === questionnaireId);
    if (questionnaireResponses.length === 0) {
      alert('No responses to export');
      return;
    }
    
    const questionnaire = questionnaires.find(q => q.id === questionnaireId);
    if (!questionnaire) {
      alert('Questionnaire not found');
      return;
    }
    
    const formattedData = questionnaireResponses.map(response => {
      const rowData: Record<string, any> = {
        'Respondent': response.respondent || 'Anonymous',
        'Location': response.location,
        'Submitted At': response.submittedAt.toLocaleString()
      };
      
      // Add each question and response
      questionnaire.questions.forEach(question => {
        const questionText = question.question;
        const responseValue = response.responses[question.id];
        rowData[questionText] = responseValue || '';
      });
      
      return rowData;
    });
    
    exportToCSV(formattedData, `${questionnaire.title}-responses`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (showBuilder) {
    return (
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">
            {editingQuestionnaire ? `Edit Questionnaire: ${editingQuestionnaire.title}` : 'Create Questionnaire'}
          </h1>
          <Button 
            variant="custom"
            onClick={() => {
              setShowBuilder(false);
              setEditingQuestionnaire(null);
            }}
            className="text-red-500 hover:text-red-700 hover:bg-gray-100 rounded-md px-3 py-1 text-sm"
          >
            Cancel
          </Button>
        </div>
        <QuestionnaireBuilder onSave={handleSaveQuestionnaire} initialQuestionnaire={editingQuestionnaire} />
      </div>
    );
  }

  const filteredResponses = responses.filter(response => {
    let match = true;
    
    if (locationFilter !== 'all') {
      match = match && response.location === locationFilter;
    }
    
    if (categoryFilter !== 'all') {
      const questionnaire = questionnaires.find(q => q.id === response.questionnaireId);
      match = match && questionnaire?.category === categoryFilter;
    }
    
    return match;
  });

  const sortedResponses = [...filteredResponses].sort((a, b) => {
    if (sortBy === 'date') {
      const dateA = a.submittedAt instanceof Date ? a.submittedAt : a.submittedAt.toDate();
      const dateB = b.submittedAt instanceof Date ? b.submittedAt : b.submittedAt.toDate();
      return sortOrder === 'asc' 
        ? dateA.getTime() - dateB.getTime()
        : dateB.getTime() - dateA.getTime();
    }
    
    if (sortBy === 'location') {
      if (sortOrder === 'asc') {
        return a.location.localeCompare(b.location);
      } else {
        return b.location.localeCompare(a.location);
      }
    }
    
    if (sortBy === 'category') {
      const questionnaireA = questionnaires.find(q => q.id === a.questionnaireId);
      const questionnaireB = questionnaires.find(q => q.id === b.questionnaireId);
      const categoryA = questionnaireA?.category || '';
      const categoryB = questionnaireB?.category || '';
      
      if (sortOrder === 'asc') {
        return categoryA.localeCompare(categoryB);
      } else {
        return categoryB.localeCompare(categoryA);
      }
    }
    
    return 0;
  });

  // Pagination
  const indexOfLastResponse = currentPage * responsesPerPage;
  const indexOfFirstResponse = indexOfLastResponse - responsesPerPage;
  const currentResponses = sortedResponses.slice(indexOfFirstResponse, indexOfLastResponse);
  const totalPages = Math.ceil(sortedResponses.length / responsesPerPage);

  // Extract unique locations and categories
  const locations = ['all', ...new Set(responses.map(r => r.location))];
  const categories = ['all', ...new Set(questionnaires.map(q => q.category || '').filter(Boolean))];

  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <h1 className="text-2xl font-bold mb-4 md:mb-0">Questionnaires Dashboard</h1>
        <Button 
          onClick={() => setShowBuilder(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          Create New Questionnaire
        </Button>
      </div>

      {/* Active Questionnaires */}
      <div className="bg-white rounded-lg shadow overflow-hidden mb-8">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">Active Questionnaires</h2>
        </div>
        <div className="overflow-x-auto">
          {questionnaires.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No questionnaires created yet.</p>
              <Button 
                onClick={() => setShowBuilder(true)}
                className="mt-4 bg-blue-600 hover:bg-blue-700 text-white"
              >
                Create Your First Questionnaire
              </Button>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Title
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Location
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Target Audience
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Questions
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {questionnaires.map(questionnaire => (
                  <tr key={questionnaire.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {questionnaire.title}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {questionnaire.location}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {questionnaire.category || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {questionnaire.targetAudience || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {questionnaire.questions.length}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {questionnaire.createdAt instanceof Date 
                        ? questionnaire.createdAt.toLocaleDateString() 
                        : questionnaire.createdAt.toDate().toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        questionnaire.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {questionnaire.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => {
                            const url = `${window.location.origin}/questionnaires/${questionnaire.id}`;
                            setShowQR({ id: questionnaire.id, url });
                          }}
                          className="text-blue-600 hover:text-blue-900 bg-blue-100 p-1 rounded"
                          title="Show QR Code"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleExportResponses(questionnaire.id)}
                          className="text-green-600 hover:text-green-900 bg-green-100 p-1 rounded"
                          title="Export Responses"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => {
                            setEditingQuestionnaire(questionnaire);
                            setShowBuilder(true);
                          }}
                          className="text-indigo-600 hover:text-indigo-900 bg-indigo-100 p-1 rounded"
                          title="Edit Questionnaire"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setShowDeleteConfirm(questionnaire.id)}
                          className="text-red-600 hover:text-red-900 bg-red-100 p-1 rounded"
                          title="Delete Questionnaire"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Responses Section */}
      <div className="bg-white rounded-lg shadow overflow-hidden mb-8">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold mb-4">Questionnaire Responses</h2>
          
          {/* Filters and sorting */}
          <div className="flex flex-wrap items-center gap-4 mt-2">
            <div className="flex items-center space-x-2">
              <label htmlFor="location-filter" className="text-sm font-medium text-gray-700">Location:</label>
              <select
                id="location-filter"
                value={locationFilter}
                onChange={e => setLocationFilter(e.target.value)}
                className="text-sm border-gray-300 rounded-md"
              >
                {locations.map(loc => (
                  <option key={loc} value={loc}>{loc === 'all' ? 'All Locations' : loc}</option>
                ))}
              </select>
            </div>
            
            <div className="flex items-center space-x-2">
              <label htmlFor="category-filter" className="text-sm font-medium text-gray-700">Category:</label>
              <select
                id="category-filter"
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
                className="text-sm border-gray-300 rounded-md"
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat === 'all' ? 'All Categories' : cat || 'Uncategorized'}</option>
                ))}
              </select>
            </div>
            
            <div className="flex items-center space-x-2">
              <label htmlFor="sort-by" className="text-sm font-medium text-gray-700">Sort by:</label>
              <select
                id="sort-by"
                value={sortBy}
                onChange={e => setSortBy(e.target.value as 'date' | 'location' | 'category')}
                className="text-sm border-gray-300 rounded-md"
              >
                <option value="date">Date</option>
                <option value="location">Location</option>
                <option value="category">Category</option>
              </select>
              <button
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="text-gray-500 hover:text-gray-700"
              >
                {sortOrder === 'asc' ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
        
        {/* Responses list */}
        {currentResponses.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">No responses found.</p>
          </div>
        ) : (
          <div className="space-y-4 p-4">
            {currentResponses.map(response => (
              <motion.div 
                key={response.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="border border-gray-200 rounded-lg p-4 shadow-sm"
              >
                <div className="flex flex-col sm:flex-row sm:justify-between mb-3">
                  <div className="flex items-center space-x-2 mb-2 sm:mb-0">
                    <div className="rounded-full bg-blue-100 p-2">
                      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <div>
                      <div className="font-medium text-blue-900">{response.respondent || 'Anonymous'}</div>
                      <div className="flex items-center text-xs text-gray-500">
                        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        {response.location}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="text-sm text-gray-500 bg-gray-100 rounded-full px-3 py-1">
                      {getQuestionnaireTitle(response.questionnaireId)}
                    </div>
                    <div className="text-xs text-gray-400 bg-gray-50 rounded-full px-2 py-1">
                      {response.submittedAt.toLocaleString()}
                    </div>
                  </div>
                </div>
                <div className="ml-4">
                  <div className="bg-gray-50 rounded-2xl p-5 shadow-sm">
                    {Object.entries(response.responses).map(([questionId, answer], index) => (
                      <div key={questionId} className={index > 0 ? 'mt-3 pt-3 border-t border-gray-200' : ''}>
                        <div className="mb-1 font-medium text-sm text-gray-700">
                          {getQuestionText(questionId, response.questionnaireId)}
                        </div>
                        <div className="text-gray-800">
                          {answer.toString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center py-4 bg-gray-50">
            <nav className="flex items-center">
              <button
                onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
                className={`mx-1 p-2 rounded ${
                  currentPage === 1 ? 'text-gray-400 cursor-not-allowed' : 'text-blue-600 hover:bg-blue-100'
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </button>
              <span className="text-sm text-gray-700">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                disabled={currentPage === totalPages}
                className={`mx-1 p-2 rounded ${
                  currentPage === totalPages ? 'text-gray-400 cursor-not-allowed' : 'text-blue-600 hover:bg-blue-100'
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
              </button>
            </nav>
          </div>
        )}
      </div>

      {/* QR Code Modal */}
      {showQR && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Share Questionnaire</h3>
              <button 
                onClick={() => setShowQR(null)}
                className="text-gray-400 hover:text-gray-500"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex flex-col items-center">
              <QRCodeSVG value={showQR.url} size={200} />
              <p className="mt-4 text-sm text-gray-600 break-all">{showQR.url}</p>
              <Button 
                onClick={() => {
                  navigator.clipboard.writeText(showQR.url);
                  alert('URL copied to clipboard!');
                }}
                className="mt-4 bg-blue-600 hover:bg-blue-700 text-white"
              >
                Copy Link
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md w-full">
            <div className="flex items-center mb-4 text-red-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <h3 className="text-lg font-medium">Confirm Deletion</h3>
            </div>
            <p className="mb-4">Are you sure you want to delete this questionnaire? This action cannot be undone.</p>
            <div className="flex justify-end space-x-4">
              <Button 
                onClick={() => setShowDeleteConfirm(null)}
                variant="custom"
                className="text-gray-700 bg-gray-100 hover:bg-gray-200"
              >
                Cancel
              </Button>
              <Button 
                onClick={() => handleDeleteQuestionnaire(showDeleteConfirm)}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
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
    </div>
  );
} 