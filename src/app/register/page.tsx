'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import Button from '../../components/Button';
import Input from '../../components/Input';
import Toast from '../../components/Toast';
import { useToast } from '../../hooks/useToast';

function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

type ParsedEmployee = {
  '#': number; Id: number; 'Employee ID': number;
  Employee: string; Email: string; Role: string;
  'Reporting To': string; 'Joining Date': string; Status: string;
  'Employment Type'?: string;
};

function parseCsv(text: string): ParsedEmployee[] {
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const result: ParsedEmployee[] = [];
  lines.slice(1).forEach((line, idx) => {
    const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = values[i] ?? ''; });
    const name = row['Employee'] || row['Name'] || row['Full Name'] || '';
    const email = row['Email'] || row['Email Address'] || '';
    if (!name || !email) return;
    result.push({
      '#': idx + 1, Id: idx + 1, 'Employee ID': idx + 1,
      Employee: name, Email: email,
      Role: row['Role'] || row['Position'] || '',
      'Reporting To': row['Reporting To'] || row['Manager'] || '',
      'Joining Date': row['Joining Date'] || new Date().toISOString().split('T')[0],
      Status: row['Status'] || 'Active',
      ...(row['Employment Type'] ? { 'Employment Type': row['Employment Type'] } : {}),
    });
  });
  return result;
}

