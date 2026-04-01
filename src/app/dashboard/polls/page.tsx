'use client';

import React, { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import ResultsChart from '../../../components/ResultsChart';

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
  { id: 10, title: 'Leadership and Mentorship' },
];

export default function PollsPage() {
  const [loading, setLoading] = useState(true);
  const [exportLoading, setExportLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<CategoryResults[]>([]);
  const [totalSubmissions, setTotalSubmissions] = useState(0);

  useEffect(() => {
    const fetchResults = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'nominations'));
        setTotalSubmissions(querySnapshot.size);

        const nominations = querySnapshot.docs.map(doc => doc.data() as NominationData);

        const categoryResults = categories.map(cat => ({
          categoryId: cat.id,
          title: cat.title,
          nominations: {} as Record<string, number>,
          totalVotes: 0,
        }));

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
        setError('Failed to load nomination results. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, []);

  const handleExportCSV = async () => {
    setExportLoading(true);
    try {
      const csvRows = ['Category,Nominee,Votes'];
      results.forEach(category => {
        Object.entries(category.nominations)
          .sort(([, a], [, b]) => b - a)
          .forEach(([nominee, votes]) => {
            csvRows.push(`"${category.title}","${nominee}",${votes}`);
          });
      });

      const csvContent = csvRows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      const date = new Date().toISOString().split('T')[0];
      link.href = url;
      link.setAttribute('download', `inan-nominations-${date}.csv`);
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Staff Awards Nominations</h1>
          <p className="text-sm text-gray-500 mt-1">{totalSubmissions} total submission{totalSubmissions !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="/dashboard/polls/new"
            className="inline-flex items-center px-4 py-2 border border-purple-600 text-sm font-medium rounded-md text-purple-600 hover:bg-purple-50"
          >
            Manage Nominations
          </a>
          <button
            onClick={handleExportCSV}
            disabled={exportLoading || !!error}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {exportLoading ? 'Exporting...' : 'Export CSV'}
          </button>
        </div>
      </div>

      {error ? (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {results.map(cat => {
              const leader = Object.entries(cat.nominations).sort(([, a], [, b]) => b - a)[0];
              return (
                <div key={cat.categoryId} className="bg-white rounded-lg shadow p-4">
                  <p className="text-xs text-gray-500 mb-1 line-clamp-2">{cat.title}</p>
                  {leader ? (
                    <>
                      <p className="text-sm font-semibold text-gray-900 truncate">{leader[0]}</p>
                      <p className="text-xs text-purple-600">{leader[1]} vote{leader[1] !== 1 ? 's' : ''}</p>
                    </>
                  ) : (
                    <p className="text-xs text-gray-400 italic">No votes yet</p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Full chart */}
          <div className="bg-white shadow rounded-lg p-6">
            <ResultsChart />
          </div>
        </>
      )}
    </div>
  );
}
