'use client';

import React, { useEffect, useState } from 'react';
import { doc, setDoc, getDoc, collection, getDocs, deleteDoc } from 'firebase/firestore';
import { onAuthStateChanged, updateProfile, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { useGoogleReCaptcha } from 'react-google-recaptcha-v3';
import { db, auth, storage } from '../../../lib/firebase';
import type { LocationSettings, NotificationSettings, SeoSettings, Employee } from '../../../types';
import Button from '../../../components/Button';
import Input from '../../../components/Input';
import Modal from '../../../components/Modal';
import Toast from '../../../components/Toast';
import ImageUpload from '../../../components/ImageUpload';
import { useToast } from '../../../hooks/useToast';
import {
  getAllEmployees,
  saveEmployee,
  updateEmployee,
  deleteEmployee,
  seedEmployeesIfEmpty,
} from '../../../lib/employeesFirestore';

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

  // ── Employees ──────────────────────────────────────────────────────────────
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [empLoading, setEmpLoading] = useState(false);
  const [empSearch, setEmpSearch] = useState('');
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);
  const [showEmpForm, setShowEmpForm] = useState(false);
  const [empDeleteTarget, setEmpDeleteTarget] = useState<Employee | null>(null);
  const [empSaving, setEmpSaving] = useState(false);
  const [newEmp, setNewEmp] = useState<Partial<Employee>>({
    Employee: '', Email: '', Role: '', 'Reporting To': '',
    'Joining Date': '', Status: 'Active', 'Employment Type': '',
  });

  // ── SEO ────────────────────────────────────────────────────────────────────
  const [seoSiteUrl, setSeoSiteUrl] = useState('');
  const [seoSiteName, setSeoSiteName] = useState('');
  const [seoDescription, setSeoDescription] = useState('');
  const [seoOgImageUrl, setSeoOgImageUrl] = useState('');
  const [seoSaving, setSeoSaving] = useState(false);

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
        const [locSnap, notifSnap, seoSnap] = await Promise.all([
          getDoc(doc(db, 'settings', 'locations')),
          getDoc(doc(db, 'settings', 'notifications')),
          getDoc(doc(db, 'settings', 'seo')),
        ]);
        if (locSnap.exists()) setLocations((locSnap.data() as LocationSettings).locations || []);
        if (notifSnap.exists()) setNotifEmails((notifSnap.data() as NotificationSettings).emails || []);
        if (seoSnap.exists()) {
          const seo = seoSnap.data() as SeoSettings;
          setSeoSiteUrl(seo.siteUrl || '');
          setSeoSiteName(seo.siteName || '');
          setSeoDescription(seo.defaultDescription || '');
          setSeoOgImageUrl(seo.ogImageUrl || '');
        }

        // Seed + load employees
        setEmpLoading(true);
        await seedEmployeesIfEmpty();
        const empList = await getAllEmployees();
        setEmployees(empList);
        setEmpLoading(false);
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

  // ── Employees ──────────────────────────────────────────────────────────────
  const ROLES = ['Operations Officer', 'Supervisor', 'Front Desk', 'Wait Staff', 'Accountant',
    'Cashier', 'HR Admin Trainee', 'Logistics & Security Officer', 'Logistics & Security Trainee',
    'Procurements Officer', 'Brand Communications Officer', 'Corporate Services Officer',
    'Senior Operations Officer ICT', 'Managing Director', 'Other'];

  const resetNewEmp = () => setNewEmp({
    Employee: '', Email: '', Role: '', 'Reporting To': '',
    'Joining Date': '', Status: 'Active', 'Employment Type': '',
  });

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmp.Employee?.trim() || !newEmp.Email?.trim() || !newEmp.Role?.trim()) {
      showToast('Name, email and role are required.', 'error');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmp.Email.trim())) {
      showToast('Please enter a valid email address.', 'error');
      return;
    }
    setEmpSaving(true);
    try {
      const maxId = employees.reduce((m, e) => Math.max(m, Number(e.Id) || 0), 0);
      const maxEmpId = employees.reduce((m, e) => Math.max(m, Number(e['Employee ID']) || 0), 0);
      const emp: Employee = {
        '#': employees.length + 1,
        Id: maxId + 1,
        'Employee ID': maxEmpId + 1,
        Employee: newEmp.Employee!.trim(),
        Email: newEmp.Email!.trim(),
        Role: newEmp.Role!.trim(),
        'Reporting To': newEmp['Reporting To']?.trim() || '',
        'Joining Date': newEmp['Joining Date'] || new Date().toISOString().split('T')[0],
        Status: newEmp.Status || 'Active',
        ...(newEmp['Employment Type']?.trim() ? { 'Employment Type': newEmp['Employment Type'].trim() } : {}),
      };
      await saveEmployee(emp);
      setEmployees(prev => [...prev, emp].sort((a, b) => a.Employee.localeCompare(b.Employee)));
      resetNewEmp();
      setShowEmpForm(false);
      showToast('Employee added successfully.', 'success');
    } catch {
      showToast('Failed to add employee.', 'error');
    } finally {
      setEmpSaving(false);
    }
  };

  const handleUpdateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmp) return;
    setEmpSaving(true);
    try {
      await updateEmployee(String(editingEmp['Employee ID']), editingEmp);
      setEmployees(prev => prev.map(emp =>
        emp['Employee ID'] === editingEmp['Employee ID'] ? editingEmp : emp
      ).sort((a, b) => a.Employee.localeCompare(b.Employee)));
      setEditingEmp(null);
      showToast('Employee updated.', 'success');
    } catch {
      showToast('Failed to update employee.', 'error');
    } finally {
      setEmpSaving(false);
    }
  };

  const handleDeleteEmployee = async () => {
    if (!empDeleteTarget) return;
    setEmpSaving(true);
    try {
      await deleteEmployee(String(empDeleteTarget['Employee ID']));
      setEmployees(prev => prev.filter(e => e['Employee ID'] !== empDeleteTarget['Employee ID']));
      showToast('Employee removed.', 'success');
    } catch {
      showToast('Failed to remove employee.', 'error');
    } finally {
      setEmpSaving(false);
      setEmpDeleteTarget(null);
    }
  };

  const handleToggleStatus = async (emp: Employee) => {
    const updated = { ...emp, Status: emp.Status === 'Active' ? 'Inactive' : 'Active' };
    try {
      await updateEmployee(String(emp['Employee ID']), { Status: updated.Status });
      setEmployees(prev => prev.map(e => e['Employee ID'] === emp['Employee ID'] ? updated : e));
      showToast(`${emp.Employee} marked as ${updated.Status}.`, 'success');
    } catch {
      showToast('Failed to update status.', 'error');
    }
  };

  const filteredEmployees = employees.filter(e =>
    e.Employee.toLowerCase().includes(empSearch.toLowerCase()) ||
    e.Email.toLowerCase().includes(empSearch.toLowerCase()) ||
    (e.Role ?? '').toLowerCase().includes(empSearch.toLowerCase())
  );

  // ── SEO ────────────────────────────────────────────────────────────────────
  const handleSeoSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!seoSiteUrl.trim() || !seoSiteName.trim()) {
      showToast('Site URL and Site Name are required.', 'error');
      return;
    }
    try { new URL(seoSiteUrl); } catch {
      showToast('Please enter a valid URL (e.g. https://inan.com.ng).', 'error');
      return;
    }
    setSeoSaving(true);
    try {
      const payload: SeoSettings = {
        siteUrl: seoSiteUrl.trim().replace(/\/$/, ''),
        siteName: seoSiteName.trim(),
        defaultDescription: seoDescription.trim(),
        ...(seoOgImageUrl ? { ogImageUrl: seoOgImageUrl } : {}),
      };
      await setDoc(doc(db, 'settings', 'seo'), payload);
      showToast('SEO settings saved.', 'success');
    } catch {
      showToast('Failed to save SEO settings.', 'error');
    } finally {
      setSeoSaving(false);
    }
  };

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
      </Section>

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

      {/* ── Employee Records ──────────────────────────────────────────────── */}
      <Section
        title="Employee Records"
        description="Manage staff records used for nominations voting and email verification."
      >
        {/* Search + Add button */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1">
            <Input
              placeholder="Search by name, email or role…"
              value={empSearch}
              onChange={e => setEmpSearch(e.target.value)}
            />
          </div>
          <div className="sm:self-end">
            <Button fullWidth={false} onClick={() => { resetNewEmp(); setShowEmpForm(o => !o); setEditingEmp(null); }}>
              {showEmpForm ? 'Cancel' : '+ Add Employee'}
            </Button>
          </div>
        </div>

        {/* Add employee form */}
        {showEmpForm && (
          <form onSubmit={handleAddEmployee} className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
            <p className="text-sm font-medium text-gray-700">New Employee</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input label="Full Name" value={newEmp.Employee ?? ''} onChange={e => setNewEmp(p => ({ ...p, Employee: e.target.value }))} placeholder="e.g. Jane Doe" required />
              <Input label="Email" type="email" value={newEmp.Email ?? ''} onChange={e => setNewEmp(p => ({ ...p, Email: e.target.value }))} placeholder="jane.doe@inan.com.ng" required />
              <div>
                <label className="block text-lg font-medium text-gray-700 mb-1">Role</label>
                <select value={newEmp.Role ?? ''} onChange={e => setNewEmp(p => ({ ...p, Role: e.target.value }))}
                  className="w-full px-4 py-3 text-lg rounded-lg border-2 border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all">
                  <option value="">Select role…</option>
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <Input label="Reporting To" value={newEmp['Reporting To'] ?? ''} onChange={e => setNewEmp(p => ({ ...p, 'Reporting To': e.target.value }))} placeholder="Manager name" />
              <Input label="Joining Date" type="date" value={newEmp['Joining Date'] ?? ''} onChange={e => setNewEmp(p => ({ ...p, 'Joining Date': e.target.value }))} />
              <Input label="Employment Type (optional)" value={newEmp['Employment Type'] ?? ''} onChange={e => setNewEmp(p => ({ ...p, 'Employment Type': e.target.value }))} placeholder="e.g. On Probation" />
            </div>
            <div className="flex justify-end gap-2">
              <Button fullWidth={false} onClick={() => setShowEmpForm(false)}>Cancel</Button>
              <Button type="submit" fullWidth={false} disabled={empSaving} isLoading={empSaving}>Save Employee</Button>
            </div>
          </form>
        )}

        {/* Edit employee form */}
        {editingEmp && (
          <form onSubmit={handleUpdateEmployee} className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
            <p className="text-sm font-medium text-blue-700">Editing: {editingEmp.Employee}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input label="Full Name" value={editingEmp.Employee} onChange={e => setEditingEmp(p => p ? { ...p, Employee: e.target.value } : p)} required />
              <Input label="Email" type="email" value={editingEmp.Email} onChange={e => setEditingEmp(p => p ? { ...p, Email: e.target.value } : p)} required />
              <div>
                <label className="block text-lg font-medium text-gray-700 mb-1">Role</label>
                <select value={editingEmp.Role ?? ''} onChange={e => setEditingEmp(p => p ? { ...p, Role: e.target.value } : p)}
                  className="w-full px-4 py-3 text-lg rounded-lg border-2 border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all">
                  <option value="">Select role…</option>
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <Input label="Reporting To" value={editingEmp['Reporting To']} onChange={e => setEditingEmp(p => p ? { ...p, 'Reporting To': e.target.value } : p)} />
              <Input label="Joining Date" type="date" value={editingEmp['Joining Date']} onChange={e => setEditingEmp(p => p ? { ...p, 'Joining Date': e.target.value } : p)} />
              <Input label="Employment Type" value={editingEmp['Employment Type'] ?? ''} onChange={e => setEditingEmp(p => p ? { ...p, 'Employment Type': e.target.value } : p)} placeholder="e.g. On Probation" />
            </div>
            <div className="flex justify-end gap-2">
              <Button fullWidth={false} onClick={() => setEditingEmp(null)}>Cancel</Button>
              <Button type="submit" fullWidth={false} disabled={empSaving} isLoading={empSaving}>Update Employee</Button>
            </div>
          </form>
        )}

        {/* Employee table */}
        {empLoading ? (
          <div className="flex justify-center py-6">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600" />
          </div>
        ) : (
          <div className="overflow-x-auto min-h-[120px]">
            <table className="min-w-full divide-y divide-gray-100 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Joined</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-gray-400 italic text-sm">
                      {empSearch ? 'No employees match your search.' : 'No employees loaded yet.'}
                    </td>
                  </tr>
                ) : filteredEmployees.map(emp => (
                  <tr key={String(emp['Employee ID'])} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium text-gray-900 whitespace-nowrap">{emp.Employee}</td>
                    <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{emp.Email}</td>
                    <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{emp.Role ?? '—'}</td>
                    <td className="px-3 py-2">
                      <button onClick={() => handleToggleStatus(emp)}
                        className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full transition-colors ${
                          emp.Status === 'Active'
                            ? 'bg-green-100 text-green-800 hover:bg-green-200'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}>
                        {emp.Status}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-gray-400 whitespace-nowrap">{emp['Joining Date']}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <button onClick={() => { setEditingEmp(emp); setShowEmpForm(false); }}
                          className="text-purple-600 hover:text-purple-800 text-xs font-medium">Edit</button>
                        <button onClick={() => setEmpDeleteTarget(emp)}
                          className="text-red-500 hover:text-red-700 text-xs font-medium">Remove</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredEmployees.length > 0 && (
              <p className="text-xs text-gray-400 mt-2">{filteredEmployees.length} of {employees.length} employee{employees.length !== 1 ? 's' : ''}</p>
            )}
          </div>
        )}
      </Section>

      {/* ── SEO ───────────────────────────────────────────────────────────── */}
      <Section
        title="SEO & Open Graph"
        description="Control how your site appears in search engines and when links are shared on social media."
      >
        <form onSubmit={handleSeoSave} className="space-y-4">
          <Input
            label="Site URL"
            value={seoSiteUrl}
            onChange={e => setSeoSiteUrl(e.target.value)}
            placeholder="https://inan.com.ng"
            type="url"
          />
          <Input
            label="Site Name"
            value={seoSiteName}
            onChange={e => setSeoSiteName(e.target.value)}
            placeholder="Inan Feedback"
          />
          <div>
            <Input
              label="Default Meta Description"
              value={seoDescription}
              onChange={e => setSeoDescription(e.target.value)}
              placeholder="Collect, manage and analyse guest feedback across all Inan hotel locations."
            />
            <p className={`text-xs mt-1 text-right ${seoDescription.length > 160 ? 'text-red-500' : 'text-gray-400'}`}>
              {seoDescription.length}/160 — keep under 160 characters for best results
            </p>
          </div>
          <ImageUpload
            label="Default OG Image"
            hint="Shown when your site is shared on WhatsApp, Twitter, LinkedIn etc. Recommended: 1200 × 630 px."
            currentUrl={seoOgImageUrl}
            storagePath="seo/og-image"
            onUploaded={url => setSeoOgImageUrl(url)}
            onRemoved={() => setSeoOgImageUrl('')}
          />
          <div className="flex justify-end">
            <Button type="submit" disabled={seoSaving} isLoading={seoSaving} fullWidth={false}>
              Save SEO Settings
            </Button>
          </div>
        </form>
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

      {/* ── Employee delete modal ──────────────────────────────────────────── */}
      <Modal
        isOpen={!!empDeleteTarget}
        variant="danger"
        title="Remove this employee?"
        message={`${empDeleteTarget?.Employee} will be removed from the employee records. This cannot be undone.`}
        confirmLabel={empSaving ? 'Removing…' : 'Yes, remove'}
        cancelLabel="Cancel"
        onConfirm={handleDeleteEmployee}
        onCancel={() => setEmpDeleteTarget(null)}
      />

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
