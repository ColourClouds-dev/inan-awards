'use client';

import React, { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { db, auth } from '../../../lib/firebase';
import ResultsChart from '../../../components/ResultsChart';
import { motion } from 'framer-motion';
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

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1,
    transition: { 
      staggerChildren: 0.1
    }
  }
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: { 
    y: 0, 
    opacity: 1,
    transition: { type: 'spring', stiffness: 50 }
  }
};

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
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
          <p className="mt-4 text-purple-600 font-medium">Loading poll results...</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div 
      className="space-y-8"
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      <motion.div 
        className="bg-gradient-to-r from-purple-600 to-blue-500 text-white rounded-lg shadow-lg p-8"
        variants={itemVariants}
      >
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
          <div>
            <h1 className="text-3xl font-bold mb-2">Poll Results</h1>
            <p className="text-purple-100">View and analyze nomination results across all categories</p>
          </div>
          <motion.button
            onClick={handleExportCSV}
            disabled={exportLoading || loading || !!error}
            className={`mt-4 md:mt-0 inline-flex items-center px-4 py-2 rounded-md shadow-sm text-sm font-medium 
              bg-white text-purple-700 hover:bg-purple-50 focus:outline-none focus:ring-2 focus:ring-offset-2 
              focus:ring-purple-200 focus:ring-offset-purple-700 transition-all ${
              (exportLoading || loading || !!error) ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            {exportLoading ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-purple-700" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Exporting...
              </>
            ) : (
              <>
                <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export Results (CSV)
              </>
            )}
          </motion.button>
        </div>
      </motion.div>

      {error ? (
        <motion.div 
          className="bg-red-50 border-l-4 border-red-400 p-6 rounded-md shadow"
          variants={itemVariants}
        >
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-6 w-6 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </motion.div>
      ) : (
        <motion.div 
          className="bg-white rounded-lg shadow-xl overflow-hidden"
          variants={itemVariants}
        >
          <div className="p-6 bg-gradient-to-r from-purple-50 to-blue-50 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-800">Nomination Visualizations</h2>
            <p className="text-sm text-gray-600">Select categories to view detailed results</p>
          </div>
          <div className="p-6">
            <ResultsChart />
          </div>
        </motion.div>
      )}

      <motion.div 
        className="bg-white rounded-lg shadow-xl p-6"
        variants={itemVariants}
      >
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Categories Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {results.map((category) => (
            <motion.div 
              key={category.categoryId}
              className="border rounded-lg p-4 hover:shadow-md transition-shadow bg-white"
              whileHover={{ y: -5, transition: { duration: 0.2 } }}
            >
              <h3 className="font-medium text-gray-800 mb-2">{category.title}</h3>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Total Votes:</span>
                <span className="font-semibold text-purple-600">{category.totalVotes}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Unique Nominees:</span>
                <span className="font-semibold text-purple-600">{Object.keys(category.nominations).length}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
