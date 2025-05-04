import React, { useEffect, useState } from 'react';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { motion } from 'framer-motion';
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

// Gradient colors for the bars
const gradientColors = [
  { start: '#8884d8', end: '#6b46c1' }, // Purple
  { start: '#4f46e5', end: '#3730a3' }, // Indigo
  { start: '#3b82f6', end: '#1d4ed8' }, // Blue
  { start: '#0ea5e9', end: '#0369a1' }, // Sky
  { start: '#06b6d4', end: '#0e7490' }, // Cyan
];

// Animation variants for framer-motion
const containerVariants = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1,
    transition: { 
      staggerChildren: 0.1,
      duration: 0.6 
    }
  }
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: { 
    y: 0, 
    opacity: 1,
    transition: { 
      type: 'spring', 
      stiffness: 100 
    }
  }
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-4 border border-gray-200 shadow-lg rounded-lg">
        <p className="font-medium text-gray-800">{label}</p>
        <p className="text-purple-600 font-bold">{`${payload[0].value} votes`}</p>
      </div>
    );
  }
  return null;
};

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
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 rounded-lg p-6">
        <div className="text-center text-red-600">
          <p>{error}</p>
        </div>
      </div>
    );
  }

  const selectedResults = results.find(r => r.categoryId === selectedCategory);
  const chartData = selectedResults ? Object.entries(selectedResults.nominations)
    .map(([name, count], index) => ({
      name,
      votes: count,
      color: gradientColors[index % gradientColors.length]
    }))
    .sort((a, b) => b.votes - a.votes)
    .slice(0, 10) : []; // Limit to top 10 results

  return (
    <motion.div 
      className="space-y-8"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.div 
        className="mb-6" 
        variants={itemVariants}
      >
        <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-2">
          Select Award Category
        </label>
        <div className="relative">
          <select
            id="category"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(parseInt(e.target.value))}
            className="block w-full rounded-lg bg-white border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 h-12 pl-4 pr-10 appearance-none"
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.title}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
            <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </div>
        </div>
      </motion.div>

      {chartData.length > 0 ? (
        <motion.div variants={itemVariants}>
          <div className="bg-white p-4 rounded-lg shadow-sm mb-8">
            <div className="h-96">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  margin={{ top: 20, right: 30, left: 20, bottom: 70 }}
                  barSize={35}
                >
                  <defs>
                    {chartData.map((entry, index) => (
                      <linearGradient
                        key={`gradient-${index}`}
                        id={`gradient-${index}`}
                        x1="0" y1="0" x2="0" y2="1"
                      >
                        <stop offset="0%" stopColor={entry.color.start} stopOpacity={0.8} />
                        <stop offset="100%" stopColor={entry.color.end} stopOpacity={1} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="name" 
                    angle={-45} 
                    textAnchor="end" 
                    height={70} 
                    tick={{ fontSize: 12, fill: '#4b5563' }}
                    tickLine={false}
                  />
                  <YAxis 
                    allowDecimals={false} 
                    tick={{ fontSize: 12, fill: '#4b5563' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend 
                    wrapperStyle={{ 
                      paddingTop: '20px', 
                      fontSize: '14px' 
                    }}
                  />
                  <Bar 
                    dataKey="votes" 
                    name="Number of Votes" 
                    radius={[4, 4, 0, 0]}
                    animationDuration={1500}
                  >
                    {chartData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={`url(#gradient-${index})`} 
                      />
                    ))}
                    <LabelList 
                      dataKey="votes" 
                      position="top" 
                      fill="#4b5563" 
                      fontSize={12} 
                      fontWeight="bold" 
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <motion.div 
            className="overflow-hidden rounded-lg shadow ring-1 ring-black ring-opacity-5"
            variants={itemVariants}
          >
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rank
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nominee
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Votes
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Percentage
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {chartData.map((row, index) => {
                  const totalVotes = chartData.reduce((sum, entry) => sum + entry.votes, 0);
                  const percentage = totalVotes > 0 ? Math.round((row.votes / totalVotes) * 100) : 0;
                  
                  return (
                    <tr key={row.name} className={index < 3 ? 'bg-purple-50' : ''}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        {index < 3 ? (
                          <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full ${
                            index === 0 ? 'bg-yellow-100 text-yellow-800' : 
                            index === 1 ? 'bg-gray-100 text-gray-800' : 
                            'bg-amber-100 text-amber-800'
                          }`}>
                            {index + 1}
                          </span>
                        ) : (
                          index + 1
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {row.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-bold">
                        {row.votes}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex items-center">
                          <div className="w-full bg-gray-200 rounded-full h-2.5 mr-2 max-w-[100px]">
                            <div 
                              className="bg-purple-600 h-2.5 rounded-full" 
                              style={{ width: `${percentage}%` }}
                            ></div>
                          </div>
                          <span>{percentage}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </motion.div>
        </motion.div>
      ) : (
        <motion.div 
          className="text-center py-12 rounded-lg bg-gray-50 border border-dashed border-gray-300"
          variants={itemVariants}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
          </svg>
          <p className="text-gray-500 text-lg">No nominations recorded for this category yet.</p>
          <p className="text-gray-400 mt-2">Check back later when votes are submitted.</p>
        </motion.div>
      )}
    </motion.div>
  );
};

export default ResultsChart;
