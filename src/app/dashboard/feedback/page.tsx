'use client';

import React, { useEffect, useState } from 'react';
import { collection, query, getDocs, orderBy, doc, setDoc, where } from 'firebase/firestore';
import { exportToCSV, formatFeedbackForCSV } from '../../../lib/exportToCSV';
import { QRCodeSVG } from 'qrcode.react';
import { db } from '../../../lib/firebase';
import FeedbackFormBuilder from '../../../components/FeedbackFormBuilder';
import Button from '../../../components/Button';
import type { FeedbackForm, FeedbackResponse } from '../../../types';

export default function FeedbackDashboardPage() {
  const [forms, setForms] = useState<FeedbackForm[]>([]);
  const [responses, setResponses] = useState<FeedbackResponse[]>([]);
  const [showBuilder, setShowBuilder] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showQR, setShowQR] = useState<{ id: string; url: string } | null>(null);
  const [sortBy, setSortBy] = useState<'date' | 'location'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [locationFilter, setLocationFilter] = useState<string>('all');

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch forms
        const formsQuery = query(
          collection(db, 'feedback-forms'),
          orderBy('createdAt', 'desc')
        );
        const formsSnapshot = await getDocs(formsQuery);
        const formsData = formsSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            ...data,
            id: doc.id,
            createdAt: data.createdAt?.toDate() || new Date()
          };
        }) as FeedbackForm[];
        setForms(formsData);

        // Fetch responses
        const responsesQuery = query(
          collection(db, 'feedback-responses'),
          orderBy('submittedAt', 'desc')
        );
        const responsesSnapshot = await getDocs(responsesQuery);
        const responsesData = responsesSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            ...data,
            id: doc.id,
            submittedAt: data.submittedAt?.toDate() || new Date()
          };
        }) as FeedbackResponse[];
        setResponses(responsesData);
      } catch (error) {
        console.error('Error fetching feedback data:', error);
        setError('Failed to load feedback data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleSaveForm = async (form: FeedbackForm) => {
    try {
      // Save with a specific ID instead of letting Firestore generate one
      const formRef = doc(collection(db, 'feedback-forms'), form.id);
      await setDoc(formRef, form);
      setForms([form, ...forms]);
      setShowBuilder(false);
    } catch (error) {
      console.error('Error saving form:', error);
      setError('Failed to save form');
    }
  };

  const getFormTitle = (formId: string) => {
    const form = forms.find(f => f.id === formId);
    return form?.title || 'Unknown Form';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (showBuilder) {
    return (
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Create Feedback Form</h1>
          <Button onClick={() => setShowBuilder(false)}>
            Cancel
          </Button>
        </div>
        <FeedbackFormBuilder onSave={handleSaveForm} />
      </div>
    );
  }

  if (showQR) {
    return (
      <div className="p-6">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md mx-auto text-center">
          <h2 className="text-2xl font-bold mb-2">Share Feedback Form</h2>
          <p className="text-gray-600 mb-6">Share this QR code or link with your customers</p>
          <div className="flex flex-col items-center space-y-4 mb-8">
            <QRCodeSVG value={showQR.url} size={200} />
            <p className="text-sm text-gray-600 break-all">{showQR.url}</p>
          </div>
          <div className="flex justify-center space-x-4">
            <Button onClick={() => navigator.clipboard.writeText(showQR.url)}>
              Copy Link
            </Button>
            <Button onClick={() => setShowQR(null)}>
              Close
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0">
        <h1 className="text-2xl font-bold">Feedback Management</h1>
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center space-x-4">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'date' | 'location')}
              className="rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 h-10 p-2"
            >
              <option value="date">Sort by Date</option>
              <option value="location">Sort by Location</option>
            </select>
            <button
              onClick={() => setSortOrder(order => order === 'asc' ? 'desc' : 'asc')}
              className="p-2 hover:bg-gray-100 rounded"
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </button>
            <select
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 h-10 p-2"
            >
              <option value="all">All Locations</option>
              <option value="Qaras Hotels: House 3">House 3</option>
              <option value="Qaras Hotels: Bluxton">Bluxton</option>
            </select>
          </div>
          <div className="flex space-x-4">
            <Button
             className="rounded-md h-10 text-sm"
              onClick={() => {
                const csvData = formatFeedbackForCSV(responses);
                exportToCSV(csvData, `feedback-responses-${new Date().toISOString().split('T')[0]}.csv`);
              }}
            >
              ExportCSV
            </Button>
            <Button 
             className="rounded-md h-10 text-sm"
             onClick={() => setShowBuilder(true)}>
              New Form
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Active Forms</h2>
          <div className="space-y-4">
            {forms.filter(form => form.isActive).map(form => (
              <div key={form.id} className="border rounded-lg p-4 hover:border-purple-500 transition-colors">
                <h3 className="font-medium">{form.title}</h3>
                <p className="text-sm text-gray-600 mb-3">{form.location}</p>
                <div className="flex items-center space-x-4">
                  <a
                    href={`/feedback/${form.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-purple-600 hover:text-purple-800 text-sm flex items-center"
                  >
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    View Form
                  </a>
                  <button
                    onClick={() => {
                      const url = `${window.location.origin}/feedback/${form.id}`;
                      setShowQR({ id: form.id, url });
                    }}
                    className="text-purple-600 hover:text-purple-800 text-sm flex items-center"
                  >
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                    </svg>
                    Show QR Code
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Recent Feedback</h2>
          <div className="space-y-4">
            {responses
              .filter(response => locationFilter === 'all' || response.location === locationFilter)
              .sort((a, b) => {
                if (sortBy === 'date') {
                  const dateA = a.submittedAt instanceof Date ? a.submittedAt : new Date(a.submittedAt.seconds * 1000);
                  const dateB = b.submittedAt instanceof Date ? b.submittedAt : new Date(b.submittedAt.seconds * 1000);
                  return sortOrder === 'asc' ? dateA.getTime() - dateB.getTime() : dateB.getTime() - dateA.getTime();
                } else {
                  return sortOrder === 'asc'
                    ? a.location.localeCompare(b.location)
                    : b.location.localeCompare(a.location);
                }
              })
              .map(response => (
              <div key={response.id} className="border rounded p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-medium">{getFormTitle(response.formId)}</h3>
                    <p className="text-sm text-gray-600">{response.location}</p>
                  </div>
                  <span className="text-sm text-gray-500">
                    {(response.submittedAt instanceof Date 
                      ? response.submittedAt
                      : new Date(response.submittedAt.seconds * 1000)).toLocaleDateString()}
                  </span>
                </div>
                <div className="mt-2 space-y-1">
                  {Object.entries(response.responses).map(([questionId, answer]) => (
                    <p key={questionId} className="text-sm">
                      <span className="text-gray-600">Response:</span>{' '}
                      {answer.toString()}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
