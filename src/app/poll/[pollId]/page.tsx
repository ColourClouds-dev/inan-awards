'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { getPollById } from '../../../lib/pollsFirestore';
import PollVotingInterface from '../../../components/PollVotingInterface';
import type { Poll } from '../../../types';

export default function PublicPollPage() {
  const params = useParams();
  const router = useRouter();
  
  const pollId = params.pollId as string;
  const [poll, setPoll] = useState<Poll | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPoll() {
      if (!pollId) return;
      try {
        const data = await getPollById(pollId);
        if (!data) {
          setError('Poll not found.');
          return;
        }
        setPoll(data);
      } catch (err) {
        console.error('Error fetching public poll details:', err);
        setError('Failed to load poll.');
      } finally {
        setLoading(false);
      }
    }
    fetchPoll();
  }, [pollId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
      </div>
    );
  }

  if (error || !poll) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-50">
        <div className="bg-white border rounded-2xl p-8 max-w-md w-full shadow text-center space-y-4">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto text-red-600 font-bold text-lg">
            !
          </div>
          <h3 className="font-bold text-gray-900 text-lg">Poll Unavailable</h3>
          <p className="text-sm text-gray-500">{error || 'This poll is not available.'}</p>
          <button
            onClick={() => router.push('/')}
            className="w-full inline-flex justify-center py-2 border rounded-lg text-sm font-semibold bg-gray-50 hover:bg-gray-100 transition-colors"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Small Header */}
      <header className="bg-white border-b py-3 shrink-0">
        <div className="max-w-4xl mx-auto px-4 flex justify-between items-center">
          <Link href="/">
            <Image src="/inan.svg" alt="INAN Logo" width={80} height={80} className="object-contain" />
          </Link>
          <span className="text-xs text-gray-400 font-semibold uppercase tracking-wide">
            Feedback & Engagement
          </span>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 flex items-center justify-center py-10 px-4">
        {poll.isActive ? (
          <div className="w-full max-w-xl">
            <PollVotingInterface poll={poll} />
          </div>
        ) : (
          <div className="bg-white border border-gray-100 rounded-2xl shadow p-8 max-w-md w-full text-center space-y-4">
            <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto text-amber-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h3 className="font-bold text-gray-900 text-lg">Poll Closed</h3>
            <p className="text-sm text-gray-500">
              The poll &ldquo;{poll.title}&rdquo; is no longer accepting responses.
            </p>
            <button
              onClick={() => router.push('/')}
              className="w-full inline-flex justify-center py-2 border rounded-lg text-sm font-semibold bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              Back to Home
            </button>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t py-4 text-center text-xs text-gray-400 shrink-0">
        &copy; {new Date().getFullYear()} INAN Management. All rights reserved.
      </footer>
    </div>
  );
}
