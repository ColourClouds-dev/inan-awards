'use client';

import React, { useState } from 'react';

export default function ManageNominationsPage() {
  const [copied, setCopied] = useState(false);

  const nominationsUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/nominations`
    : '/nominations';

  const handleCopy = () => {
    navigator.clipboard.writeText(nominationsUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Manage Staff Nominations</h1>
        <p className="text-sm text-gray-500 mt-1">
          Share the nominations link with staff or configure the survey window in Settings.
        </p>
      </div>

      {/* Share link */}
      <div className="bg-white rounded-lg shadow p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-800">Nominations Link</h2>
        <p className="text-sm text-gray-600">
          Share this link with all staff members so they can submit their nominations.
          Each staff member can only submit once using their INAN company email.
        </p>
        <div className="flex items-center gap-3">
          <input
            readOnly
            value={nominationsUrl}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm bg-gray-50 text-gray-700"
          />
          <button
            onClick={handleCopy}
            className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-md hover:bg-purple-700"
          >
            {copied ? 'Copied!' : 'Copy Link'}
          </button>
        </div>
      </div>

      {/* Categories overview */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Award Categories</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            'Most Committed Staff of the Year',
            'Most Customer-Oriented Staff of the Year',
            'Employee of the Year',
            'Best Front Desk Staff of the Year',
            'Mr. Always Available',
            'Outstanding Performance',
            'Team Player',
            'Innovation and Creativity',
            'Years of Service',
            'Leadership and Mentorship',
          ].map((cat, i) => (
            <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-600 text-xs font-bold flex items-center justify-center flex-shrink-0">
                {i + 1}
              </span>
              <span className="text-sm text-gray-700">{cat}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Quick links */}
      <div className="flex gap-4">
        <a
          href="/dashboard/polls"
          className="px-4 py-2 bg-white border border-gray-300 text-sm font-medium rounded-md text-gray-700 hover:bg-gray-50"
        >
          ← View Results
        </a>
        <a
          href="/dashboard/settings"
          className="px-4 py-2 bg-white border border-gray-300 text-sm font-medium rounded-md text-gray-700 hover:bg-gray-50"
        >
          Configure Survey Window →
        </a>
      </div>
    </div>
  );
}
