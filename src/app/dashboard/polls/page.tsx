'use client';

import React, { useEffect, useState } from 'react';
import { collection, query, getDocs, orderBy, doc, setDoc, where, deleteDoc } from 'firebase/firestore';
import { exportToCSV } from '../../../lib/exportToCSV';
import { QRCodeSVG } from 'qrcode.react';
import { db, retryOperation } from '../../../lib/firebase';
import Button from '../../../components/Button';
import type { Poll, PollResponse } from '../../../types';
import { motion, AnimatePresence } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';

export default function PollsDashboardPage() {
  const [polls, setPolls] = useState<Poll[]>([]);
  const [responses, setResponses] = useState<PollResponse[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingPoll, setEditingPoll] = useState<Poll | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showQR, setShowQR] = useState<{ id: string; url: string } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showResultsModal, setShowResultsModal] = useState<string | null>(null);
  
  // New poll form states
  const [pollTitle, setPollTitle] = useState('');
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollDescription, setPollDescription] = useState('');
  const [pollLocation, setPollLocation] = useState('');
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
  const [endDate, setEndDate] = useState<string>('');
  
  const locations = [
    'Qaras Hotels: House 3',
    'Qaras Hotels: Bluxton',
    'Online',
    'Marketing',
    'Customer Service'
  ];

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch polls
        const pollsQuery = query(
          collection(db, 'polls'),
          orderBy('createdAt', 'desc')
        );
        
        try {
          const pollsSnapshot = await getDocs(pollsQuery);
          const pollsData = pollsSnapshot.docs.map(doc => {
            const data = doc.data();
            return {
              ...data,
              id: doc.id,
              createdAt: data.createdAt?.toDate() || new Date(),
              endDate: data.endDate?.toDate() || null
            };
          }) as Poll[];
          setPolls(pollsData);
        } catch (pollsError) {
          console.error('Error fetching polls:', pollsError);
          setError('Failed to load polls. You may be offline.');
        }

        // Fetch responses
        try {
          const responsesQuery = query(
            collection(db, 'poll-responses'),
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
          }) as PollResponse[];
          setResponses(responsesData);
        } catch (responsesError) {
          console.error('Error fetching responses:', responsesError);
          setError('Failed to load poll responses. You may be offline.');
        }
      } catch (error) {
        console.error('Error fetching poll data:', error);
        setError('Failed to load poll data. Please check your internet connection.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const resetForm = () => {
    setPollTitle('');
    setPollQuestion('');
    setPollDescription('');
    setPollLocation('');
    setPollOptions(['', '']);
    setEndDate('');
    setEditingPoll(null);
  };

  const handleCreateOrUpdatePoll = async () => {
    try {
      if (!pollTitle || !pollQuestion || !pollLocation || pollOptions.some(opt => !opt.trim())) {
        setError('Please fill in all required fields and provide at least two options');
        return;
      }

      const isEditing = !!editingPoll;
      const pollId = isEditing ? editingPoll.id : uuidv4();
      
      const poll: Poll = {
        id: pollId,
        title: pollTitle,
        question: pollQuestion,
        description: pollDescription,
        options: pollOptions.filter(opt => opt.trim()),
        location: pollLocation,
        createdAt: isEditing ? editingPoll.createdAt : new Date(),
        isActive: true,
        ...(endDate ? { endDate: new Date(endDate) } : {})
      };

      const pollRef = doc(collection(db, 'polls'), pollId);
      
      await retryOperation(async () => {
        await setDoc(pollRef, poll);
      }, 3, 1000);
      
      if (isEditing) {
        setPolls(polls.map(p => p.id === pollId ? poll : p));
      } else {
        setPolls([poll, ...polls]);
      }
      
      setShowCreateModal(false);
      resetForm();
      
    } catch (error: any) {
      console.error('Error saving poll:', error);
      setError(`Failed to save poll: ${error.message || 'Unknown error'}`);
    }
  };

  const handleDeletePoll = async (pollId: string) => {
    try {
      await deleteDoc(doc(db, 'polls', pollId));
      setPolls(polls.filter(p => p.id !== pollId));
      setShowDeleteConfirm(null);
    } catch (error) {
      console.error('Error deleting poll:', error);
      setError('Failed to delete poll');
    }
  };

  const handleEditPoll = (poll: Poll) => {
    setEditingPoll(poll);
    setPollTitle(poll.title);
    setPollQuestion(poll.question);
    setPollDescription(poll.description || '');
    setPollLocation(poll.location);
    setPollOptions(poll.options.length > 0 ? [...poll.options] : ['', '']);
    setEndDate(poll.endDate ? 
      (poll.endDate instanceof Date ? 
        poll.endDate.toISOString().split('T')[0] : 
        poll.endDate.toDate().toISOString().split('T')[0]
      ) : '');
    setShowCreateModal(true);
  };

  const handleAddOption = () => {
    setPollOptions([...pollOptions, '']);
  };

  const handleRemoveOption = (index: number) => {
    if (pollOptions.length <= 2) {
      setError('A poll must have at least two options');
      return;
    }
    const newOptions = [...pollOptions];
    newOptions.splice(index, 1);
    setPollOptions(newOptions);
  };

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...pollOptions];
    newOptions[index] = value;
    setPollOptions(newOptions);
  };

  const handleExportResponses = (pollId: string) => {
    const pollResponses = responses.filter(r => r.pollId === pollId);
    if (pollResponses.length === 0) {
      alert('No responses to export');
      return;
    }
    
    const poll = polls.find(p => p.id === pollId);
    if (!poll) {
      alert('Poll not found');
      return;
    }
    
    const csvData = pollResponses.map(response => ({
      'Respondent': response.respondent || 'Anonymous',
      'Response': response.selectedOption,
      'Location': response.location,
      'Submitted At': response.submittedAt.toLocaleString()
    }));
    
    exportToCSV(csvData, `${poll.title}-responses`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
      </div>
    );
  }

  const ResultsModal = ({ pollId }: { pollId: string }) => {
    const poll = polls.find(p => p.id === pollId);
    if (!poll) return null;
    
    const pollResponses = responses.filter(r => r.pollId === pollId);
    const totalVotes = pollResponses.length;
    
    // Count responses for each option
    const optionCounts: Record<string, number> = {};
    poll.options.forEach(option => {
      optionCounts[option] = 0;
    });
    
    pollResponses.forEach(response => {
      if (optionCounts[response.selectedOption] !== undefined) {
        optionCounts[response.selectedOption]++;
      }
    });
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        >
          <div className="bg-green-600 px-6 py-4">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-xl font-bold text-white">{poll.title} - Results</h2>
                <p className="text-green-100 mt-1">{poll.question}</p>
              </div>
              <button 
                onClick={() => setShowResultsModal(null)}
                className="text-white hover:text-gray-200"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          
          <div className="p-6">
            {poll.description && (
              <div className="mb-6 text-gray-600">{poll.description}</div>
            )}
            
            <div className="mb-4 flex justify-between text-sm text-gray-600">
              <div>Location: {poll.location}</div>
              <div>Total Votes: {totalVotes}</div>
            </div>
            
            <div className="space-y-6">
              {poll.options.map((option, index) => {
                const count = optionCounts[option] || 0;
                const percentage = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                
                return (
                  <div key={index} className="bg-gray-50 rounded-lg p-4">
                    <div className="flex justify-between mb-2">
                      <span className="font-medium">{option}</span>
                      <span className="text-green-600 font-bold">{count} votes ({percentage}%)</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div 
                        className="bg-green-600 h-2.5 rounded-full transition-all duration-500" 
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
            
            <div className="mt-6 flex justify-end">
              <Button 
                onClick={() => handleExportResponses(pollId)}
                className="bg-green-100 text-green-700 hover:bg-green-200"
              >
                Export Results
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  };

  const CreatePollModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-900">{editingPoll ? 'Edit Poll' : 'Create New Poll'}</h2>
          <button 
            onClick={() => {
              setShowCreateModal(false);
              resetForm();
            }}
            className="text-gray-400 hover:text-gray-500"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {error && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}
        
        <div className="space-y-4">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700">Poll Title *</label>
            <input
              type="text"
              id="title"
              value={pollTitle}
              onChange={(e) => setPollTitle(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
              placeholder="Enter a title for your poll"
              required
            />
          </div>
          
          <div>
            <label htmlFor="question" className="block text-sm font-medium text-gray-700">Poll Question *</label>
            <input
              type="text"
              id="question"
              value={pollQuestion}
              onChange={(e) => setPollQuestion(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
              placeholder="What would you like to ask?"
              required
            />
          </div>
          
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700">Description (Optional)</label>
            <textarea
              id="description"
              value={pollDescription}
              onChange={(e) => setPollDescription(e.target.value)}
              rows={2}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
              placeholder="Add more context to your poll"
            />
          </div>
          
          <div>
            <label htmlFor="location" className="block text-sm font-medium text-gray-700">Location *</label>
            <select
              id="location"
              value={pollLocation}
              onChange={(e) => setPollLocation(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
              required
            >
              <option value="">Select Location</option>
              {locations.map(location => (
                <option key={location} value={location}>{location}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label htmlFor="endDate" className="block text-sm font-medium text-gray-700">End Date (Optional)</label>
            <input
              type="date"
              id="endDate"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
              min={new Date().toISOString().split('T')[0]}
            />
          </div>
          
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-gray-700">Poll Options *</label>
              <button
                type="button"
                onClick={handleAddOption}
                className="text-xs text-green-600 hover:text-green-800"
              >
                + Add Option
              </button>
            </div>
            
            {pollOptions.map((option, index) => (
              <div key={index} className="flex items-center space-x-2 mt-2">
                <input
                  type="text"
                  value={option}
                  onChange={(e) => handleOptionChange(index, e.target.value)}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                  placeholder={`Option ${index + 1}`}
                  required
                />
                <button
                  type="button"
                  onClick={() => handleRemoveOption(index)}
                  className="text-gray-400 hover:text-red-500"
                  title="Remove option"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
        
        <div className="mt-6 flex justify-end space-x-3">
          <Button
            onClick={() => {
              setShowCreateModal(false);
              resetForm();
            }}
            variant="custom"
            className="bg-gray-100 text-gray-700 hover:bg-gray-200"
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreateOrUpdatePoll}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {editingPoll ? 'Update Poll' : 'Create Poll'}
          </Button>
        </div>
      </motion.div>
    </div>
  );

  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <h1 className="text-2xl font-bold mb-4 md:mb-0">Polls Dashboard</h1>
        <Button 
          onClick={() => setShowCreateModal(true)}
          className="bg-green-600 hover:bg-green-700 text-white"
        >
          Create New Poll
        </Button>
      </div>

      {/* Active Polls */}
      <div className="bg-white rounded-lg shadow overflow-hidden mb-8">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">Active Polls</h2>
        </div>
        <div className="overflow-x-auto">
          {polls.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No polls created yet.</p>
              <Button 
                onClick={() => setShowCreateModal(true)}
                className="mt-4 bg-green-600 hover:bg-green-700 text-white"
              >
                Create Your First Poll
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
                    Question
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Location
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Options
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Responses
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {polls.map(poll => {
                  const pollResponses = responses.filter(r => r.pollId === poll.id);
                  const isExpired = poll.endDate && new Date() > poll.endDate;
                  
                  return (
                    <tr key={poll.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {poll.title}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {poll.question}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {poll.location}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {poll.options.length}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {poll.createdAt instanceof Date 
                        ? poll.createdAt.toLocaleDateString() 
                        : poll.createdAt.toDate().toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          !poll.isActive ? 'bg-red-100 text-red-800' :
                          isExpired ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {!poll.isActive ? 'Inactive' : isExpired ? 'Expired' : 'Active'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {pollResponses.length}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => {
                              const url = `${window.location.origin}/polls/${poll.id}`;
                              setShowQR({ id: poll.id, url });
                            }}
                            className="text-green-600 hover:text-green-900 bg-green-100 p-1 rounded"
                            title="Show QR Code"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => setShowResultsModal(poll.id)}
                            className="text-blue-600 hover:text-blue-900 bg-blue-100 p-1 rounded"
                            title="View Results"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleEditPoll(poll)}
                            className="text-indigo-600 hover:text-indigo-900 bg-indigo-100 p-1 rounded"
                            title="Edit Poll"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => setShowDeleteConfirm(poll.id)}
                            className="text-red-600 hover:text-red-900 bg-red-100 p-1 rounded"
                            title="Delete Poll"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* QR Code Modal */}
      {showQR && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Share Poll</h3>
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
                className="mt-4 bg-green-600 hover:bg-green-700 text-white"
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
            <p className="mb-4">Are you sure you want to delete this poll? This action cannot be undone.</p>
            <div className="flex justify-end space-x-4">
              <Button 
                onClick={() => setShowDeleteConfirm(null)}
                variant="custom"
                className="text-gray-700 bg-gray-100 hover:bg-gray-200"
              >
                Cancel
              </Button>
              <Button 
                onClick={() => handleDeletePoll(showDeleteConfirm)}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Results Modal */}
      {showResultsModal && <ResultsModal pollId={showResultsModal} />}

      {/* Create/Edit Poll Modal */}
      {showCreateModal && <CreatePollModal />}

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