export default function RegisterPage() {
  const router = useRouter();
  const { toasts, showToast, dismissToast } = useToast();

  // Branding
  const [tenantName, setTenantName] = useState('');
  const [tenantLogo, setTenantLogo] = useState('');

  // Step 1 — account details
  const [companyName, setCompanyName] = useState('');
  const [yourName, setYourName] = useState('');
  const [workEmail, setWorkEmail] = useState('');
  const [domain, setDomain] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Step 2 — optional employee CSV
  const [step, setStep] = useState<'details' | 'employees'>('details');
  const [createdTenantId, setCreatedTenantId] = useState('');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<string[]>([]);
  const [csvUploading, setCsvUploading] = useState(false);

  useEffect(() => {
    fetch('/api/tenant/current')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.tenant?.name) setTenantName(data.tenant.name);
        if (data?.tenant?.branding?.logoUrl) setTenantLogo(data.tenant.branding.logoUrl);
        if (data?.tenant?.branding?.primaryColor) {
          document.documentElement.style.setProperty('--brand', data.tenant.branding.primaryColor);
        }
      })
      .catch(() => {});
  }, []);

  // ── Step 1 submit ──────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) { showToast('Company name is required.', 'error'); return; }
    if (password !== confirmPassword) { showToast('Passwords do not match.', 'error'); return; }
    if (password.length < 6) { showToast('Password must be at least 6 characters.', 'error'); return; }

    setLoading(true);
    try {
      const credential = await createUserWithEmailAndPassword(auth, workEmail.trim(), password);
      const { user } = credential;
      await updateProfile(user, { displayName: yourName.trim() });

      const tenantId = slugify(companyName);

      const res = await fetch('/api/register-tenant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: user.uid, tenantId,
          companyName: companyName.trim(),
          domain: domain.trim() || `${tenantId}.inanfeedback.com`,
          email: workEmail.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to set up your account.');
      }

      // Wait for the tenantId custom claim to propagate into the token
      // before moving on — Firestore rules depend on it being present.
      let attempts = 0;
      while (attempts < 10) {
        const tokenResult = await auth.currentUser?.getIdTokenResult(true);
        if (tokenResult?.claims?.tenantId) break;
        await new Promise(resolve => setTimeout(resolve, 800));
        attempts++;
      }

      setCreatedTenantId(tenantId);
      showToast('Account created! Optionally upload your staff list below.', 'success');
      setStep('employees');
    } catch (err: any) {
      if (err?.code === 'auth/email-already-in-use') showToast('An account with this email already exists.', 'error');
      else if (err?.code === 'auth/invalid-email') showToast('Please enter a valid email address.', 'error');
      else showToast(err?.message || 'Registration failed. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2 CSV handlers ────────────────────────────────────────────────────
  const handleCsvSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFile(file);
    file.text().then(text => {
      const lines = text.split('\n').filter(l => l.trim()).slice(0, 4);
      setCsvPreview(lines);
    });
  };

  const handleCsvUpload = async () => {
    if (!csvFile) { router.push('/dashboard?welcome=1'); return; }
    setCsvUploading(true);
    try {
      const text = await csvFile.text();
      const parsed = parseCsv(text);
      if (parsed.length === 0) { showToast('No valid rows found. Check that your CSV has Employee and Email columns.', 'error'); return; }

      const res = await fetch('/api/import-employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: createdTenantId, employees: parsed }),
      });
      if (!res.ok) throw new Error('Upload failed');
      showToast(`Imported ${parsed.length} employee${parsed.length !== 1 ? 's' : ''} successfully.`, 'success');
    } catch {
      showToast('Failed to upload employees. You can add them later in Settings.', 'error');
    } finally {
      setCsvUploading(false);
      router.push('/dashboard?welcome=1');
    }
  };

  const poweredBy = (
    <div className="text-center text-xs text-gray-400">
      Powered by{' '}
      <a href="https://inanmanagement.com" target="_blank" rel="noopener noreferrer" className="hover:text-gray-600">
        Inan Management Ltd
      </a>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-purple-50 via-white to-purple-100">
      <Toast toasts={toasts} onDismiss={dismissToast} />
      <div className="w-full max-w-md space-y-6">

        {/* ── Step 1: Account details ─────────────────────────────────────── */}
        {step === 'details' && (
          <>
            <div className="text-center">
              {tenantLogo && (
                <div className="flex justify-center mb-3">
                  <img src={tenantLogo} alt={tenantName} className="h-10 w-auto max-w-[180px] object-contain" />
                </div>
              )}
              <h1 className="text-3xl font-bold text-gray-900">Create Your Account</h1>
              <p className="text-gray-500 text-sm mt-2">
                {tenantName ? `Start collecting feedback for ${tenantName}.` : 'Start collecting feedback for your organisation.'}
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-8 space-y-4">
              <form onSubmit={handleSubmit} className="space-y-4">
                <Input label="Company Name" value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="e.g. Acme Corp" required />
                <Input label="Your Name" value={yourName} onChange={e => setYourName(e.target.value)} placeholder="e.g. Jane Doe" required />
                <Input label="Work Email" type="email" value={workEmail} onChange={e => setWorkEmail(e.target.value)} placeholder="jane@acme.com" required />
                <Input label="Dashboard Domain (optional)" value={domain} onChange={e => setDomain(e.target.value)} placeholder="e.g. feedback.acme.com" />
                <Input label="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 6 characters" required />
                <Input label="Confirm Password" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Repeat your password" required />
                <Button type="submit" disabled={loading} isLoading={loading} loadingText="Creating account…">
                  Create Account
                </Button>
              </form>
              <p className="text-center text-sm text-gray-500">
                Already have an account?{' '}
                <a href="/login" className="text-purple-600 hover:underline font-medium">Sign in here</a>
              </p>
            </div>

            {poweredBy}
          </>
        )}

        {/* ── Step 2: Optional employee CSV upload ────────────────────────── */}
        {step === 'employees' && (
          <>
            <div className="text-center">
              <div className="flex items-center justify-center w-14 h-14 rounded-full bg-green-100 mx-auto mb-3">
                <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Account Created!</h1>
              <p className="text-gray-500 text-sm mt-1">
                Optionally upload your staff list now, or skip and add them later in Settings.
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-8 space-y-5">
              <div>
                <p className="text-sm font-medium text-gray-700 mb-1">Upload Staff List (CSV)</p>
                <p className="text-xs text-gray-400 mb-3">
                  Required columns: <strong>Employee</strong>, <strong>Email</strong>. Optional: Role, Reporting To, Joining Date, Status, Employment Type.
                </p>

                <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-purple-400 hover:bg-purple-50 transition-colors">
                  <svg className="w-7 h-7 text-gray-400 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  <span className="text-sm text-gray-500">{csvFile ? csvFile.name : 'Click to select a CSV file'}</span>
                  <input type="file" accept=".csv" className="hidden" onChange={handleCsvSelect} />
                </label>

                {/* Preview */}
                {csvPreview.length > 0 && (
                  <div className="mt-3 bg-gray-50 rounded-lg p-3 overflow-x-auto">
                    <p className="text-xs text-gray-400 mb-1">Preview (first 3 rows):</p>
                    {csvPreview.map((line, i) => (
                      <p key={i} className={`text-xs font-mono truncate ${i === 0 ? 'font-semibold text-gray-700' : 'text-gray-500'}`}>{line}</p>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <Button
                  onClick={handleCsvUpload}
                  disabled={csvUploading}
                  isLoading={csvUploading}
                  loadingText="Uploading…"
                >
                  {csvFile ? 'Upload & Go to Dashboard' : 'Skip & Go to Dashboard'}
                </Button>
              </div>
            </div>

            {poweredBy}
          </>
        )}

      </div>
    </div>
  );
}
