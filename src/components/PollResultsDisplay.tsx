'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { getAllEmployees } from '../lib/employeesFirestore';
import type { Poll, PollVote, Employee } from '../types';

interface PollResultsDisplayProps {
  poll: Poll;
  votes: PollVote[];
}

export default function PollResultsDisplay({ poll, votes }: PollResultsDisplayProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);

  useEffect(() => {
    async function load() {
      if (poll.type === 'staff_nomination') {
        setLoadingEmployees(true);
        try {
          const list = await getAllEmployees(poll.tenantId);
          setEmployees(list);
        } catch (err) {
          console.error('Failed to load employees for results mapping:', err);
        } finally {
          setLoadingEmployees(false);
        }
      }
    }
    load();
  }, [poll.tenantId, poll.type]);

  // Create employee map for fast lookup
  const employeeLookup = useMemo(() => {
    const map: Record<string, Employee> = {};
    employees.forEach(emp => {
      map[String(emp['Employee ID'])] = emp;
    });
    return map;
  }, [employees]);

  // Aggregate votes by questionId and optionId
  const aggregatedResults = useMemo(() => {
    const results: Record<string, { total: number; options: Record<string, number> }> = {};

    // Initialize map with all options (even if 0 votes)
    poll.questions.forEach(q => {
      results[q.id] = {
        total: 0,
        options: {},
      };
      q.options.forEach(opt => {
        results[q.id].options[opt] = 0;
      });
    });

    // Populate counts
    votes.forEach(vote => {
      if (results[vote.questionId]) {
        // If option exists in our map, increment it
        if (results[vote.questionId].options[vote.optionId] !== undefined) {
          results[vote.questionId].options[vote.optionId]++;
          results[vote.questionId].total++;
        }
      }
    });

    return results;
  }, [poll.questions, votes]);

  // Determine winner for staff nominations
  const staffNominationWinner = useMemo(() => {
    if (poll.type !== 'staff_nomination') return null;
    const nominationQ = poll.questions.find(q => q.id === 'nomination_question');
    if (!nominationQ) return null;

    const qResults = aggregatedResults[nominationQ.id];
    if (!qResults || qResults.total === 0) return null;

    let maxVotes = -1;
    let winnerId = '';
    let isTie = false;

    Object.entries(qResults.options).forEach(([optId, count]) => {
      if (count > maxVotes) {
        maxVotes = count;
        winnerId = optId;
        isTie = false;
      } else if (count === maxVotes && maxVotes > 0) {
        isTie = true;
      }
    });

    if (winnerId && maxVotes > 0 && !isTie) {
      const emp = employeeLookup[winnerId];
      return {
        id: winnerId,
        name: emp ? emp.Employee : `Employee ${winnerId}`,
        role: emp ? emp.Role : '',
        votes: maxVotes,
      };
    }
    return null;
  }, [poll.type, poll.questions, aggregatedResults, employeeLookup]);

  return (
    <div className="space-y-6">
      {/* Staff Nomination Winner Highlight */}
      {poll.type === 'staff_nomination' && staffNominationWinner && (
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl p-4 sm:p-6 shadow-md text-center relative overflow-hidden">
          <div className="absolute -right-4 -bottom-4 opacity-15 transform rotate-12 pointer-events-none">
            <svg className="w-32 h-32 sm:w-36 sm:h-36" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          </div>
          <span className="inline-block text-xxs sm:text-xs uppercase font-extrabold tracking-wider bg-white/20 px-3 py-1 rounded-full mb-2">
            Current Leader 🏆
          </span>
          <h3 className="text-xl sm:text-2xl font-black mb-1 break-words">{staffNominationWinner.name}</h3>
          {staffNominationWinner.role && (
            <p className="text-purple-100 text-xs sm:text-sm mb-3 break-words">{staffNominationWinner.role}</p>
          )}
          <p className="text-xs font-medium text-purple-200">
            Leading with <strong className="text-white text-sm sm:text-base">{staffNominationWinner.votes}</strong> votes
          </p>
        </div>
      )}

      {/* Questions Results List */}
      <div className="space-y-5">
        {poll.questions.map((q, qIndex) => {
          const qRes = aggregatedResults[q.id];
          const totalVotes = qRes ? qRes.total : 0;

          // Helper to get sorted options for cleaner display
          const sortedOptions = Object.entries(qRes?.options || {}).sort((a, b) => b[1] - a[1]);

          return (
            <div key={q.id} className="border border-gray-100 rounded-xl p-4 sm:p-6 space-y-4 shadow-sm bg-white">
              <div>
                <h4 className="font-bold text-gray-900 text-sm sm:text-base break-words">
                  {poll.type === 'staff_nomination' ? 'Staff Nomination Voting' : `Q${qIndex + 1}: ${q.question}`}
                </h4>
                <p className="text-xs text-gray-400 mt-1">
                  Total Votes cast: <strong className="text-gray-700">{totalVotes}</strong>
                </p>
              </div>

              <div className="space-y-3.5 mt-4">
                {sortedOptions.map(([optId, count]) => {
                  const percent = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                  
                  // Label display
                  let optionLabel = optId;
                  let optionSubLabel = '';
                  
                  if (poll.type === 'staff_nomination') {
                    const emp = employeeLookup[optId];
                    if (emp) {
                      optionLabel = emp.Employee;
                      optionSubLabel = emp.Role ? `${emp.Role}` : 'Staff';
                      if (emp['Reporting To'] && emp['Reporting To'] !== '—') {
                        optionSubLabel += ` · Dept: ${emp['Reporting To']}`;
                      }
                    } else if (loadingEmployees) {
                      optionLabel = 'Loading employee details...';
                    } else {
                      optionLabel = `Nominee #${optId}`;
                    }
                  }

                  return (
                    <div key={optId} className="space-y-1.5">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between text-xs font-semibold text-gray-700 gap-1">
                        <div className="min-w-0 break-words flex-1">
                          <span>{optionLabel}</span>
                          {optionSubLabel && (
                            <span className="text-gray-400 font-normal ml-1 sm:ml-2">({optionSubLabel})</span>
                          )}
                        </div>
                        <span className="font-bold text-gray-900 shrink-0 self-end sm:self-auto text-xxs sm:text-xs bg-gray-50 sm:bg-transparent px-2 py-0.5 sm:p-0 rounded">
                          {count} {count === 1 ? 'vote' : 'votes'} ({percent}%)
                        </span>
                      </div>
                      <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                        <div
                          className="bg-purple-600 h-2.5 rounded-full transition-all duration-500"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
