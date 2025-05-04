'use client';

import React, { useState, useEffect } from 'react';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../../../lib/firebase';
import type { Poll, PollResponse } from '../../../../types';

export default function PollResultsPage({ params }: { params: { pollId: string } }) {
  const [poll, setPoll] = useState<Poll | null>(null);
  const [responses, setResponses] = useState<PollResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPollAndResponses = async () => {
      try {
        setLoading(true);
        
        // Fetch the poll
        const pollRef = doc(db, 'polls', params.pollId);
        const pollDoc = await getDoc(pollRef);
        
        if (!pollDoc.exists()) {
          setError("Poll not found");
          setLoading(false);
          return;
        }
        
        const pollData = pollDoc.data();
        setPoll({
          id: pollDoc.id,
          ...pollData,
          createdAt: pollData.createdAt?.toDate() || new Date(),
          endDate: pollData.endDate?.toDate() || null
        } as Poll);
        
        // Fetch the responses
        const responsesQuery = query(
          collection(db, 'poll-responses'),
          where('pollId', '==', params.pollId)
        );
        
        const responsesSnapshot = await getDocs(responsesQuery);
        const responsesData = responsesSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            submittedAt: data.submittedAt?.toDate() || new Date()
          };
        }) as PollResponse[];
        
        setResponses(responsesData);
        
      } catch (error) {
        console.error("Error fetching poll data:", error);
        setError("Failed to load poll results. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchPollAndResponses();
  }, [params.pollId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-red-50 border-l-4 border-red-400 p-4 max-w-md w-full">
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
      </div>
    );
  }

  if (!poll) {
    return null;
  }

  // Count responses for each option
  const optionCounts: Record<string, number> = {};
  poll.options.forEach(option => {
    optionCounts[option] = 0;
  });
  
  responses.forEach(response => {
    if (optionCounts[response.selectedOption] !== undefined) {
      optionCounts[response.selectedOption]++;
    }
  });
  
  const totalVotes = responses.length;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
          <div className="bg-green-600 px-6 py-4">
            <h1 className="text-xl font-bold text-white">{poll.title} - Results</h1>
            <p className="text-green-100 mt-1">{poll.question}</p>
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
            
            {responses.length > 0 && (
              <div className="mt-8">
                <h2 className="text-lg font-medium text-gray-900 mb-4">Recent Responses</h2>
                <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
                  <table className="min-w-full divide-y divide-gray-300">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">Respondent</th>
                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Response</th>
                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Submitted</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {responses.slice(0, 10).map(response => (
                        <tr key={response.id}>
                          <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                            {response.respondent || 'Anonymous'}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                            {response.selectedOption}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                            {response.submittedAt.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            
            <div className="mt-6 flex justify-between">
              <a 
                href={`/polls/${poll.id}`}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                Back to Poll
              </a>
              <a 
                href="/dashboard/polls"
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                Dashboard
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 