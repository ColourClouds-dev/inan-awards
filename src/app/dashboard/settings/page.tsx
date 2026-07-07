'use client';

import React, { useEffect, useState } from 'react';
import { doc, setDoc, getDoc, updateDoc, collection, getDocs, deleteDoc } from 'firebase/firestore';
import { onAuthStateChanged, updateProfile, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { db, auth } from '../../../lib/firebase';
import type { LocationSettings, NotificationSettings, SeoSettings, Tenant } from '../../../types';
import { updateTenant } from '../../../lib/tenantFirestore';
import Button from '../../../components/Button';
import Input from '../../../components/Input';
import Modal from '../../../components/Modal';
import Toast from '../../../components/Toast';
import ImageUpload from '../../../components/ImageUpload';
import { useToast } from '../../../hooks/useToast';
import { useTenant } from '../../../contexts/TenantContext';
import { SectionSkeleton } from '../../../components/Skeleton';
import { sanitizeEmail, sanitizeAndLimit } from '../../../lib/sanitize';
import TeamManagementSection from '../../../components/TeamManagementSection';

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
  const [pageLoading, setPageLoading] = useState(true);
  const { tenantId, tenant, isLoading: tenantLoading, isOwner, isStaff, currentUid } = useTenant();

  // ── Profile ────────────────────────────────────────────────────────────────
  const [displayName, setDisplayName] = useState('');
  const [originalDisplayName, setOriginalDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const nameChanged = displayName.trim() !== originalDisplayName.trim();
  const passwordFilled = newPassword.length > 0 && currentPassword.length > 0;
  const hasProfileChanges = nameChanged || passwordFilled;

  // ── Locations ──────────────────────────────────────────────────────────────
  const [locations, setLocations] = useState<string[]>([]);
  const [newLocation, setNewLocation] = useState('');
  const [locationSaving, setLocationSaving] = useState(false);

  // ── Notifications (org-wide, owner only) ───────────────────────────────────
  const [notifEmails, setNotifEmails] = useState<string[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [notifSaving, setNotifSaving] = useState(false);

  // ── Staff personal notifications ───────────────────────────────────────────
  const [staffNotifEmails, setStaffNotifEmails] = useState<string[]>([]);
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [staffNotifSaving, setStaffNotifSaving] = useState(false);

  // ── SEO ────────────────────────────────────────────────────────────────────
  const [seoSiteUrl, setSeoSiteUrl] = useState('');
  const [seoSiteName, setSeoSiteName] = useState('');
  const [seoDescription, setSeoDescription] = useState('');
  const [seoOgImageUrl, setSeoOgImageUrl] = useState('');
  const [seoSaving, setSeoSaving] = useState(false);

  // ── Danger zone ────────────────────────────────────────────────────────────
  const [modalOpen, setModalOpen] = useState(false);
  const [dangerAction, setDangerAction] = useState<'all-forms' | null>(null);
  const [dangerLoading, setDangerLoading] = useState(false);

  // ── Branding ───────────────────────────────────────────────────────────────
  const [brandLogoUrl, setBrandLogoUrl] = useState('');
  const [brandColor, setBrandColor] = useState('#7C3AED');
  const [brandEmailName, setBrandEmailName] = useState('');
  const [brandSaving, setBrandSaving] = useState(false);

  // ── Response Sharing ───────────────────────────────────────────────────────
  const [allowResponseSharing, setAllowResponseSharing] = useState(false);
  const [sharingSaving, setSharingSaving] = useState(false);


  // ── Auth guard + load ──────────────────────────────────────────────────────
  useEffect(() => {
    if (tenantLoading) return;
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) { router.push('/login'); return; }
      setDisplayName(user.displayName || '');
      setOriginalDisplayName(user.displayName || '');
      setEmail(user.email || '');
      try {
        // Always load locations (both roles need them)
        const locSnap = await getDoc(doc(db, 'tenant-settings', tenantId, 'config', 'locations'));
        if (locSnap.exists()) setLocations((locSnap.data() as LocationSettings).locations || []);

        if (isOwner) {
          const [notifSnap, seoSnap] = await Promise.all([
            getDoc(doc(db, 'tenant-settings', tenantId, 'config', 'notifications')),
            getDoc(doc(db, 'tenant-settings', tenantId, 'config', 'seo')),
          ]);
          if (notifSnap.exists()) setNotifEmails((notifSnap.data() as NotificationSettings).emails || []);
          if (seoSnap.exists()) {
            const seo = seoSnap.data() as SeoSettings;
            setSeoSiteUrl(seo.siteUrl || '');
            setSeoSiteName(seo.siteName || '');
            setSeoDescription(seo.defaultDescription || '');
            setSeoOgImageUrl(seo.ogImageUrl || '');
          }
          try {
            const tSnap = await getDoc(doc(db, 'tenants', tenantId));
            if (tSnap.exists()) {
              const tData = tSnap.data() as Tenant;
              setAllowResponseSharing(tData.features?.allowResponseSharing ?? false);
              const b = tData.branding;
              if (b?.logoUrl) setBrandLogoUrl(b.logoUrl);
              if (b?.primaryColor) setBrandColor(b.primaryColor);
              if (b?.emailDisplayName) setBrandEmailName(b.emailDisplayName);
            }
          } catch { /* non-fatal */ }
        }

        if (isStaff && user.uid) {
          try {
            const staffSnap = await getDoc(doc(db, 'tenant-admins', user.uid));
            if (staffSnap.exists()) {
              const staffData = staffSnap.data() as { notificationEmails?: string[] };
              setStaffNotifEmails(staffData.notificationEmails || []);
            }
          } catch { /* non-fatal */ }
        }
      } catch (err) {
        console.error('Error loading settings:', err);
        showToast('Failed to load some settings.', 'error');
      } finally {
        setPageLoading(false);
      }
    });
    return () => unsubscribe();
  }, [router, tenantLoading, isOwner, isStaff, tenantId]);

  // ── Profile save ───────────────────────────────────────────────────────────
  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword && newPassword !== confirmPassword) { showToast('New passwords do not match.', 'error'); return; }
    if (newPassword && newPassword.length < 6) { showToast('Password must be at least 6 characters.', 'error'); return; }
    setProfileSaving(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Not authenticated');
      if (displayName !== user.displayName) { await updateProfile(user, { displayName }); setOriginalDisplayName(displayName); }
      if (newPassword) {
        if (!currentPassword) { showToast('Enter your current password to set a new one.', 'error'); setProfileSaving(false); return; }
        const credential = EmailAuthProvider.credential(user.email!, currentPassword);
        await reauthenticateWithCredential(user, credential);
        await updatePassword(user, newPassword);
        setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
      }
      showToast('Profile updated successfully.', 'success');
    } catch (err: unknown) {
      showToast((err as { message?: string })?.message || 'Failed to update profile.', 'error');
    } finally { setProfileSaving(false); }
  };

  // ── Locations ──────────────────────────────────────────────────────────────
  const saveLocations = async (updated: string[]) => {
    setLocationSaving(true);
    try {
      await setDoc(doc(db, 'tenant-settings', tenantId, 'config', 'locations'), { locations: updated });
      setLocations(updated);
      showToast('Locations saved.', 'success');
    } catch { showToast('Failed to save locations.', 'error'); }
    finally { setLocationSaving(false); }
  };
  const addLocation = () => {
    const trimmed = sanitizeAndLimit(newLocation, 80);
    if (!trimmed || locations.includes(trimmed)) return;
    setNewLocation('');
    saveLocations([...locations, trimmed]);
  };
  const removeLocation = (loc: string) => saveLocations(locations.filter(l => l !== loc));

  // ── Org-wide notifications (owner) ─────────────────────────────────────────
  const saveNotifEmails = async (updated: string[]) => {
    setNotifSaving(true);
    try {
      await setDoc(doc(db, 'tenant-settings', tenantId, 'config', 'notifications'), { emails: updated });
      setNotifEmails(updated);
      showToast('Notification emails saved.', 'success');
    } catch { showToast('Failed to save notification emails.', 'error'); }
    finally { setNotifSaving(false); }
  };
  const addNotifEmail = () => {
    const trimmed = sanitizeEmail(newEmail).slice(0, 254);
    if (!trimmed || notifEmails.includes(trimmed)) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) { showToast('Please enter a valid email address.', 'error'); return; }
    setNewEmail('');
    saveNotifEmails([...notifEmails, trimmed]);
  };
  const removeNotifEmail = (em: string) => saveNotifEmails(notifEmails.filter(e => e !== em));

  // ── Staff personal notifications ───────────────────────────────────────────
  const saveStaffNotifEmails = async (updated: string[]) => {
    if (!currentUid) return;
    setStaffNotifSaving(true);
    try {
      await updateDoc(doc(db, 'tenant-admins', currentUid), { notificationEmails: updated });
      setStaffNotifEmails(updated);
      showToast('Notification emails saved.', 'success');
    } catch { showToast('Failed to save notification emails.', 'error'); }
    finally { setStaffNotifSaving(false); }
  };
  const addStaffNotifEmail = () => {
    const trimmed = sanitizeEmail(newStaffEmail).slice(0, 254);
    if (!trimmed || staffNotifEmails.includes(trimmed)) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) { showToast('Please enter a valid email address.', 'error'); return; }
    setNewStaffEmail('');
    saveStaffNotifEmails([...staffNotifEmails, trimmed]);
  };
  const removeStaffNotifEmail = (em: string) => saveStaffNotifEmails(staffNotifEmails.filter(e => e !== em));

  // ── Response Sharing ───────────────────────────────────────────────────────
  const handleToggleResponseSharing = async () => {
    if (!tenant) return;
    const newValue = !allowResponseSharing;
    setSharingSaving(true);
    try {
      await updateTenant(tenantId, {
        features: {
          ...tenant.features,
          allowResponseSharing: newValue,
        },
      });
      setAllowResponseSharing(newValue);
      showToast(`Response sharing ${newValue ? 'enabled' : 'disabled'}.`, 'success');
    } catch {
      showToast('Failed to update response sharing setting.', 'error');
    } finally {
      setSharingSaving(false);
    }
  };

  // ── Branding ───────────────────────────────────────────────────────────────
  const handleBrandingSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (brandColor && !/^#[0-9A-Fa-f]{6}$/.test(brandColor)) { showToast('Please enter a valid hex color (e.g. #7C3AED).', 'error'); return; }
    setBrandSaving(true);
    try {
      await updateTenant(tenantId, {
        branding: {
          ...(brandLogoUrl ? { logoUrl: brandLogoUrl } : {}),
          ...(brandColor ? { primaryColor: brandColor } : {}),
          ...(brandEmailName.trim() ? { emailDisplayName: sanitizeAndLimit(brandEmailName, 80) } : {}),
        },
      });
      showToast('Branding saved.', 'success');
    } catch { showToast('Failed to save branding.', 'error'); }
    finally { setBrandSaving(false); }
  };

  // ── SEO ────────────────────────────────────────────────────────────────────
  const handleSeoSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!seoSiteUrl.trim() || !seoSiteName.trim()) { showToast('Site URL and Site Name are required.', 'error'); return; }
    try { new URL(seoSiteUrl); } catch { showToast('Please enter a valid URL (e.g. https://inan.com.ng).', 'error'); return; }
    setSeoSaving(true);
    try {
      const payload: SeoSettings = {
        siteUrl: sanitizeAndLimit(seoSiteUrl.trim().replace(/\/$/, ''), 253),
        siteName: sanitizeAndLimit(seoSiteName, 100),
        defaultDescription: sanitizeAndLimit(seoDescription, 300),
        ...(seoOgImageUrl ? { ogImageUrl: seoOgImageUrl } : {}),
      };
      await setDoc(doc(db, 'tenant-settings', tenantId, 'config', 'seo'), payload);
      showToast('SEO settings saved.', 'success');
    } catch { showToast('Failed to save SEO settings.', 'error'); }
    finally { setSeoSaving(false); }
  };

  // ── Danger zone ────────────────────────────────────────────────────────────
  const handleDangerConfirm = async () => {
    if (!dangerAction) return;
    setModalOpen(false);
    setDangerLoading(true);
    try {
      if (dangerAction === 'all-forms') {
        // Use the server-side API so we get Admin SDK batching, proper tenant
        // scoping, and a formCount reset — none of which are safe client-side.
        const user = auth.currentUser;
        if (!user) throw new Error('Not authenticated');
        const token = await user.getIdToken();
        const res = await fetch('/api/delete-all-forms', {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? 'Server error');
        }
        showToast('All forms and responses have been permanently deleted.', 'success');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      showToast(`Failed to delete: ${msg}`, 'error');
    } finally {
      setDangerLoading(false);
      setDangerAction(null);
    }
  };

  if (pageLoading) {
    return (
      <div className="space-y-8 max-w-3xl mx-auto p-4 sm:p-6">
        <div className="h-7 w-28 skeleton-shimmer rounded" />
        <SectionSkeleton rows={3} />
        <SectionSkeleton rows={2} />
        <SectionSkeleton rows={1} />
        <SectionSkeleton rows={2} />
      </div>
    );
  }
  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      <Toast toasts={toasts} onDismiss={dismissToast} />
      <h1 className="text-xl font-bold text-gray-900">Settings</h1>

      {/* ── Profile (both roles) ──────────────────────────────────────────── */}
      <Section title="Profile" description="Update your display name and password.">
        <form onSubmit={handleProfileSave} className="space-y-4">
          <Input label="Display Name" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Your name" />
          <Input label="Email" value={email} disabled type="email" />
          <div className="border-t pt-4">
            <p className="text-sm font-medium text-gray-700 mb-3">Change Password</p>
            <div className="space-y-3">
              <Input label="Current Password" type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} placeholder="Enter current password" autoComplete="current-password" />
              <Input label="New Password" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="At least 6 characters" autoComplete="new-password" />
              <Input label="Confirm New Password" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Repeat new password" autoComplete="new-password" />
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="submit" fullWidth={false} disabled={!hasProfileChanges || profileSaving} isLoading={profileSaving} loadingText="Saving…">Save Profile</Button>
          </div>
        </form>
      </Section>

      {/* ── Branding (owner only) ─────────────────────────────────────────── */}
      {isOwner && (
        <Section title="Branding" description="Customise how your organisation appears across the platform — logo, brand color, and email display name.">
          <form onSubmit={handleBrandingSave} className="space-y-5">
            <ImageUpload label="Organisation Logo" hint="Shown in the nav bar, login page, and public forms. Recommended: PNG or SVG with transparent background." currentUrl={brandLogoUrl} folder={`${tenantId}/branding`} onUploaded={url => setBrandLogoUrl(url)} onRemoved={() => setBrandLogoUrl('')} />
            <div>
              <label className="block text-lg font-medium text-gray-700 mb-1">Brand Color</label>
              <p className="text-xs text-gray-400 mb-2">Used on buttons, active nav links, and accents across the platform.</p>
              <div className="flex items-center gap-3">
                <input type="color" value={brandColor} onChange={e => setBrandColor(e.target.value)} className="h-11 w-14 rounded-lg border-2 border-gray-300 cursor-pointer p-0.5 bg-white" title="Pick a color" />
                <input type="text" value={brandColor} onChange={e => setBrandColor(e.target.value)} maxLength={7} placeholder="#7C3AED" className="w-32 px-3 py-2.5 text-sm font-mono rounded-lg border-2 border-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:border-transparent uppercase" />
                <div className="flex items-center gap-2 ml-2">
                  <div className="h-9 px-4 rounded-lg text-white text-sm font-medium flex items-center" style={{ backgroundColor: /^#[0-9A-Fa-f]{6}$/.test(brandColor) ? brandColor : '#7C3AED' }}>Preview</div>
                  <span className="text-xs text-gray-400">Button preview</span>
                </div>
              </div>
            </div>
            <div>
              <Input label="Email Display Name" value={brandEmailName} onChange={e => setBrandEmailName(e.target.value)} placeholder={`e.g. ${tenant?.name ?? 'Your Company'} Feedback`} />
              <p className="text-xs text-gray-400 mt-1">Shown as the sender name in notification emails.</p>
            </div>
            <div className="flex justify-end">
              <Button type="submit" fullWidth={false} disabled={brandSaving} isLoading={brandSaving} loadingText="Saving…">Save Branding</Button>
            </div>
          </form>
        </Section>
      )}

      {/* ── Response Sharing (owner only) ─────────────────────────────────── */}
      {isOwner && (
        <Section title="Response Sharing" description="Allow respondents to share their form responses via text, PDF, CSV, or WhatsApp.">
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-gray-900">Enable Response Sharing</p>
              <p className="text-xs text-gray-500 mt-0.5">Adds a "Share Response" button to the form completion screen, letting users download their response or share it directly.</p>
            </div>
            <button
              onClick={handleToggleResponseSharing}
              disabled={sharingSaving}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 ${
                allowResponseSharing ? '' : 'bg-gray-200'
              }`}
              style={{
                backgroundColor: allowResponseSharing
                  ? (brandColor && /^#[0-9A-Fa-f]{6}$/.test(brandColor) ? brandColor : '#7C3AED')
                  : undefined
              }}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  allowResponseSharing ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </Section>
      )}
      {/* ── Locations — owner: full controls ─────────────────────────────── */}
      {isOwner && (
        <Section title="Locations" description="Manage the locations available when creating feedback forms.">
          <div className="space-y-2">
            {locations.length === 0 && <p className="text-sm text-gray-400 italic">No locations added yet.</p>}
            {locations.map(loc => (
              <div key={loc} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-md border border-gray-200">
                <span className="text-sm text-gray-700">{loc}</span>
                <button onClick={() => removeLocation(loc)} disabled={locationSaving} title="Remove location" className="text-red-400 hover:text-red-600 disabled:opacity-40 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </div>
            ))}
          </div>
          <div className="flex flex-col sm:flex-row gap-2 mt-2">
            <div className="flex-1"><Input placeholder="e.g. Qaras Hotels: Lekki" value={newLocation} onChange={e => setNewLocation(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addLocation())} /></div>
            <div className="sm:self-end"><Button onClick={addLocation} disabled={!newLocation.trim() || locationSaving}>Add Location</Button></div>
          </div>
        </Section>
      )}

      {/* ── Locations — staff: read-only ──────────────────────────────────── */}
      {isStaff && (
        <Section title="Locations" description="Locations available when creating feedback forms.">
          <div className="space-y-2">
            {locations.length === 0 && <p className="text-sm text-gray-400 italic">No locations configured yet.</p>}
            {locations.map(loc => (
              <div key={loc} className="flex items-center px-3 py-2 bg-gray-50 rounded-md border border-gray-200">
                <span className="text-sm text-gray-700">{loc}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── Notifications — owner: org-wide ──────────────────────────────── */}
      {isOwner && (
        <Section title="Notifications" description="Email addresses that receive alerts when a negative feedback response is submitted.">
          <div className="space-y-2">
            {notifEmails.length === 0 && <p className="text-sm text-gray-400 italic">No notification emails configured.</p>}
            {notifEmails.map(em => (
              <div key={em} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-md border border-gray-200">
                <span className="text-sm text-gray-700">{em}</span>
                <button onClick={() => removeNotifEmail(em)} disabled={notifSaving} title="Remove email" className="text-red-400 hover:text-red-600 disabled:opacity-40 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </div>
            ))}
          </div>
          <div className="flex flex-col sm:flex-row gap-2 mt-2">
            <div className="flex-1"><Input type="email" placeholder="e.g. admin@inan.com.ng" value={newEmail} onChange={e => setNewEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addNotifEmail())} /></div>
            <div className="sm:self-end"><Button onClick={addNotifEmail} disabled={!newEmail.trim() || notifSaving}>Add Email</Button></div>
          </div>
        </Section>
      )}

      {/* ── Notifications — staff: personal ──────────────────────────────── */}
      {isStaff && (
        <Section title="Notifications" description="Your personal email addresses for negative feedback alerts on your forms.">
          <div className="space-y-2">
            {staffNotifEmails.length === 0 && <p className="text-sm text-gray-400 italic">No notification emails configured.</p>}
            {staffNotifEmails.map(em => (
              <div key={em} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-md border border-gray-200">
                <span className="text-sm text-gray-700">{em}</span>
                <button onClick={() => removeStaffNotifEmail(em)} disabled={staffNotifSaving} title="Remove email" className="text-red-400 hover:text-red-600 disabled:opacity-40 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </div>
            ))}
          </div>
          <div className="flex flex-col sm:flex-row gap-2 mt-2">
            <div className="flex-1"><Input type="email" placeholder="e.g. you@company.com" value={newStaffEmail} onChange={e => setNewStaffEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addStaffNotifEmail())} /></div>
            <div className="sm:self-end"><Button onClick={addStaffNotifEmail} disabled={!newStaffEmail.trim() || staffNotifSaving}>Add Email</Button></div>
          </div>
        </Section>
      )}

      {/* ── SEO (owner only) ─────────────────────────────────────────────── */}
      {isOwner && tenant?.features?.seoSettings !== false && (
        <Section title="SEO & Open Graph" description="Control how your site appears in search engines and when links are shared on social media.">
          <form onSubmit={handleSeoSave} className="space-y-4">
            <Input label="Site URL" value={seoSiteUrl} onChange={e => setSeoSiteUrl(e.target.value)} placeholder="https://inan.com.ng" type="url" />
            <Input label="Site Name" value={seoSiteName} onChange={e => setSeoSiteName(e.target.value)} placeholder="Inan Feedback" />
            <div>
              <Input label="Default Meta Description" value={seoDescription} onChange={e => setSeoDescription(e.target.value)} placeholder="Collect, manage and analyse guest feedback across all Inan hotel locations." />
              <p className={`text-xs mt-1 text-right ${seoDescription.length > 160 ? 'text-red-500' : 'text-gray-400'}`}>{seoDescription.length}/160 — keep under 160 characters for best results</p>
            </div>
            <ImageUpload label="Default OG Image" hint="Shown when your site is shared on WhatsApp, Twitter, LinkedIn etc. Recommended: 1200 × 630 px." currentUrl={seoOgImageUrl} folder="inan/seo" onUploaded={url => setSeoOgImageUrl(url)} onRemoved={() => setSeoOgImageUrl('')} />
            <div className="flex justify-end">
              <Button type="submit" disabled={seoSaving} isLoading={seoSaving} loadingText="Saving…" fullWidth={false}>Save SEO Settings</Button>
            </div>
          </form>
        </Section>
      )}

      {/* ── Team Management (owner only) ─────────────────────────────────── */}
      {isOwner && <TeamManagementSection tenantId={tenantId} showToast={showToast} />}

      {/* ── Danger Zone (owner only) ─────────────────────────────────────── */}
      {isOwner && (
        <Section title="Danger Zone" description="Irreversible actions. Proceed with caution.">
          <div className="border border-red-200 rounded-lg p-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-gray-900">Delete All Forms &amp; Responses</p>
              <p className="text-xs text-gray-500 mt-0.5">Permanently removes every feedback form and all associated responses for your organisation. This cannot be undone.</p>
            </div>
            <button onClick={() => { setDangerAction('all-forms'); setModalOpen(true); }} disabled={dangerLoading} className="shrink-0 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors">
              {dangerLoading ? 'Deleting…' : 'Delete All'}
            </button>
          </div>
        </Section>
      )}

      {/* ── Danger zone confirmation modal ───────────────────────────────── */}
      <Modal
        isOpen={modalOpen}
        variant="danger"
        title="Are you absolutely sure?"
        message="This will permanently delete ALL feedback forms and every response submitted to them for your organisation. This action cannot be undone."
        confirmLabel="Yes, delete everything"
        cancelLabel="Cancel"
        onConfirm={handleDangerConfirm}
        onCancel={() => { setModalOpen(false); setDangerAction(null); }}
      />
    </div>
  );
}
