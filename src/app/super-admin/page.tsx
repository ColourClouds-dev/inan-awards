'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { getAllTenants, saveTenant, updateTenant } from '../../lib/tenantFirestore';
import type { Tenant, TenantFeatures } from '../../types';
import Button from '../../components/Button';
import Input from '../../components/Input';
import Modal from '../../components/Modal';
import Toast from '../../components/Toast';
import { useToast } from '../../hooks/useToast';

const DEFAULT_FEATURES: TenantFeatures = {
  feedbackForms: true,
  nominations: false,
  employeeRecords: false,
  seoSettings: false,
  hidePoweredBy: false,
};

const FEATURE_LABELS: Record<keyof TenantFeatures, string> = {
  feedbackForms: 'Feedback Forms',
  nominations: 'Nominations',
  employeeRecords: 'Employee Records',
  seoSettings: 'SEO Settings',
  hidePoweredBy: 'Hide "Powered by" badge',
};

export default function SuperAdminPage() {
  const router = useRouter();
  const { toasts, showToast, dismissToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit modal state
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [editForm, setEditForm] = useState<Partial<Tenant>>({});
  const [editSaving, setEditSaving] = useState(false);

  // New tenant form state
  const [newTenant, setNewTenant] = useState<Partial<Tenant>>({
    id: '', name: '', domain: '', emailDomain: '',
    plan: 'trial', status: 'trial',
    formLimit: 5, nominationFormLimit: 2,
    formCount: 0, nominationFormCount: 0,
    features: { ...DEFAULT_FEATURES },
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) { router.push('/dashboard'); return; }
      try {
        const tokenResult = await user.getIdTokenResult();
        if (!tokenResult.claims.superAdmin) { router.push('/dashboard'); return; }
        setAuthorized(true);
        const list = await getAllTenants();
        setTenants(list);
      } catch {
        router.push('/dashboard');
      } finally {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [router]);

  // ── Add tenant ─────────────────────────────────────────────────────────────
  const handleAddTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTenant.id?.trim() || !newTenant.name?.trim() || !newTenant.domain?.trim()) {
      showToast('ID, name and domain are required.', 'error');
      return;
    }
    setSaving(true);
    try {
      const tenant: Tenant = {
        id: newTenant.id!.trim().toLowerCase().replace(/\s+/g, '-'),
        name: newTenant.name!.trim(),
        domain: newTenant.domain!.trim(),
        emailDomain: newTenant.emailDomain?.trim() || undefined,
        plan: newTenant.plan as Tenant['plan'] ?? 'trial',
        status: newTenant.status as Tenant['status'] ?? 'trial',
        formLimit: Number(newTenant.formLimit) || 5,
        nominationFormLimit: Number(newTenant.nominationFormLimit) || 2,
        formCount: 0, nominationFormCount: 0,
        features: newTenant.features as TenantFeatures ?? { ...DEFAULT_FEATURES },
        createdAt: new Date(),
      };
      await saveTenant(tenant);
      setTenants(prev => [...prev, tenant]);
      setShowAddForm(false);
      setNewTenant({
        id: '', name: '', domain: '', emailDomain: '', plan: 'trial', status: 'trial',
        formLimit: 5, nominationFormLimit: 2, formCount: 0, nominationFormCount: 0,
        features: { ...DEFAULT_FEATURES },
      });
      showToast('Tenant created.', 'success');
    } catch {
      showToast('Failed to create tenant.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ── Toggle active/inactive ─────────────────────────────────────────────────
  const handleToggleStatus = async (tenant: Tenant) => {
    const newStatus: Tenant['status'] = tenant.status === 'active' ? 'inactive' : 'active';
    try {
      await updateTenant(tenant.id, { status: newStatus });
      setTenants(prev => prev.map(t => t.id === tenant.id ? { ...t, status: newStatus } : t));
      showToast(`Tenant ${newStatus}.`, 'success');
    } catch {
      showToast('Failed to update status.', 'error');
    }
  };

  // ── Open edit modal ────────────────────────────────────────────────────────
  const openEdit = (tenant: Tenant) => {
    setEditingTenant(tenant);
    setEditForm({
      name: tenant.name,
      domain: tenant.domain,
      emailDomain: tenant.emailDomain ?? '',
      plan: tenant.plan,
      formLimit: tenant.formLimit,
      nominationFormLimit: tenant.nominationFormLimit,
      features: { ...tenant.features },
    });
  };

  // ── Save edit ──────────────────────────────────────────────────────────────
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTenant) return;
    if (!editForm.name?.trim() || !editForm.domain?.trim()) {
      showToast('Name and domain are required.', 'error');
      return;
    }
    setEditSaving(true);
    try {
      const updates: Partial<Tenant> = {
        name: editForm.name!.trim(),
        domain: editForm.domain!.trim(),
        emailDomain: editForm.emailDomain?.trim() || undefined,
        plan: editForm.plan as Tenant['plan'],
        formLimit: Number(editForm.formLimit) || 5,
        nominationFormLimit: Number(editForm.nominationFormLimit) || 2,
        features: editForm.features as TenantFeatures,
      };
      await updateTenant(editingTenant.id, updates);
      setTenants(prev => prev.map(t => t.id === editingTenant.id ? { ...t, ...updates } : t));
      setEditingTenant(null);
      showToast('Tenant updated.', 'success');
    } catch {
      showToast('Failed to update tenant.', 'error');
    } finally {
      setEditSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
      </div>
    );
  }

  if (!authorized) return null;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <Toast toasts={toasts} onDismiss={dismissToast} />

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Super Admin</h1>
        <Button fullWidth={false} onClick={() => setShowAddForm(o => !o)}>
          {showAddForm ? 'Cancel' : '+ Add Tenant'}
        </Button>
      </div>

      {/* ── Add Tenant Form ─────────────────────────────────────────────── */}
      {showAddForm && (
        <form onSubmit={handleAddTenant} className="bg-white shadow rounded-lg p-6 space-y-4">
          <h2 className="text-lg font-semibold">New Tenant</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Tenant ID (slug)" value={newTenant.id ?? ''} onChange={e => setNewTenant(p => ({ ...p, id: e.target.value }))} placeholder="e.g. acme-corp" required />
            <Input label="Display Name" value={newTenant.name ?? ''} onChange={e => setNewTenant(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Acme Corp" required />
            <Input label="Domain" value={newTenant.domain ?? ''} onChange={e => setNewTenant(p => ({ ...p, domain: e.target.value }))} placeholder="e.g. feedback.acme.com" required />
            <Input label="Email Domain (optional)" value={newTenant.emailDomain ?? ''} onChange={e => setNewTenant(p => ({ ...p, emailDomain: e.target.value }))} placeholder="e.g. acme.com" />
            <div>
              <label className="block text-lg font-medium text-gray-700 mb-1">Plan</label>
              <select value={newTenant.plan} onChange={e => setNewTenant(p => ({ ...p, plan: e.target.value as Tenant['plan'] }))}
                className="w-full px-4 py-3 text-lg rounded-lg border-2 border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all">
                <option value="trial">Trial</option>
                <option value="basic">Basic</option>
                <option value="pro">Pro</option>
              </select>
            </div>
            <Input label="Form Limit" type="number" value={String(newTenant.formLimit ?? 5)} onChange={e => setNewTenant(p => ({ ...p, formLimit: parseInt(e.target.value) || 5 }))} />
            <Input label="Nomination Form Limit" type="number" value={String(newTenant.nominationFormLimit ?? 2)} onChange={e => setNewTenant(p => ({ ...p, nominationFormLimit: parseInt(e.target.value) || 2 }))} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Features</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {(Object.keys(DEFAULT_FEATURES) as (keyof TenantFeatures)[]).map(key => (
                <label key={key} className="flex items-center gap-2 text-sm">
                  <input type="checkbox"
                    checked={(newTenant.features as TenantFeatures)?.[key] ?? false}
                    onChange={e => setNewTenant(p => ({ ...p, features: { ...(p.features as TenantFeatures), [key]: e.target.checked } }))}
                    className="h-4 w-4 text-purple-600 rounded"
                  />
                  {FEATURE_LABELS[key]}
                </label>
              ))}
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="submit" fullWidth={false} disabled={saving} isLoading={saving} loadingText="Creating…">Create Tenant</Button>
          </div>
        </form>
      )}

      {/* ── Tenants List ────────────────────────────────────────────────── */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-800">Tenants ({tenants.length})</h2>
        {tenants.length === 0 && (
          <div className="bg-white rounded-lg shadow p-6 text-center text-gray-400">No tenants yet.</div>
        )}
        {tenants.map(tenant => (
          <div key={tenant.id} className="bg-white shadow rounded-lg p-5 space-y-2">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-gray-900">{tenant.name}</h3>
                  <span className="text-xs text-gray-400 font-mono">{tenant.id}</span>
                  <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${
                    tenant.status === 'active' ? 'bg-green-100 text-green-800' :
                    tenant.status === 'trial' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-600'
                  }`}>{tenant.status}</span>
                  <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-purple-100 text-purple-700">{tenant.plan}</span>
                </div>
                <p className="text-sm text-gray-500 mt-0.5">{tenant.domain}</p>
                {tenant.emailDomain && <p className="text-xs text-gray-400">Email: @{tenant.emailDomain}</p>}
                <p className="text-xs text-gray-400 mt-0.5">
                  Forms: {tenant.formCount}/{tenant.formLimit} · Nominations: {tenant.nominationFormCount}/{tenant.nominationFormLimit}
                </p>
              </div>

              {/* Action icons */}
              <div className="flex items-center gap-1 shrink-0">
                {/* Edit icon */}
                <button
                  onClick={() => openEdit(tenant)}
                  title="Edit tenant"
                  className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-md transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>

                {/* Toggle active/inactive icon */}
                <button
                  onClick={() => handleToggleStatus(tenant)}
                  title={tenant.status === 'active' ? 'Deactivate tenant' : 'Activate tenant'}
                  className={`p-1.5 rounded-md transition-colors ${
                    tenant.status === 'active'
                      ? 'text-yellow-600 hover:bg-yellow-50'
                      : 'text-green-600 hover:bg-green-50'
                  }`}
                >
                  {tenant.status === 'active' ? (
                    // Pause / deactivate icon
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ) : (
                    // Activate / check icon
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Edit Tenant Modal ────────────────────────────────────────────── */}
      <Modal
        isOpen={!!editingTenant}
        title={`Edit — ${editingTenant?.name ?? ''}`}
        onCancel={() => setEditingTenant(null)}
        cancelLabel="Cancel"
      >
        {editingTenant && (
          <form onSubmit={handleSaveEdit} className="space-y-4 text-left mt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input label="Display Name" value={editForm.name ?? ''} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} required />
              <Input label="Domain" value={editForm.domain ?? ''} onChange={e => setEditForm(p => ({ ...p, domain: e.target.value }))} required />
              <Input label="Email Domain" value={editForm.emailDomain ?? ''} onChange={e => setEditForm(p => ({ ...p, emailDomain: e.target.value }))} placeholder="e.g. acme.com" />
              <div>
                <label className="block text-lg font-medium text-gray-700 mb-1">Plan</label>
                <select value={editForm.plan ?? 'trial'} onChange={e => setEditForm(p => ({ ...p, plan: e.target.value as Tenant['plan'] }))}
                  className="w-full px-4 py-3 text-lg rounded-lg border-2 border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all">
                  <option value="trial">Trial</option>
                  <option value="basic">Basic</option>
                  <option value="pro">Pro</option>
                </select>
              </div>
              <Input label="Form Limit" type="number" value={String(editForm.formLimit ?? 5)} onChange={e => setEditForm(p => ({ ...p, formLimit: parseInt(e.target.value) || 5 }))} />
              <Input label="Nomination Form Limit" type="number" value={String(editForm.nominationFormLimit ?? 2)} onChange={e => setEditForm(p => ({ ...p, nominationFormLimit: parseInt(e.target.value) || 2 }))} />
            </div>

            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Features</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {(Object.keys(DEFAULT_FEATURES) as (keyof TenantFeatures)[]).map(key => (
                  <label key={key} className="flex items-center gap-2 text-sm">
                    <input type="checkbox"
                      checked={(editForm.features as TenantFeatures)?.[key] ?? false}
                      onChange={e => setEditForm(p => ({ ...p, features: { ...(p.features as TenantFeatures), [key]: e.target.checked } }))}
                      className="h-4 w-4 text-purple-600 rounded"
                    />
                    {FEATURE_LABELS[key]}
                  </label>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button fullWidth={false} onClick={() => setEditingTenant(null)}>Cancel</Button>
              <Button type="submit" fullWidth={false} disabled={editSaving} isLoading={editSaving} loadingText="Saving…">
                Save Changes
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
