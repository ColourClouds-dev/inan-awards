'use client';

import React, { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { db, auth } from '../../../lib/firebase';
import ResultsChart from '../../../components/ResultsChart';
import type { NominationResults } from '../../../types';

interface CategoryResults {
  categoryId: number;
  title: string;
  nominations: Record<string, number>;
  totalVotes: number;
}

interface NominationData {
  nominations: Record<string, string>;
  timestamp: Date;
}

const categories = [
  { id: 1, title: 'Most Committed Staff of the Year' },
  { id: 2, title: 'Most Customer-Oriented Staff of the Year' },
  { id: 3, title: 'Employee of the Year' },
  { id: 4, title: 'Best Front Desk Staff of the Year' },
  { id: 5, title: 'Mr. Always Available' },
  { id: 6, title: 'Outstanding Performance' },
  { id: 7, title: 'Team Player' },
  { id: 8, title: 'Innovation and Creativity' },
  { id: 9, title: 'Years of Service' },
  { id: 10, title: 'Leadership and Mentorship' }
];

export default function ResultsPage() {
  const [loading, setLoading] = useState(true);
  const [exportLoading, setExportLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<CategoryResults[]>([]);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push('/login');
      }
    });

    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    const fetchResults = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'nominations'));
        const nominations = querySnapshot.docs.map(doc => doc.data() as NominationData);

        // Initialize results for all categories
        const categoryResults = categories.map(cat => ({
          categoryId: cat.id,
          title: cat.title,
          nominations: {} as Record<string, number>,
          totalVotes: 0
        }));

        // Process nominations
        nominations.forEach(nomination => {
          const nominationData = nomination.nominations || {};
          Object.entries(nominationData).forEach(([categoryId, nominee]) => {
            const catId = parseInt(categoryId);
            const categoryResult = categoryResults.find(r => r.categoryId === catId);
            if (categoryResult) {
              categoryResult.nominations[nominee] = (categoryResult.nominations[nominee] || 0) + 1;
              categoryResult.totalVotes++;
            }
          });
        });

        setResults(categoryResults);
        setError(null);
      } catch (err) {
        console.error('Error fetching results:', err);
        setError('Failed to load results. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, []);

  const handleExportCSV = async () => {
    setExportLoading(true);
    try {
      // Create CSV content with headers
      const csvRows = ['Category,Nominee,Votes'];

      // Add data rows
      results.forEach(category => {
        Object.entries(category.nominations).forEach(([nominee, votes]) => {
          csvRows.push(`"${category.title}","${nominee}",${votes}`);
        });
      });

      const csvContent = csvRows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      const date = new Date().toISOString().split('T')[0];
      link.href = url;
      link.setAttribute('download', `inan-awards-results-${date}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error exporting results:', err);
      setError('Failed to export results. Please try again.');
    } finally {
      setExportLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Awards Results</h1>
        <button
          onClick={handleExportCSV}
          disabled={exportLoading || loading || !!error}
          className={`inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 ${
            (exportLoading || loading || !!error) ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          {exportLoading ? 'Exporting...' : 'Export Results (CSV)'}
        </button>
      </div>

      {error ? (
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
      ) : (
        <div className="bg-white shadow rounded-lg p-6">
          <ResultsChart />
        </div>
      )}
    </div>
  );
}
