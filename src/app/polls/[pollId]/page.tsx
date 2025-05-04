'use client';

import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import PollForm from '../../../components/PollForm';

export default function PollPage({ params }: { params: { pollId: string } }) {
  const [poll, setPoll] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPoll = async () => {
      try {
        const pollRef = doc(db, 'polls', params.pollId);
        const pollDoc = await getDoc(pollRef);
        
        if (!pollDoc.exists()) {
          setError("Poll not found");
          setLoading(false);
          return;
        }
        
        const pollData = pollDoc.data();
        
        // Check if poll is active
        if (!pollData.isActive) {
          setError("This poll is no longer active");
          setLoading(false);
          return;
        }
        
        // Check if poll has expired
        if (pollData.endDate && new Date() > pollData.endDate.toDate()) {
          setError("This poll has expired");
          setLoading(false);
          return;
        }
        
        setPoll({
          id: pollDoc.id,
          ...pollData,
          createdAt: pollData.createdAt?.toDate() || new Date(),
          endDate: pollData.endDate?.toDate() || null
        });
        
      } catch (error) {
        console.error("Error fetching poll:", error);
        setError("Failed to load poll. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchPoll();
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

  return <PollForm poll={poll} />;
} 