'use client';

import React, { useEffect, useState } from 'react';
import { collection, query, getDocs, getDoc, doc, Timestamp } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { db, auth } from '../../lib/firebase';
import ResultsChart from '../../components/ResultsChart';
import CountdownTimer from '../../components/CountdownTimer';
import type { SurveySettings } from '../../types';

interface DashboardSettings {
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  bannerImageUrl?: string;
}

export default function DashboardPage() {
  const [totalVotes, setTotalVotes] = useState(0);
  const [surveyStatus, setSurveyStatus] = useState<'active' | 'upcoming' | 'ended'>('upcoming');
  const [settings, setSettings] = useState<DashboardSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    let unsubscribe: () => void;

    const initializeDashboard = async () => {
      try {
        console.log('Initializing dashboard...');
        unsubscribe = onAuthStateChanged(auth, async (user) => {
          if (!user) {
            console.log('No user found, redirecting to login...');
            router.push('/login');
            return;
          }

          console.log('User authenticated, fetching dashboard data...');
          try {
            setError(null);
            // Get survey settings
            const settingsDoc = await getDoc(doc(db, 'settings', 'survey'));
            if (!settingsDoc.exists()) {
              console.error('Survey settings document not found');
              setError('Survey settings not found. Please contact an administrator.');
              setLoading(false);
              return;
            }

            const settingsData = settingsDoc.data() as SurveySettings;
            const startDate = settingsData.startDate instanceof Timestamp 
              ? settingsData.startDate.toDate() 
              : new Date(settingsData.startDate);
            const endDate = settingsData.endDate instanceof Timestamp 
              ? settingsData.endDate.toDate() 
              : new Date(settingsData.endDate);

            console.log('Survey settings loaded successfully');

            setSettings({
              ...settingsData,
              startDate,
              endDate
            });

            const now = new Date();
            if (now < startDate) {
              setSurveyStatus('upcoming');
            } else if (now > endDate) {
              setSurveyStatus('ended');
            } else {
              setSurveyStatus('active');
            }

            // Get total votes
            const votesQuery = query(collection(db, 'nominations'));
            const votesSnapshot = await getDocs(votesQuery);
            setTotalVotes(votesSnapshot.size);
            console.log('Dashboard data loaded successfully');
          } catch (error) {
            console.error('Error fetching dashboard data:', error);
            setError('Failed to load dashboard data. Please try again later.');
          } finally {
            setLoading(false);
          }
        });
      } catch (error) {
        console.error('Error initializing dashboard:', error);
        setError('Failed to initialize dashboard. Please try again later.');
        setLoading(false);
      }
    };

    initializeDashboard();
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [router]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'upcoming':
        return 'bg-yellow-100 text-yellow-800';
      case 'ended':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border-l-4 border-red-400 p-4">
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
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Survey Status</h2>
          <div className="flex items-center space-x-4">
            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(surveyStatus)}`}>
              {surveyStatus.charAt(0).toUpperCase() + surveyStatus.slice(1)}
            </span>
            {settings && (
              <span className="text-gray-500">
                {`${formatDate(settings.startDate)} - ${formatDate(settings.endDate)}`}
              </span>
            )}
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Total Votes</h2>
          <p className="text-4xl font-bold text-blue-600">{totalVotes}</p>
        </div>
      </div>

      <CountdownTimer />

      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Latest Results</h2>
        <ResultsChart />
      </div>
    </div>
  );
}
