import React, { useEffect, useState } from 'react';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { NominationResults } from '../types';

// Import categories from a shared location to maintain consistency
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

const ResultsChart = () => {
  const [results, setResults] = useState<NominationResults[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'nominations'));
    
    try {
      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const nominationsByCategory: { [key: number]: { [key: string]: number } } = {};
        
        // Initialize all categories
        categories.forEach(cat => {
          nominationsByCategory[cat.id] = {};
        });

        querySnapshot.forEach((doc) => {
          const data = doc.data();
          const nominations = data.nominations || {};

          // Process each nomination in the submission
          Object.entries(nominations).forEach(([categoryId, nominee]) => {
            const catId = parseInt(categoryId);
            if (!nominationsByCategory[catId][nominee as string]) {
              nominationsByCategory[catId][nominee as string] = 0;
            }
            nominationsByCategory[catId][nominee as string]++;
          });
        });
        
        const formattedResults = Object.entries(nominationsByCategory).map(([categoryId, nominations]) => ({
          categoryId: parseInt(categoryId),
          nominations
        }));
        
        setResults(formattedResults);
        setError(null);
      }, (err) => {
        console.error('Error in Firestore subscription:', err);
        setError('Failed to load nomination results. Please try again later.');
      });

      return () => unsubscribe();
    } catch (err) {
      console.error('Error setting up Firestore listener:', err);
      setError('Failed to connect to the database. Please try again later.');
    } finally {
      setLoading(false);
    }
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center text-red-600">
          <p>{error}</p>
        </div>
      </div>
    );
  }

  const selectedResults = results.find(r => r.categoryId === selectedCategory);
  const chartData = selectedResults ? Object.entries(selectedResults.nominations)
    .map(([name, count]) => ({
      name,
      votes: count
    }))
    .sort((a, b) => b.votes - a.votes) : [];

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="mb-6">
        <label htmlFor="category" className="block text-sm font-medium text-gray-700">
          Select Category
        </label>
        <select
          id="category"
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(parseInt(e.target.value))}
          className="mt-1 block w-full rounded-md bg-slate-50 border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 h-12 p-2"
        >
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.title}
            </option>
          ))}
        </select>
      </div>

      {chartData.length > 0 ? (
        <>
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="votes" fill="#3B82F6" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-6">
            <h3 className="text-lg font-medium text-gray-900">Results Summary</h3>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Nominee
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Votes
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {chartData.map((row) => (
                    <tr key={row.name}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.votes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="text-center py-8 text-gray-500">
          No nominations recorded for this category yet.
        </div>
      )}
    </div>
  );
};

export default ResultsChart;
