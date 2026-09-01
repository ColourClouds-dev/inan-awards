'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTenant } from '../contexts/TenantContext';
import { submitPollResponse } from '../lib/pollsFirestore';
import { getAllEmployees } from '../lib/employeesFirestore';
import { collection, query, where, getDocs, getDoc, doc as firestoreDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import Button from './Button';
import Toast from './Toast';
import { useToast } from '../hooks/useToast';
import PollResultsDisplay from './PollResultsDisplay';
import { usePollResults } from '../hooks/usePollResults';
import DOMPurify from 'dompurify';
import type { Poll, PollResponse, PollVote, Employee } from '../types';

/** Safely render stored HTML from the RichTextEditor. Falls back to plain text on SSR. */
function SafeHtml({ html, className }: { html: string; className?: string }) {
  if (typeof window === 'undefined') {
    return <p className={className}>{html.replace(/<[^>]+>/g, '')}</p>;
  }
  return (
    <div
      className={`rte-content ${className ?? ''}`}
      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }}
    />
  );
}

interface PollVotingInterfaceProps {
  poll: Poll;
}

export default function PollVotingInterface({ poll }: PollVotingInterfaceProps) {
  const router = useRouter();
  const { currentUid, role, tenantId, isLoading: tenantLoading } = useTenant();
  const { toasts, showToast, dismissToast } = useToast();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [voterEmployee, setVoterEmployee] = useState<Employee | null>(null);
  const [checkingVoted, setCheckingVoted] = useState(true);
  const [hasVoted, setHasVoted] = useState(false);
  const [selections, setSelections] = useState<Record<string, string | string[]>>({});
  const [submitting, setSubmitting] = useState(false);

  // Real-time votes for post-vote display
  const { results: votesList } = usePollResults(poll.id, poll.tenantId);

  // Load employees list and voter's corresponding employee record
  useEffect(() => {
    async function loadData() {
      if (!tenantId) return;
      try {
        const empList = await getAllEmployees(tenantId);
        setEmployees(empList);

        // Find current logged in user's employee record by email
        const currentUserEmail = role && typeof window !== 'undefined' ? sessionStorage.getItem('verify_email') || '' : '';
        const firebaseUserEmail = typeof window !== 'undefined' ? localStorage.getItem('user_email') || '' : '';
        
        const userEmail = firebaseUserEmail || currentUserEmail;
        if (userEmail) {
          const match = empList.find(emp => emp.Email.toLowerCase() === userEmail.toLowerCase());
          if (match) setVoterEmployee(match);
        }
      } catch (err) {
        console.error('Failed to load employees for voting page:', err);
      }
    }
    loadData();
  }, [tenantId, role]);

  // Query Firestore to verify if the user has already voted
  useEffect(() => {
    async function checkExistingVote() {
      if (tenantLoading) return;
      if (!currentUid) {
        setCheckingVoted(false);
        return;
      }

      // Check localStorage first
      if (typeof window !== 'undefined' && localStorage.getItem(`submitted_poll_${poll.id}`)) {
        if (!poll.allowMultipleVotes) {
          setHasVoted(true);
          setCheckingVoted(false);
          return;
        }
      }

      try {
        const q = query(
          collection(db, 'poll-responses'),
          where('pollId', '==', poll.id),
          where('voterUid', '==', currentUid)
        );
        const snap = await getDocs(q);
        if (!snap.empty && !poll.allowMultipleVotes) {
          setHasVoted(true);
          if (typeof window !== 'undefined') {
            localStorage.setItem(`submitted_poll_${poll.id}`, '1');
          }
        }
      } catch (err) {
        console.error('Failed to check existing votes:', err);
      } finally {
        setCheckingVoted(false);
      }
    }
    checkExistingVote();
  }, [currentUid, poll.id, poll.allowMultipleVotes, tenantLoading]);

  // Map employee list for nominees lookup
  const nomineeEmployees = useMemo(() => {
    if (poll.type !== 'staff_nomination') return [];
    return employees.filter(emp => poll.nominees?.includes(String(emp['Employee ID'])));
  }, [employees, poll.nominees, poll.type]);

  const handleSelectOption = (questionId: string, optionId: string, isMulti: boolean) => {
    const current = selections[questionId];
    if (isMulti) {
      const arr = Array.isArray(current) ? [...current] : [];
      if (arr.includes(optionId)) {
        setSelections({ ...selections, [questionId]: arr.filter(o => o !== optionId) });
      } else {
        setSelections({ ...selections, [questionId]: [...arr, optionId] });
      }
    } else {
      setSelections({ ...selections, [questionId]: optionId });
    }
  };

  const handleVoteSubmit = async () => {
    if (!currentUid) {
      showToast('You must be signed in to vote.', 'error');
      return;
    }

    // Validate that all required questions are answered
    for (const q of poll.questions) {
      if (q.required) {
        const val = selections[q.id];
        if (!val || (Array.isArray(val) && val.length === 0)) {
          showToast(`Please answer the question: "${q.question}"`, 'error');
          return;
        }
      }
    }

    setSubmitting(true);
    try {
      // Force-refresh the token and read back claims to verify tenantId is set.
      // getIdToken(true) alone doesn't let us inspect the claim value — we need
      // getIdTokenResult(true) so we can validate before the Firestore write.
      if (!auth.currentUser) {
        showToast('Your session has expired. Please sign in again.', 'error');
        setSubmitting(false);
        return;
      }
      const tokenResult = await auth.currentUser.getIdTokenResult(true);
      const claimTenantId = tokenResult.claims['tenantId'] as string | undefined;

      if (!claimTenantId) {
        showToast('Your account isn\'t fully set up yet. Please sign out and sign back in.', 'error');
        setSubmitting(false);
        return;
      }

      if (claimTenantId !== poll.tenantId) {
        showToast('You are not a member of the organisation this poll belongs to.', 'error');
        setSubmitting(false);
        return;
      }
      // Build response map
      const responsesMap: Record<string, string | string[]> = {};
      poll.questions.forEach(q => {
        responsesMap[q.id] = selections[q.id] || '';
      });

      // Try to find voter's employeeId using their email if not resolved yet
      let finalEmployeeId = voterEmployee ? String(voterEmployee['Employee ID']) : undefined;
      
      // If we don't have finalEmployeeId, fetch tenant-admins email and look up
      if (!finalEmployeeId) {
        const userDoc = await getDoc(firestoreDoc(db, 'tenant-admins', currentUid));
        if (userDoc.exists()) {
          const email = userDoc.data().email;
          if (email) {
            const match = employees.find(emp => emp.Email.toLowerCase() === email.toLowerCase());
            if (match) finalEmployeeId = String(match['Employee ID']);
          }
        }
      }

      const responsePayload: Omit<PollResponse, 'id' | 'submittedAt'> = {
        pollId: poll.id,
        voterUid: currentUid,
        ...(finalEmployeeId && { employeeId: finalEmployeeId }),
        responses: responsesMap,
        tenantId: poll.tenantId,
      };

      // Build individual votes payload for real-time counting
      const votesPayload: Omit<PollVote, 'id' | 'submittedAt'>[] = [];
      Object.entries(selections).forEach(([questionId, optVal]) => {
        if (Array.isArray(optVal)) {
          optVal.forEach(optId => {
            votesPayload.push({
              pollId: poll.id,
              questionId,
              optionId: optId,
              voterUid: currentUid,
              ...(finalEmployeeId && { employeeId: finalEmployeeId }),
              tenantId: poll.tenantId,
            });
          });
        } else if (optVal) {
          votesPayload.push({
            pollId: poll.id,
            questionId,
            optionId: optVal,
            voterUid: currentUid,
            ...(finalEmployeeId && { employeeId: finalEmployeeId }),
            tenantId: poll.tenantId,
          });
        }
      });

      await submitPollResponse(responsePayload, votesPayload);
      if (typeof window !== 'undefined') {
        localStorage.setItem(`submitted_poll_${poll.id}`, '1');
      }
      setHasVoted(true);
      showToast('Thank you! Your vote has been recorded.', 'success');
    } catch (err) {
      console.error('Failed to submit poll response:', err);
      showToast('Failed to record vote. Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (tenantLoading || checkingVoted) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
      </div>
    );
  }

  // Not signed in view
  if (!currentUid) {
    return (
      <div className="text-center bg-white border border-gray-100 rounded-2xl shadow-sm p-6 sm:p-8 max-w-md mx-auto space-y-4">
        <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto text-purple-600">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h3 className="font-bold text-gray-800 text-lg">Sign In Required</h3>
        <p className="text-sm text-gray-500">
          Only authenticated organization members are authorized to participate in this poll.
        </p>
        <Button onClick={() => router.push(`/login?redirect=/poll/${poll.id}`)}>
          Sign In to Vote
        </Button>
      </div>
    );
  }

  // Already voted view
  if (hasVoted) {
    const canSeeResults = poll.showResults === 'always' || poll.showResults === 'after_voting';
    return (
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5 sm:p-8 max-w-xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto text-green-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="font-black text-gray-900 text-xl">Thank You for Voting!</h3>
          <p className="text-sm text-gray-500">Your choice has been securely recorded.</p>
        </div>

        {canSeeResults ? (
          <div className="border-t pt-6 space-y-4">
            <h4 className="font-bold text-xs sm:text-sm text-gray-500 uppercase tracking-wider text-center">Poll Results</h4>
            <PollResultsDisplay poll={poll} votes={votesList} />
          </div>
        ) : (
          <div className="bg-gray-50 rounded-xl p-4 text-center text-xs text-gray-400">
            Results of this poll are kept private by the administrator.
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200/80 rounded-2xl shadow-sm p-4 sm:p-6 md:p-8 max-w-xl mx-auto space-y-6">
      <Toast toasts={toasts} onDismiss={dismissToast} />

      <div>
        <span className={`inline-flex px-2 py-0.5 rounded text-xxs font-extrabold uppercase tracking-wide mb-2 ${poll.type === 'staff_nomination' ? 'bg-indigo-100 text-indigo-800' : 'bg-amber-100 text-amber-800'}`}>
          {poll.type === 'staff_nomination' ? 'Staff Nomination' : 'Opinion Poll'}
        </span>
        <h2 className="text-xl sm:text-2xl font-black text-gray-900 leading-tight break-words">{poll.title}</h2>
        {poll.description && (
          <SafeHtml html={poll.description} className="text-xs sm:text-sm text-gray-500 mt-2 break-words leading-relaxed" />
        )}
      </div>

      <div className="space-y-6 border-t pt-6">
        {poll.questions.map((q, qIndex) => {
          const isMulti = q.type === 'multiple_choice';
          const selected = selections[q.id];

          return (
            <div key={q.id} className="space-y-3">
              <h4 className="font-bold text-gray-900 text-sm break-words">
                {poll.type === 'staff_nomination' ? 'Select nominee' : `${qIndex + 1}. ${q.question}`}
                {q.required && <span className="text-red-500 ml-1">*</span>}
              </h4>

              {poll.type === 'staff_nomination' ? (
                // Nominee Options (Plain Text: Name + Department)
                <div className="space-y-2.5">
                  {nomineeEmployees.map(emp => {
                    const empIdStr = String(emp['Employee ID']);
                    const isSelected = selected === empIdStr;
                    
                    let deptStr = emp['Reporting To'] && emp['Reporting To'] !== '—' 
                      ? `Department: ${emp['Reporting To']}` 
                      : '';
                    if (emp.Role) {
                      deptStr = deptStr ? `${emp.Role} · ${deptStr}` : emp.Role;
                    }

                    return (
                      <button
                        key={empIdStr}
                        onClick={() => handleSelectOption(q.id, empIdStr, false)}
                        className={`w-full text-left px-4 py-3 border rounded-xl flex items-center justify-between hover:bg-purple-50/30 transition-all ${isSelected ? 'border-purple-600 bg-purple-50/20 ring-1 ring-purple-600' : 'border-gray-200'}`}
                      >
                        <div className="text-sm min-w-0 flex-1 mr-3">
                          <span className="font-bold text-gray-900 block break-words">{emp.Employee}</span>
                          {deptStr && <span className="text-xs text-gray-400 mt-0.5 block break-words">{deptStr}</span>}
                        </div>
                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${isSelected ? 'border-purple-600 bg-purple-600 text-white' : 'border-gray-300 bg-white'}`}>
                          {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                // General Opinion Poll Options
                <div className="space-y-2.5">
                  {q.options.map(opt => {
                    const isSelected = isMulti 
                      ? (Array.isArray(selected) && selected.includes(opt))
                      : selected === opt;

                    return (
                      <button
                        key={opt}
                        onClick={() => handleSelectOption(q.id, opt, isMulti)}
                        className={`w-full text-left px-4 py-3.5 border rounded-xl flex items-center justify-between hover:bg-purple-50/30 transition-all ${isSelected ? 'border-purple-600 bg-purple-50/20 ring-1 ring-purple-600' : 'border-gray-200'}`}
                      >
                        <span className="text-sm font-semibold text-gray-800 min-w-0 flex-1 mr-3 break-words">{opt}</span>
                        <div className={`flex items-center justify-center shrink-0 ${isMulti ? 'w-5 h-5 rounded border' : 'w-5 h-5 rounded-full border'} ${isSelected ? 'border-purple-600 bg-purple-600 text-white' : 'border-gray-300 bg-white'}`}>
                          {isSelected && (
                            isMulti ? (
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            ) : (
                              <div className="w-2 h-2 rounded-full bg-white" />
                            )
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="border-t pt-5 flex justify-end">
        <Button
          onClick={handleVoteSubmit}
          disabled={submitting}
          isLoading={submitting}
          loadingText="Recording vote..."
          fullWidth={false}
          className="w-full sm:w-auto"
        >
          Submit Vote
        </Button>
      </div>
    </div>
  );
}
