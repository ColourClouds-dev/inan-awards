'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useTenant } from '../../../../contexts/TenantContext';
import { getAllPolls, deletePoll } from '../../../../lib/pollsFirestore';
import Button from '../../../../components/Button';
import Input from '../../../../components/Input';
import Modal from '../../../../components/Modal';
import Toast from '../../../../components/Toast';
import { useToast } from '../../../../hooks/useToast';
import PollStatusToggle from '../../../../components/PollStatusToggle';
import type { Poll } from '../../../../types';

/** Strip HTML tags to plain text for the card description preview */
function stripHtml(html: string): string {
  if (typeof window === 'undefined') return html.replace(/<[^>]+>/g, '');
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent || '';
}

export default function PollsListPage() {
  const { tenantId, isOwner, currentUid, isLoading: tenantLoading } = useTenant();
  const { toasts, showToast, dismissToast } = useToast();
  
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Delete modal states
  const [deleteTarget, setDeleteTarget] = useState<Poll | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadPolls = useCallback(async () => {
    if (!tenantId || tenantLoading) return;
    setLoading(true);
    try {
      const createdBy = isOwner ? undefined : (currentUid || undefined);
      const data = await getAllPolls(tenantId, createdBy);
      setPolls(data);
    } catch (err) {
      console.error('Failed to load polls:', err);
      showToast('Failed to load polls list.', 'error');
    } finally {
      setLoading(false);
    }
  }, [tenantId, tenantLoading, isOwner, currentUid, showToast]);

  useEffect(() => {
    loadPolls();
  }, [loadPolls]);

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deletePoll(deleteTarget.id);
      showToast('Poll deleted successfully.', 'success');
      setDeleteTarget(null);
      await loadPolls();
    } catch (err) {
      console.error('Failed to delete poll:', err);
      showToast('Failed to delete poll.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const filteredPolls = polls.filter(poll => {
    const matchesSearch = poll.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (poll.description || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' ? true : 
      statusFilter === 'active' ? poll.isActive : !poll.isActive;

    return matchesSearch && matchesStatus;
  });

  if (tenantLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" role="status" aria-label="Loading" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto p-4 sm:p-6">
      <Toast toasts={toasts} onDismiss={dismissToast} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-gray-900">Polls</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Manage opinion polls and Staff of the Month nominations.
          </p>
        </div>
        <Link href="/dashboard/feedback/polls/create" className="w-full sm:w-auto">
          <Button fullWidth={false} className="w-full sm:w-auto">Create Poll</Button>
        </Link>
      </div>

      {/* Search & Filter bar */}
      <div className="flex flex-col md:flex-row gap-3 justify-between items-stretch md:items-center bg-white p-3.5 sm:p-4 rounded-xl border border-gray-200/80 shadow-sm">
        <div className="flex-1 w-full md:max-w-md">
          <Input
            placeholder="Search polls by title or description..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${statusFilter === 'all' ? 'bg-purple-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            All Polls
          </button>
          <button
            onClick={() => setStatusFilter('active')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${statusFilter === 'active' ? 'bg-green-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            Active
          </button>
          <button
            onClick={() => setStatusFilter('inactive')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${statusFilter === 'inactive' ? 'bg-gray-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            Completed
          </button>
        </div>
      </div>

      {/* Poll list grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-44 skeleton-shimmer rounded-xl" />
          ))}
        </div>
      ) : filteredPolls.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200 p-6 sm:p-8 shadow-sm space-y-3">
          <h3 className="font-bold text-gray-700 text-base sm:text-lg">No Polls found</h3>
          <p className="text-xs sm:text-sm text-gray-500 max-w-sm mx-auto">Create a new poll to gather feedback or initiate a Staff of the Month vote.</p>
          <Link href="/dashboard/feedback/polls/create" className="inline-block pt-2">
            <Button fullWidth={false}>Create first Poll</Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {filteredPolls.map(poll => {
            const dateStr = poll.createdAt && 'seconds' in (poll.createdAt as any)
              ? new Date((poll.createdAt as any).seconds * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
              : poll.createdAt instanceof Date 
              ? poll.createdAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
              : String(poll.createdAt);

            return (
              <div key={poll.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6 hover:shadow-md transition-shadow flex flex-col justify-between min-h-[12.5rem]">
                <div>
                  <div className="flex justify-between items-start gap-2 mb-2">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xxs font-extrabold uppercase tracking-wide ${poll.type === 'staff_nomination' ? 'bg-indigo-100 text-indigo-800' : 'bg-amber-100 text-amber-800'}`}>
                      {poll.type === 'staff_nomination' ? 'Staff Nomination' : 'Opinion Poll'}
                    </span>
                    <span className={`inline-flex px-2 py-0.5 rounded text-xxs font-bold ${poll.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                      {poll.isActive ? 'Active' : 'Completed'}
                    </span>
                  </div>

                  <h3 className="font-bold text-gray-900 text-base break-words mb-1">
                    {poll.title}
                  </h3>
                  <p className="text-xs text-gray-500 line-clamp-2 mb-3 break-words">
                    {poll.description ? stripHtml(poll.description) : 'No description provided.'}
                  </p>
                </div>

                <div className="border-t pt-3.5 flex flex-wrap gap-2 justify-between items-center text-xs text-gray-400">
                  <span className="text-xxs sm:text-xs">Created {dateStr}</span>
                  <div className="flex items-center gap-2.5 shrink-0">
                    <PollStatusToggle
                      pollId={poll.id}
                      initialStatus={poll.isActive}
                      onToggle={() => loadPolls()}
                    />
                    
                    <div className="flex items-center gap-1.5">
                      <Link href={`/dashboard/feedback/polls/${poll.id}`} className="text-purple-600 hover:text-purple-800 font-bold px-1.5 py-1 rounded hover:bg-purple-50 transition-colors">
                        Results
                      </Link>
                      
                      <button
                        onClick={() => setDeleteTarget(poll)}
                        className="text-red-500 hover:text-red-700 transition-colors p-1.5 rounded hover:bg-red-50"
                        title="Delete Poll"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete confirmation modal */}
      <Modal
        isOpen={!!deleteTarget}
        variant="danger"
        title="Delete this Poll?"
        message={deleteTarget ? `Are you sure you want to delete the poll "${deleteTarget.title}"? All votes and responses submitted for it will be lost. This action is irreversible.` : ''}
        confirmLabel={deleting ? 'Deleting...' : 'Yes, delete poll'}
        cancelLabel="Cancel"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
