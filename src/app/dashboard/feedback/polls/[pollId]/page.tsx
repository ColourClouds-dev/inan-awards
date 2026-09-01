'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useTenant } from '../../../../../contexts/TenantContext';
import { getPollById, deletePoll } from '../../../../../lib/pollsFirestore';
import { usePollResults } from '../../../../../hooks/usePollResults';
import Button from '../../../../../components/Button';
import Modal from '../../../../../components/Modal';
import Toast from '../../../../../components/Toast';
import { useToast } from '../../../../../hooks/useToast';
import PollResultsDisplay from '../../../../../components/PollResultsDisplay';
import PollStatusToggle from '../../../../../components/PollStatusToggle';
import PollShareButton from '../../../../../components/PollShareButton';
import { exportPollResultsToExcel } from '../../../../../lib/pollsExport';

function stripHtml(html: string): string {
  if (typeof window === 'undefined') return html.replace(/<[^>]+>/g, '');
  return new DOMParser().parseFromString(html, 'text/html').body.textContent || '';
}
import type { Poll } from '../../../../../types';

export default function PollDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { tenantId, tenant, isLoading: tenantLoading } = useTenant();
  const { toasts, showToast, dismissToast } = useToast();

  const pollId = params.pollId as string;
  const [poll, setPoll] = useState<Poll | null>(null);
  const [loading, setLoading] = useState(true);

  // Real-time votes mapped from our custom hook
  const { results: votesList, loading: votesLoading } = usePollResults(pollId, tenantId);

  // Delete modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchPoll = async () => {
    if (!pollId) return;
    try {
      const data = await getPollById(pollId);
      if (!data) {
        showToast('Poll not found.', 'error');
        return;
      }
      setPoll(data);
    } catch (err) {
      console.error('Failed to load poll details:', err);
      showToast('Failed to load poll.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (pollId) fetchPoll();
  }, [pollId]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deletePoll(pollId);
      showToast('Poll deleted successfully.', 'success');
      setDeleteModalOpen(false);
      setTimeout(() => {
        router.push('/dashboard/feedback/polls');
      }, 1000);
    } catch (err) {
      console.error('Failed to delete poll:', err);
      showToast('Failed to delete poll.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleExport = () => {
    if (!poll) return;
    try {
      exportPollResultsToExcel(poll, votesList);
      showToast('Results exported to Excel successfully.', 'success');
    } catch (err) {
      console.error('Failed to export:', err);
      showToast('Export failed.', 'error');
    }
  };

  if (tenantLoading || loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" role="status" aria-label="Loading" />
      </div>
    );
  }

  if (!poll) {
    return (
      <div className="max-w-md mx-auto mt-12 text-center p-6 bg-white border rounded-xl shadow-sm space-y-4">
        <h3 className="font-bold text-gray-800 text-lg">Poll not found</h3>
        <p className="text-sm text-gray-500">The poll you are looking for does not exist or has been removed.</p>
        <Link href="/dashboard/feedback/polls" className="inline-block">
          <Button fullWidth={false}>Back to Polls</Button>
        </Link>
      </div>
    );
  }

  const dateCreated = poll.createdAt && 'seconds' in (poll.createdAt as any)
    ? new Date((poll.createdAt as any).seconds * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : poll.createdAt instanceof Date 
    ? poll.createdAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : String(poll.createdAt);

  const dateEnd = poll.endDate
    ? (poll.endDate && 'seconds' in (poll.endDate as any)
        ? new Date((poll.endDate as any).seconds * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        : poll.endDate instanceof Date 
        ? poll.endDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        : String(poll.endDate))
    : 'No end date set';

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-4 sm:p-6">
      <Toast toasts={toasts} onDismiss={dismissToast} />

      {/* Navigation breadcrumb */}
      <div className="flex items-center gap-2 text-xs font-semibold text-gray-400">
        <Link href="/dashboard/feedback/polls" className="hover:text-purple-600 transition-colors">
          Polls
        </Link>
        <span>/</span>
        <span className="text-gray-600 truncate max-w-[200px] sm:max-w-xs">{poll.title}</span>
      </div>

      {/* Title block */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 sm:p-6 rounded-xl border border-gray-200/80 shadow-sm">
        <div className="space-y-1.5 flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`inline-flex px-2 py-0.5 rounded text-xxs font-extrabold uppercase tracking-wide ${poll.type === 'staff_nomination' ? 'bg-indigo-100 text-indigo-800' : 'bg-amber-100 text-amber-800'}`}>
              {poll.type === 'staff_nomination' ? 'Staff Nomination' : 'Opinion Poll'}
            </span>
            <span className={`inline-flex px-2 py-0.5 rounded text-xxs font-bold ${poll.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
              {poll.isActive ? 'Active' : 'Completed'}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-gray-900 leading-tight break-words">
            {poll.title}
          </h1>
          {poll.description && (
            <p className="text-xs sm:text-sm text-gray-500 max-w-xl break-words leading-relaxed">{stripHtml(poll.description)}</p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-start sm:justify-end">
          <PollShareButton poll={poll} tenantDomain={tenant?.domain || 'localhost:3000'} />
          
          <Button
            variant="secondary"
            onClick={handleExport}
            disabled={votesList.length === 0}
            fullWidth={false}
          >
            Export Results
          </Button>
          
          <button
            onClick={() => setDeleteModalOpen(true)}
            className="p-2.5 border border-red-200 rounded-lg text-red-500 hover:bg-red-50 hover:border-red-300 transition-colors"
            title="Delete Poll"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Results Graph Column */}
        <div className="lg:col-span-2 space-y-6">
          {votesLoading ? (
            <div className="h-80 skeleton-shimmer rounded-xl" />
          ) : (
            <PollResultsDisplay poll={poll} votes={votesList} />
          )}
        </div>

        {/* Info Box Column */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200/80 p-4 sm:p-5 space-y-3.5 shadow-sm text-sm">
            <h3 className="font-bold text-gray-900 border-b pb-2 mb-2">Poll Information</h3>
            
            <div className="flex justify-between items-center text-xs sm:text-sm">
              <span className="text-gray-400">Created:</span>
              <span className="font-semibold text-gray-800 text-right">{dateCreated}</span>
            </div>

            <div className="flex justify-between items-center text-xs sm:text-sm">
              <span className="text-gray-400">Close Date:</span>
              <span className="font-semibold text-gray-800 text-right">{dateEnd}</span>
            </div>

            <div className="flex justify-between items-center text-xs sm:text-sm">
              <span className="text-gray-400">Poll Status:</span>
              <div className="flex items-center gap-2">
                <span className={`font-semibold ${poll.isActive ? 'text-green-600' : 'text-gray-500'}`}>
                  {poll.isActive ? 'Active' : 'Completed'}
                </span>
                <PollStatusToggle
                  pollId={poll.id}
                  initialStatus={poll.isActive}
                  onToggle={() => fetchPoll()}
                />
              </div>
            </div>

            <div className="flex justify-between items-center text-xs sm:text-sm">
              <span className="text-gray-400">Votes Cast:</span>
              <span className="font-extrabold text-purple-600 text-base">{votesList.length}</span>
            </div>

            <div className="flex justify-between items-center text-xs sm:text-sm">
              <span className="text-gray-400">Vote settings:</span>
              <span className="font-semibold text-gray-800 text-right">
                {poll.allowMultipleVotes ? 'Multiple choices' : 'Single choice only'}
              </span>
            </div>

            <div className="flex justify-between items-center text-xs sm:text-sm">
              <span className="text-gray-400">Results view:</span>
              <span className="font-semibold text-gray-800 uppercase text-xs">
                {poll.showResults.replace('_', ' ')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModalOpen}
        variant="danger"
        title="Delete this Poll?"
        message={`Are you sure you want to delete "${poll.title}"? This will permanently erase the poll and all of its ${votesList.length} votes. This action cannot be undone.`}
        confirmLabel={deleting ? 'Deleting...' : 'Delete Permanently'}
        cancelLabel="Cancel"
        onConfirm={handleDelete}
        onCancel={() => setDeleteModalOpen(false)}
      />
    </div>
  );
}
