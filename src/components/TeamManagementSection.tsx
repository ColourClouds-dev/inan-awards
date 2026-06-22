'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '../lib/firebase';
import Button from './Button';
import Input from './Input';
import Modal from './Modal';
import PaginationBar from './PaginationBar';
import { usePagination } from '../hooks/usePagination';
import type { TenantRole } from '../types';

interface TeamMember {
  uid: string;
  email: string;
  role: TenantRole;
  createdAt?: { seconds: number } | null;
}

interface Props {
  tenantId: string;
  showToast: (message: string, type: 'success' | 'error') => void;
}

const Section = ({ title, description, children }: {
  title: string;
  description: string;
  children: React.ReactNode;
}) => (
  <div className="bg-white shadow rounded-lg p-6 space-y-4">
    <div className="border-b pb-3">
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      <p className="text-sm text-gray-500 mt-1">{description}</p>
    </div>
    {children}
  </div>
);

function formatDate(ts?: { seconds: number } | null): string {
  if (!ts?.seconds) return '—';
  return new Date(ts.seconds * 1000).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

export default function TeamManagementSection({ tenantId, showToast }: Props) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [currentUid, setCurrentUid] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [roleTarget, setRoleTarget] = useState<TeamMember | null>(null);
  const [roleChanging, setRoleChanging] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<TeamMember | null>(null);
  const [removing, setRemoving] = useState(false);

  const { page, pageCount, paginated: paginatedMembers, goTo, next, prev } = usePagination(members, 5);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUid(user.uid);
        setToken(await user.getIdToken());
      }
    });
    return () => unsub();
  }, []);

  const loadMembers = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const snap = await getDocs(
        query(collection(db, 'tenant-admins'), where('tenantId', '==', tenantId))
      );
      const list: TeamMember[] = snap.docs.map(d => ({
        uid: d.id,
        email: d.data().email ?? '',
        role: (d.data().role ?? 'staff') as TenantRole,
        createdAt: d.data().createdAt ?? null,
      }));
      list.sort((a, b) => {
        if (a.role === b.role) return a.email.localeCompare(b.email);
        return a.role === 'owner' ? -1 : 1;
      });
      setMembers(list);
    } catch {
      showToast('Failed to load team members.', 'error');
    } finally {
      setLoading(false);
    }
  }, [tenantId, showToast]);

  useEffect(() => { loadMembers(); }, [loadMembers]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !token) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail.trim())) {
      showToast('Please enter a valid email address.', 'error');
      return;
    }
    setInviting(true);
    try {
      const res = await fetch('/api/invite-staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: inviteEmail.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send invitation.');
      showToast(`Invitation sent to ${inviteEmail.trim()}.`, 'success');
      setInviteEmail('');
    } catch (err: unknown) {
      showToast((err as Error).message || 'Failed to send invitation.', 'error');
    } finally {
      setInviting(false);
    }
  };

  const handleRoleChange = async () => {
    if (!roleTarget || !token) return;
    const newRole: TenantRole = roleTarget.role === 'owner' ? 'staff' : 'owner';
    setRoleChanging(true);
    try {
      const res = await fetch('/api/update-user-role', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ uid: roleTarget.uid, role: newRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update role.');
      showToast(`${roleTarget.email} is now ${newRole === 'owner' ? 'Admin' : 'Staff'}.`, 'success');
      setRoleTarget(null);
      await loadMembers();
    } catch (err: unknown) {
      showToast((err as Error).message || 'Failed to update role.', 'error');
    } finally {
      setRoleChanging(false);
    }
  };

  const handleRemove = async () => {
    if (!removeTarget || !token) return;
    setRemoving(true);
    try {
      const res = await fetch('/api/delete-user', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ uid: removeTarget.uid }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to remove member.');
      showToast(`${removeTarget.email} has been removed.`, 'success');
      setRemoveTarget(null);
      await loadMembers();
    } catch (err: unknown) {
      showToast((err as Error).message || 'Failed to remove member.', 'error');
    } finally {
      setRemoving(false);
    }
  };

  const roleLabel = (role: TenantRole) => role === 'owner' ? 'Admin' : 'Staff';

  return (
    <>
      <Section title="Team Management" description="Invite staff members and manage your team's access.">
        {/* ── Invite form ──────────────────────────────────────────────────── */}
        <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1">
            <Input type="email" placeholder="staff@yourcompany.com" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} />
          </div>
          <div className="sm:self-end">
            <Button type="submit" disabled={!inviteEmail.trim() || inviting} isLoading={inviting} loadingText="Sending…">Invite Staff</Button>
          </div>
        </form>

        {/* ── Members list ─────────────────────────────────────────────────── */}
        {loading ? (
          <div className="space-y-2 mt-2">
            {[1, 2, 3].map(i => <div key={i} className="h-12 skeleton-shimmer rounded-md" />)}
          </div>
        ) : members.length === 0 ? (
          <p className="text-sm text-gray-400 italic mt-2">No team members yet.</p>
        ) : (
          <>
            {/* Fixed height = 5 rows × 56px so container never shrinks on sparse pages */}
            <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden mt-2">
              <div className="flex flex-col" style={{ minHeight: `${5 * 56}px` }}>
                {paginatedMembers.map(member => (
                  <div key={member.uid} className="flex items-center justify-between px-4 bg-white hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0" style={{ height: 56 }}>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{member.email}</p>
                      <p className="text-xs text-gray-400">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium mr-2 ${member.role === 'owner' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                          {roleLabel(member.role)}
                        </span>
                        Joined {formatDate(member.createdAt)}
                      </p>
                    </div>
                    {member.uid !== currentUid && (
                      <div className="flex items-center gap-1 ml-3 shrink-0">
                        <button onClick={() => setRoleTarget(member)} title={`Make ${member.role === 'owner' ? 'Staff' : 'Admin'}`} className="p-1.5 text-purple-500 hover:text-purple-700 hover:bg-purple-50 rounded transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                        </button>
                        <button onClick={() => setRemoveTarget(member)} title="Remove from team" className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zM21 12h-6" /></svg>
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                {/* Phantom rows fill remaining space so the container height stays fixed */}
                {Array.from({ length: Math.max(0, 5 - paginatedMembers.length) }).map((_, i) => (
                  <div key={`phantom-${i}`} style={{ height: 56 }} className="border-b border-gray-100 last:border-b-0 bg-white" aria-hidden />
                ))}
              </div>
            </div>
            <PaginationBar page={page} pageCount={pageCount} onPrev={prev} onNext={next} onGoTo={goTo} />
          </>
        )}
      </Section>

      <Modal isOpen={!!roleTarget} title="Change role?"
        message={roleTarget ? `${roleTarget.email} will become ${roleTarget.role === 'owner' ? 'Staff' : 'Admin'}. ${roleTarget.role === 'staff' ? 'They will gain access to all organisation settings.' : 'They will lose access to organisation settings.'}` : ''}
        confirmLabel={roleChanging ? 'Updating…' : 'Yes, change role'} cancelLabel="Cancel"
        onConfirm={handleRoleChange} onCancel={() => setRoleTarget(null)} />

      <Modal isOpen={!!removeTarget} variant="danger" title="Remove team member?"
        message={removeTarget ? `${removeTarget.email} will be removed from the organisation. They will lose all access immediately.` : ''}
        confirmLabel={removing ? 'Removing…' : 'Yes, remove'} cancelLabel="Cancel"
        onConfirm={handleRemove} onCancel={() => setRemoveTarget(null)} />
    </>
  );
}
