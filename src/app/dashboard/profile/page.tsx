'use client';

import React, { useEffect, useState } from 'react';
import { onAuthStateChanged, updateProfile, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { auth, db } from '../../../lib/firebase';
import { useTenant } from '../../../contexts/TenantContext';
import ImageUpload from '../../../components/ImageUpload';
import Input from '../../../components/Input';
import Button from '../../../components/Button';
import Toast from '../../../components/Toast';
import { useToast } from '../../../hooks/useToast';
import { useGoogleReCaptcha } from 'react-google-recaptcha-v3';
import { ProfileHeaderSkeleton, SectionSkeleton } from '../../../components/Skeleton';

// ── Section wrapper ────────────────────────────────────────────────────────────
const Section = ({ title, description, children }: {
  title: string; description: string; children: React.ReactNode;
}) => (
  <div className="bg-white shadow-sm rounded-xl p-6 space-y-4 border border-gray-100">
    <div className="border-b border-gray-100 pb-3">
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      <p className="text-sm text-gray-500 mt-0.5">{description}</p>
    </div>
    {children}
  </div>
);

export default function ProfilePage() {
  const router = useRouter();
  const { tenantId } = useTenant();
  const { toasts, showToast, dismissToast } = useToast();
  const { executeRecaptcha } = useGoogleReCaptcha();

  const [loading, setLoading] = useState(true);
  const [uid, setUid] = useState('');
  const [email, setEmail] = useState('');

  // Photo
  const [photoUrl, setPhotoUrl] = useState('');
  const [photoSaving, setPhotoSaving] = useState(false);

  // Display name
  const [displayName, setDisplayName] = useState('');
  const [originalDisplayName, setOriginalDisplayName] = useState('');
  const [nameSaving, setNameSaving] = useState(false);

  // Password
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, user => {
      if (!user) { router.push('/login'); return; }
      setUid(user.uid);
      setEmail(user.email || '');
      setDisplayName(user.displayName || '');
      setOriginalDisplayName(user.displayName || '');
      setPhotoUrl(user.photoURL || '');
      setLoading(false);
    });
    return () => unsub();
  }, [router]);

  // ── Save photo ─────────────────────────────────────────────────────────────
  const handlePhotoUploaded = async (url: string) => {
    setPhotoSaving(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Not authenticated');
      // Update Firebase Auth photoURL
      await updateProfile(user, { photoURL: url });
      // Persist to Firestore so other parts of the app can read it
      await setDoc(doc(db, 'tenant-admins', user.uid), { photoUrl: url }, { merge: true });
      setPhotoUrl(url);
      showToast('Profile photo updated.', 'success');
    } catch {
      showToast('Failed to save photo.', 'error');
    } finally {
      setPhotoSaving(false);
    }
  };

  const handlePhotoRemoved = async () => {
    setPhotoSaving(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Not authenticated');
      await updateProfile(user, { photoURL: '' });
      await setDoc(doc(db, 'tenant-admins', user.uid), { photoUrl: '' }, { merge: true });
      setPhotoUrl('');
      showToast('Profile photo removed.', 'success');
    } catch {
      showToast('Failed to remove photo.', 'error');
    } finally {
      setPhotoSaving(false);
    }
  };

  // ── Save display name ──────────────────────────────────────────────────────
  const handleNameSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) { showToast('Display name cannot be empty.', 'error'); return; }
    if (displayName.trim() === originalDisplayName.trim()) return;
    setNameSaving(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Not authenticated');
      await updateProfile(user, { displayName: displayName.trim() });
      setOriginalDisplayName(displayName.trim());
      showToast('Display name updated.', 'success');
    } catch {
      showToast('Failed to update display name.', 'error');
    } finally {
      setNameSaving(false);
    }
  };

  // ── Change password ────────────────────────────────────────────────────────
  const handlePasswordSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) { showToast('Enter your current password.', 'error'); return; }
    if (newPassword.length < 6) { showToast('New password must be at least 6 characters.', 'error'); return; }
    if (newPassword !== confirmPassword) { showToast('Passwords do not match.', 'error'); return; }

    if (executeRecaptcha) {
      const token = await executeRecaptcha('password_change');
      const res = await fetch('/api/verify-recaptcha', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!data.success) { showToast('Bot detection triggered. Please try again.', 'error'); return; }
    }

    setPasswordSaving(true);
    try {
      const user = auth.currentUser;
      if (!user || !user.email) throw new Error('Not authenticated');
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      showToast('Password changed successfully.', 'success');
    } catch (err: any) {
      if (err?.code === 'auth/wrong-password' || err?.code === 'auth/invalid-credential') {
        showToast('Current password is incorrect.', 'error');
      } else {
        showToast(err?.message || 'Failed to change password.', 'error');
      }
    } finally {
      setPasswordSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 p-4 sm:p-6">
        <ProfileHeaderSkeleton />
        <SectionSkeleton rows={1} />
        <SectionSkeleton rows={1} />
        <SectionSkeleton rows={1} />
        <SectionSkeleton rows={3} />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 p-4 sm:p-6">
      <Toast toasts={toasts} onDismiss={dismissToast} />

      <div className="flex items-center gap-4">
        {/* Large avatar preview */}
        {photoUrl ? (
          <img src={photoUrl} alt={displayName} className="w-16 h-16 rounded-full object-cover ring-2 ring-white shadow" />
        ) : (
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-bold shadow"
            style={{ backgroundColor: 'var(--brand)' }}
          >
            {displayName ? displayName.charAt(0).toUpperCase() : '?'}
          </div>
        )}
        <div>
          <h1 className="text-xl font-bold text-gray-900">{displayName || 'Your Profile'}</h1>
          <p className="text-sm text-gray-500">{email}</p>
        </div>
      </div>

      {/* ── Profile Photo ──────────────────────────────────────────────────── */}
      <Section title="Profile Photo" description="Your photo appears in the header and across the dashboard.">
        <ImageUpload
          label="Upload Photo"
          hint="JPEG, PNG or WebP · max 5 MB · Recommended: square crop"
          currentUrl={photoUrl}
          folder={`${tenantId}/profiles`}
          onUploaded={handlePhotoUploaded}
          onRemoved={handlePhotoRemoved}
        />
        {photoSaving && <p className="text-xs text-gray-400">Saving…</p>}
      </Section>

      {/* ── Display Name ───────────────────────────────────────────────────── */}
      <Section title="Display Name" description="This is how your name appears across the platform.">
        <form onSubmit={handleNameSave} className="space-y-4">
          <div>
            <Input
              label="Display Name"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Your name"
              maxLength={50}
            />
            <p className={`text-xs mt-1 text-right ${displayName.length >= 50 ? 'text-red-500' : 'text-gray-400'}`}>
              {displayName.length}/50
            </p>
          </div>
          <div className="flex justify-end">
            <Button
              type="submit"
              fullWidth={false}
              disabled={nameSaving || displayName.trim() === originalDisplayName.trim()}
              isLoading={nameSaving}
              loadingText="Saving…"
            >
              Save Name
            </Button>
          </div>
        </form>
      </Section>

      {/* ── Email (read-only) ──────────────────────────────────────────────── */}
      <Section title="Email Address" description="Your login email. This cannot be changed here.">
        <div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-500 select-all">
          {email}
        </div>
      </Section>

      {/* ── Change Password ────────────────────────────────────────────────── */}
      <Section title="Change Password" description="Use a strong password of at least 6 characters.">
        <form onSubmit={handlePasswordSave} className="space-y-4">
          <Input
            label="Current Password"
            type="password"
            value={currentPassword}
            onChange={e => setCurrentPassword(e.target.value)}
            placeholder="Enter current password"
          />
          <Input
            label="New Password"
            type="password"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            placeholder="At least 6 characters"
          />
          <Input
            label="Confirm New Password"
            type="password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            placeholder="Repeat new password"
          />
          <div className="flex justify-end">
            <Button
              type="submit"
              fullWidth={false}
              disabled={passwordSaving || !currentPassword || !newPassword || !confirmPassword}
              isLoading={passwordSaving}
              loadingText="Changing…"
            >
              Change Password
            </Button>
          </div>
        </form>
      </Section>
    </div>
  );
}
