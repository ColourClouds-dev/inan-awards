'use client';

import React, { useEffect, useState } from 'react';
import { doc, setDoc, getDoc, collection, getDocs, deleteDoc } from 'firebase/firestore';
import { onAuthStateChanged, updateProfile, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { useGoogleReCaptcha } from 'react-google-recaptcha-v3';
import { db, auth } from '../../../lib/firebase';
import type { LocationSettings, NotificationSettings } from '../../../types';
import Button from '../../../components/Button';
import Input from '../../../components/Input';
import Modal from '../../../components/Modal';
import Toast from '../../../components/Toast';
import { useToast } from '../../../hooks/useToast';

// ─── Section wrapper ──────────────────────────────────────────────────────────
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

export default function SettingsPage() {
  const router = useRouter();
  const { toasts, showToast, dismissToast } = useToast();
  const { executeRecaptcha } = useGoogleReCaptcha();
  const [pageLoading, setPageLoading] = useState(true);

  // ── Profile ────────────────────────────────────────────────────────────────
  const [displayName, setDisplayName] = useState('');
  const [originalDisplayName, setOriginalDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);

  // Button is only enabled when there's something meaningful to save
  const nameChanged = displayName.trim() !== originalDisplayName.trim();
  const passwordFilled = newPassword.length > 0 && currentPassword.length > 0;
  const hasProfileChanges = nameChanged || passwordFilled;

  // ── Locations ──────────────────────────────────────────────────────────────
  const [locations, setLocations] = useState<string[]>([]);
  const [newLocation, setNewLocation] = useState('');
  const [locationSaving, setLocationSaving] = useState(false);

  // ── Notifications ──────────────────────────────────────────────────────────
  const [notifEmails, setNotifEmails] = useState<string[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [notifSaving, setNotifSaving] = useState(false);

  // ── Danger zone ────────────────────────────────────────────────────────────
  const [modalOpen, setModalOpen] = useState(false);
  const [dangerAction, setDangerAction] = useState<'responses' | null>(null);
  const [dangerLoading, setDangerLoading] = useState(false);

  // ── Auth guard + load ──────────────────────────────────────────────────────
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) { router.push('/login'); return; }
      setDisplayName(user.displayName || '');
      setOriginalDisplayName(user.displayName || '');
      setEmail(user.email || '');
      try {
        const [locSnap, notifSnap] = await Promise.all([
          getDoc(doc(db, 'settings', 'locations')),
          getDoc(doc(db, 'settings', 'notifications')),
        ]);
        if (locSnap.exists()) setLocations((locSnap.data() as LocationSettings).locations || []);
        if (notifSnap.exists()) setNotifEmails((notifSnap.data() as NotificationSettings).emails || []);
      } catch (err) {
        console.error('Error loading settings:', err);
        showToast('Failed to load some settings.', 'error');
      } finally {
        setPageLoading(false);
      }
    });
    return () => unsubscribe();
  }, [router]);

  // ── Profile save ───────────────────────────────────────────────────────────
  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword && newPassword !== confirmPassword) {
      showToast('New passwords do not match.', 'error');
      return;
    }
    if (newPassword && newPassword.length < 6) {
      showToast('Password must be at least 6 characters.', 'error');
      return;
    }

    // reCAPTCHA verification
    if (executeRecaptcha) {
      const token = await executeRecaptcha('profile_save');
      const res = await fetch('/api/verify-recaptcha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!data.success) {
        showToast('Bot detection triggered. Please try again.', 'error');
        return;
      }
    }

    setProfileSaving(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Not authenticated');

      if (displayName !== user.displayName) {
        await updateProfile(user, { displayName });
        setOriginalDisplayName(displayName);
      }

      if (newPassword) {
        if (!currentPassword) {
          showToast('Enter your current password to set a new one.', 'error');
          setProfileSaving(false);
          return;
        }
        const credential = EmailAuthProvider.credential(user.email!, currentPassword);
        await reauthenticateWithCredential(user, credential);
        await updatePassword(user, newPassword);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }

      showToast('Profile updated successfully.', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to update profile.', 'error');
    } finally {
      setProfileSaving(false);
    }
  };

  // ── Locations ──────────────────────────────────────────────────────────────
  const saveLocations = async (updated: string[]) => {
    setLocationSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'locations'), { locations: updated });
      setLocations(updated);
      showToast('Locations saved.', 'success');
    } catch {
      showToast('Failed to save locations.', 'error');
    } finally {
      setLocationSaving(false);
    }
  };

  const addLocation = () => {
    const trimmed = newLocation.trim();
    if (!trimmed || locations.includes(trimmed)) return;
    setNewLocation('');
    saveLocations([...locations, trimmed]);
  };

  const removeLocation = (loc: string) => saveLocations(locations.filter(l => l !== loc));

  // ── Notifications ──────────────────────────────────────────────────────────
  const saveNotifEmails = async (updated: string[]) => {
    setNotifSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'notifications'), { emails: updated });
      setNotifEmails(updated);
      showToast('Notification emails saved.', 'success');
    } catch {
      showToast('Failed to save notification emails.', 'error');
    } finally {
      setNotifSaving(false);
    }
  };

  const addNotifEmail = () => {
    const trimmed = newEmail.trim().toLowerCase();
    if (!trimmed || notifEmails.includes(trimmed)) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      showToast('Please enter a valid email address.', 'error');
      return;
    }
    setNewEmail('');
    saveNotifEmails([...notifEmails, trimmed]);
  };

  const removeNotifEmail = (em: string) => saveNotifEmails(notifEmails.filter(e => e !== em));

  // ── Danger zone ────────────────────────────────────────────────────────────
  const handleDangerConfirm = async () => {
    if (!dangerAction) return;
    setModalOpen(false);
    setDangerLoading(true);
    try {
      if (dangerAction === 'responses') {
        const snapshot = await getDocs(collection(db, 'feedback-responses'));
        await Promise.all(snapshot.docs.map(d => deleteDoc(d.ref)));
        showToast('All responses have been permanently deleted.', 'success');
      }
    } catch {
      showToast('Failed to complete the action. Please try again.', 'error');
    } finally {
      setDangerLoading(false);
      setDangerAction(null);
    }
  };

  if (pageLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      <Toast toasts={toasts} onDismiss={dismissToast} />
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

      {/* ── Profile / Account ─────────────────────────────────────────────── */}
      <Section title="Profile & Account" description="Update your display name and password.">
        <form onSubmit={handleProfileSave} className="space-y-4">
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
          <div>
            <label className="block text-lg font-medium ext-gray-700 mb-1">Email</label>
            <p className="px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-lg text-gray-500 text-sm">{email}</p>
            <p className="text-xs text-gray-400 mt-1">Email cannot be changed here.</p>
          </div>
          <div className="border-t pt-4 space-y-3">
            <p className="text-sm font-medium text-gray-700">Change Password</p>
            <Input label="Current Password" type="password" value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)} placeholder="Enter current password" />
            <Input label="New Password" type="password" value={newPassword}
              onChange={e => setNewPassword(e.target.value)} placeholder="At least 6 characters" />
            <Input label="Confirm New Password" type="password" value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)} placeholder="Repeat new password" />
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={profileSaving || !hasProfileChanges} isLoading={profileSaving}>
              Save Profile
            </Button>
          </div>
        </form>
      </Section>

      {/* ── Locations ─────────────────────────────────────────────────────── */}
      <Section title="Locations" description="Manage the hotel locations available when creating feedback forms.">
        <div className="space-y-2">
          {locations.length === 0 && <p className="text-sm text-gray-400 italic">No locations added yet.</p>}
          {locations.map(loc => (
            <div key={loc} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-md border border-gray-200">
              <span className="text-sm text-gray-700">{loc}</span>
              <button onClick={() => removeLocation(loc)} disabled={locationSaving}
                className="text-red-500 hover:text-red-700 text-xs font-medium">Remove</button>
            </div>
          ))}
        </div>
        <div className="flex flex-col sm:flex-row gap-2 mt-2">
          <div className="flex-1">
            <Input placeholder="e.g. Qaras Hotels: Lekki" value={newLocation}
              onChange={e => setNewLocation(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addLocation())} />
          </div>
          <div className="sm:self-end">
            <Button onClick={addLocation} disabled={!newLocation.trim() || locationSaving}>Add Location</Button>
          </div>
        </div>
      </Section>t

      {/* ── Notifications ─────────────────────────────────────────────────── */}
      <Section title="Notifications" description="Email addresses that receive alerts when a negative feedback response is submitted.">
        <div className="space-y-2">
          {notifEmails.length === 0 && <p className="text-sm text-gray-400 italic">No notification emails configured.</p>}
          {notifEmails.map(em => (
            <div key={em} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-md border border-gray-200">
              <span className="text-sm text-gray-700">{em}</span>
              <button onClick={() => removeNotifEmail(em)} disabled={notifSaving}
                className="text-red-500 hover:text-red-700 text-xs font-medium">Remove</button>
            </div>
          ))}
        </div>
        <div className="flex flex-col sm:flex-row gap-2 mt-2">
          <div className="flex-1">
            <Input type="email" placeholder="e.g. admin@inan.com.ng" value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addNotifEmail())} />
          </div>
          <div className="sm:self-end">
            <Button onClick={addNotifEmail} disabled={!newEmail.trim() || notifSaving}>Add Email</Button>
          </div>
        </div>
      </Section>

      {/* ── Danger Zone ───────────────────────────────────────────────────── */}
      <Section title="Danger Zone" description="Irreversible actions. Proceed with caution.">
        <div className="border border-red-200 rounded-lg p-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-gray-900">Delete All Responses</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Permanently removes every feedback response from the database. This cannot be undone.
            </p>
          </div>
          <button
            onClick={() => { setDangerAction('responses'); setModalOpen(true); }}
            disabled={dangerLoading}
            className="shrink-0 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {dangerLoading ? 'Deleting…' : 'Delete All'}
          </button>
        </div>
      </Section>

      {/* ── Confirmation Modal ─────────────────────────────────────────────── */}
      <Modal
        isOpen={modalOpen}
        variant="danger"
        title="Are you absolutely sure?"
        message="This will permanently delete all feedback responses from the database. This action cannot be undone."
        confirmLabel="Yes, delete everything"
        cancelLabel="Cancel"
        onConfirm={handleDangerConfirm}
        onCancel={() => { setModalOpen(false); setDangerAction(null); }}
      />
    </div>
  );
}
