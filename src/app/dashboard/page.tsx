'use client';

import React, { useEffect, useState } from 'react';
import { collection, query, getDocs, orderBy, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { FeedbackForm, FeedbackResponse } from '../../types';

interface Stats {
  totalFeedback: number;
  totalPolls: number;
  totalQuestionnaires: number;
  activePolls: number;
  activeFeedbackForms: number;
  activeQuestionnaires: number;
  recentResponses: number;
  averageRating: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({
    totalFeedback: 0,
    totalPolls: 0,
    totalQuestionnaires: 0,
    activePolls: 0,
    activeFeedbackForms: 0,
    activeQuestionnaires: 0,
    recentResponses: 0,
    averageRating: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        
        // Fetch feedback forms
        const formsQuery = query(collection(db, 'feedback-forms'));
        const formsSnapshot = await getDocs(formsQuery);
        const activeFeedbackForms = formsSnapshot.docs.filter(doc => doc.data().isActive).length;

        // Fetch polls
        const pollsQuery = query(collection(db, 'polls'));
        const pollsSnapshot = await getDocs(pollsQuery);
        const activePolls = pollsSnapshot.docs.filter(doc => doc.data().isActive).length;

        // Fetch questionnaires
        const questionnairesQuery = query(collection(db, 'questionnaires'));
        const questionnairesSnapshot = await getDocs(questionnairesQuery);
        const activeQuestionnaires = questionnairesSnapshot.docs.filter(doc => doc.data().isActive).length;

        // Fetch recent responses (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const responsesQuery = query(
          collection(db, 'feedback-responses'),
          where('submittedAt', '>=', thirtyDaysAgo),
          orderBy('submittedAt', 'desc')
        );
        const responsesSnapshot = await getDocs(responsesQuery);
        
        // Fetch questionnaire responses
        const questionnaireResponsesQuery = query(
          collection(db, 'questionnaire-responses'),
          where('submittedAt', '>=', thirtyDaysAgo),
          orderBy('submittedAt', 'desc')
        );
        const questionnaireResponsesSnapshot = await getDocs(questionnaireResponsesQuery);
        
        // Calculate average rating from responses
        let totalRating = 0;
        let ratingCount = 0;
        
        // Process feedback responses for ratings
        responsesSnapshot.docs.forEach(doc => {
          const data = doc.data();
          Object.values(data.responses).forEach(response => {
            if (typeof response === 'number' && response >= 1 && response <= 5) {
              totalRating += response;
              ratingCount++;
            }
          });
        });
        
        // Process questionnaire responses for ratings
        questionnaireResponsesSnapshot.docs.forEach(doc => {
          const data = doc.data();
          Object.values(data.responses).forEach(response => {
            if (typeof response === 'number' && response >= 1 && response <= 5) {
              totalRating += response;
              ratingCount++;
            }
          });
        });

        const totalResponses = responsesSnapshot.size + questionnaireResponsesSnapshot.size;

        setStats({
          totalFeedback: formsSnapshot.size,
          totalPolls: pollsSnapshot.size,
          totalQuestionnaires: questionnairesSnapshot.size,
          activePolls,
          activeFeedbackForms,
          activeQuestionnaires,
          recentResponses: totalResponses,
          averageRating: ratingCount > 0 ? Math.round((totalRating / ratingCount) * 10) / 10 : 0
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
        setError('Failed to load dashboard statistics');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border-l-4 border-red-400 p-4">
        <p className="text-sm text-red-700">{error}</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard Overview</h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Active Forms Card */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-purple-100">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <h2 className="text-lg font-semibold text-gray-900">Active Forms</h2>
              <p className="text-3xl font-bold text-purple-600">{stats.activeFeedbackForms}</p>
              <p className="text-sm text-gray-500">Out of {stats.totalFeedback} total forms</p>
            </div>
          </div>
        </div>

        {/* Active Polls Card */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-green-100">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
              </svg>
            </div>
            <div className="ml-4">
              <h2 className="text-lg font-semibold text-gray-900">Active Polls</h2>
              <p className="text-3xl font-bold text-green-600">{stats.activePolls}</p>
              <p className="text-sm text-gray-500">Out of {stats.totalPolls} total polls</p>
            </div>
          </div>
        </div>

        {/* Active Questionnaires Card */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-blue-100">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div className="ml-4">
              <h2 className="text-lg font-semibold text-gray-900">Active Questionnaires</h2>
              <p className="text-3xl font-bold text-blue-600">{stats.activeQuestionnaires}</p>
              <p className="text-sm text-gray-500">Out of {stats.totalQuestionnaires} total questionnaires</p>
            </div>
          </div>
        </div>

        {/* Recent Responses Card */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-purple-100">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <div className="ml-4">
              <h2 className="text-lg font-semibold text-gray-900">Recent Responses</h2>
              <p className="text-3xl font-bold text-purple-600">{stats.recentResponses}</p>
              <p className="text-sm text-gray-500">In the last 30 days</p>
            </div>
          </div>
        </div>

        {/* Average Rating Card */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-yellow-100">
              <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            </div>
            <div className="ml-4">
              <h2 className="text-lg font-semibold text-gray-900">Average Rating</h2>
              <p className="text-3xl font-bold text-yellow-600">{stats.averageRating}</p>
              <p className="text-sm text-gray-500">Out of 5 stars</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <a
            href="/dashboard/feedback"
            className="flex items-center p-4 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
          >
            <svg className="w-6 h-6 text-purple-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Create Feedback Form
          </a>
          <a
            href="/dashboard/polls"
            className="flex items-center p-4 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
          >
            <svg className="w-6 h-6 text-green-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Create Poll
          </a>
          <a
            href="/dashboard/questionnaires"
            className="flex items-center p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
          >
            <svg className="w-6 h-6 text-blue-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Create Questionnaire
          </a>
          <a
            href="/dashboard/feedback"
            className="flex items-center p-4 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
          >
            <svg className="w-6 h-6 text-purple-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            View Feedback
          </a>
          <a
            href="/dashboard/polls"
            className="flex items-center p-4 bg-yellow-50 rounded-lg hover:bg-yellow-100 transition-colors"
          >
            <svg className="w-6 h-6 text-yellow-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            View Poll Results
          </a>
          <a
            href="/dashboard/questionnaires"
            className="flex items-center p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
          >
            <svg className="w-6 h-6 text-blue-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            View Questionnaires
          </a>
        </div>
      </div>
    </div>
  );
}
