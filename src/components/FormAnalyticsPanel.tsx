'use client';

import React from 'react';
import type { FeedbackForm, FeedbackResponse, ResponseTag } from '../types';

interface FormAnalyticsPanelProps {
  form: FeedbackForm;
  responses: FeedbackResponse[];
}

const tagColorClasses: Record<string, string> = {
  green: 'bg-green-100 text-green-800',
  yellow: 'bg-yellow-100 text-yellow-800',
  red: 'bg-red-100 text-red-800',
  blue: 'bg-blue-100 text-blue-800',
  gray: 'bg-gray-100 text-gray-600',
};

function TagBadge({ tag }: { tag: ResponseTag }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${tagColorClasses[tag.color] ?? 'bg-gray-100 text-gray-600'}`}>
      {tag.label}
    </span>
  );
}

export default function FormAnalyticsPanel({ form, responses }: FormAnalyticsPanelProps) {
  const formResponses = responses.filter(r => r.formId === form.id);
  if (formResponses.length === 0) return <p className="text-sm text-gray-400 italic">No responses yet to analyse.</p>;

  // Time stats
  const timings = formResponses.map(r => r.timeSpentSeconds).filter((t): t is number => t !== undefined);
  const avgTime = timings.length ? Math.round(timings.reduce((a, b) => a + b, 0) / timings.length) : null;

  // Sentiment counts
  const sentimentCounts: Record<string, number> = {};
  // Completion counts
  const completionCounts: Record<string, number> = {};
  // Custom tag counts
  const customTagCounts: Record<string, number> = {};
  // Negative responses
  const negativeResponses: FeedbackResponse[] = [];

  for (const r of formResponses) {
    if (!r.tags) continue;
    for (const tag of r.tags) {
      if (tag.type === 'sentiment') {
        sentimentCounts[tag.label] = (sentimentCounts[tag.label] ?? 0) + 1;
        if (tag.label === 'Negative') negativeResponses.push(r);
      }
      if (tag.type === 'completion') {
        completionCounts[tag.label] = (completionCounts[tag.label] ?? 0) + 1;
      }
      if (tag.type === 'custom') {
        customTagCounts[tag.label] = (customTagCounts[tag.label] ?? 0) + 1;
      }
    }
  }

  const formatTime = (s: number) => `${Math.floor(s / 60)}m ${s % 60}s`;

  return (
    <div className="space-y-5">
      {/* Time */}
          {avgTime !== null && (
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Avg Completion Time</h4>
              <p className="text-2xl font-bold text-purple-600">{formatTime(avgTime)}</p>
              <div className="flex gap-3 mt-2 flex-wrap">
                {['Fast (<1 min)', 'Normal (1-5 min)', 'Slow (>5 min)'].map(label => {
                  const count = formResponses.filter(r => r.tags?.some(t => t.type === 'time' && t.label === label)).length;
                  return count > 0 ? (
                    <span key={label} className="text-xs text-gray-500">{label}: <strong>{count}</strong></span>
                  ) : null;
                })}
              </div>
            </div>
          )}

          {/* Sentiment */}
          {Object.keys(sentimentCounts).length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Sentiment</h4>
              <div className="flex gap-2 flex-wrap">
                {Object.entries(sentimentCounts).map(([label, count]) => {
                  const color = label === 'Positive' ? 'green' : label === 'Negative' ? 'red' : 'yellow';
                  return (
                    <span key={label} className={`px-3 py-1 rounded-full text-sm font-medium ${tagColorClasses[color]}`}>
                      {label}: {count}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Completion */}
          {Object.keys(completionCounts).length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Completion</h4>
              <div className="flex gap-2 flex-wrap">
                {Object.entries(completionCounts).map(([label, count]) => (
                  <span key={label} className={`px-3 py-1 rounded-full text-sm font-medium ${label === 'Complete' ? tagColorClasses.green : tagColorClasses.yellow}`}>
                    {label}: {count}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Custom tags */}
          {Object.keys(customTagCounts).length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Custom Tags</h4>
              <div className="flex gap-2 flex-wrap">
                {Object.entries(customTagCounts).map(([label, count]) => (
                  <span key={label} className="px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                    {label}: {count}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Flagged negative responses */}
          {negativeResponses.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-red-500 uppercase mb-2">⚠ Flagged Responses ({negativeResponses.length})</h4>
              <div className="space-y-2">
                {negativeResponses.map(r => {
                  const submittedAt = r.submittedAt instanceof Date
                    ? r.submittedAt.toLocaleString()
                    : typeof r.submittedAt === 'object' && 'toDate' in r.submittedAt
                    ? (r.submittedAt as any).toDate().toLocaleString()
                    : String(r.submittedAt);
                  return (
                    <div key={r.id} className="bg-red-50 border border-red-200 rounded p-3 text-sm">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-gray-500 text-xs">{submittedAt}</span>
                        <div className="flex gap-1 flex-wrap">
                          {r.tags?.map((tag, i) => <TagBadge key={i} tag={tag} />)}
                        </div>
                      </div>
                      <div className="text-gray-700 text-xs space-y-0.5">
                        {Object.entries(r.responses).slice(0, 3).map(([qId, val]) => (
                          <div key={qId}><span className="font-medium">{qId.slice(0, 8)}…</span>: {String(val)}</div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
  );
}
