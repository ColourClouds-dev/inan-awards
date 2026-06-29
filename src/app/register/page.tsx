'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { createUserWithEmailAndPassword, updateProfile, sendEmailVerification } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import Button from '../../components/Button';
import Input from '../../components/Input';
import Toast from '../../components/Toast';
import { useToast } from '../../hooks/useToast';

function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

const STANDARD_DOMAINS = new Set([
  'gmail.com',
  'yahoo.com',
  'hotmail.com',
  'outlook.com',
  'icloud.com',
  'aol.com',
  'proton.me',
  'protonmail.com',
  'zoho.com',
  'yandex.com',
  'mail.com',
  'gmx.com'
]);

function isCustomDomainEmail(email: string): boolean {
  if (!email || !email.includes('@')) return true;
  const domain = email.split('@').pop()?.trim().toLowerCase() ?? '';
  return !STANDARD_DOMAINS.has(domain);
}

function RegisterPageInner() {
  const router = useRouter();
  const { toasts, showToast, dismissToast } = useToast();
  const searchParams = useSearchParams();
  const inviteToken = searchParams?.get('invite') ?? '';

  const [inviteValid, setInviteValid] = useState<boolean | null>(inviteToken ? null : false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteTenantName, setInviteTenantName] = useState('');
  const [inviteError, setInviteError] = useState('');

  const [tenantName, setTenantName] = useState('');
  const [tenantLogo, setTenantLogo] = useState('');

  const [companyName, setCompanyName] = useState('');
  const [yourName, setYourName] = useState('');
  const [workEmail, setWorkEmail] = useState('');
  const [domain, setDomain] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Validate invite token on load
  useEffect(() => {
    if (!inviteToken) return;
    fetch(`/api/invite-staff/validate?token=${encodeURIComponent(inviteToken)}`)
      .then(r => r.json())
      .then(data => {
        if (data.valid) {
          setInviteValid(true);
          setInviteEmail(data.email);
          setInviteTenantName(data.tenantName);
          setWorkEmail(data.email);
        } else {
          setInviteValid(false);
          setInviteError(data.error ?? 'Invalid invitation.');
        }
      })
      .catch(() => { setInviteValid(false); setInviteError('Could not validate invitation.'); });
  }, [inviteToken]);

  useEffect(() => {
    if (inviteToken) return;
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
  }, [inviteToken]);

  const isInviteMode = !!inviteToken;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isInviteMode && !companyName.trim()) { showToast('Company name is required.', 'error'); return; }
    if (password !== confirmPassword) { showToast('Passwords do not match.', 'error'); return; }
    if (password.length < 6) { showToast('Password must be at least 6 characters.', 'error'); return; }

    setLoading(true);
    try {
      const emailToUse = isInviteMode ? inviteEmail : workEmail.trim();
      const credential = await createUserWithEmailAndPassword(auth, emailToUse, password);
      const { user } = credential;
      await updateProfile(user, { displayName: yourName.trim() });

      if (isInviteMode) {
        const res = await fetch('/api/add-tenant-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid: user.uid, email: emailToUse, inviteToken }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Failed to set up your account.');
        }
      } else {
        const tenantId = slugify(companyName);
        const res = await fetch('/api/register-tenant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            uid: user.uid, tenantId,
            companyName: companyName.trim(),
            domain: domain.trim() || `${tenantId}.inanfeedback.com`,
            email: emailToUse,
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Failed to set up your account.');
        }
      }

      const isCustom = isCustomDomainEmail(emailToUse);

      if (isCustom) {
        // Call custom verification endpoint instead of client-side Firebase sendEmailVerification
        const sendRes = await fetch('/api/auth/send-verification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid: user.uid, email: emailToUse }),
        });
        if (!sendRes.ok) {
          const data = await sendRes.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to send verification email.');
        }

        // Store email and uid in sessionStorage so /verify-email can handle resend.
        sessionStorage.setItem('verify_email', emailToUse);
        sessionStorage.setItem('verify_uid', user.uid);
      } else {
        // Native Firebase verification
        await sendEmailVerification(user);

        // Store credentials in sessionStorage so /verify-email can handle polling and resend
        sessionStorage.setItem('verify_email', emailToUse);
        sessionStorage.setItem('verify_password', password);
      }

      // Sign out immediately — must verify before accessing the dashboard.
      await auth.signOut();

      const redirectUrl = isCustom
        ? `/verify-email?email=${encodeURIComponent(emailToUse)}&uid=${user.uid}`
        : `/verify-email?email=${encodeURIComponent(emailToUse)}`;
      router.push(redirectUrl);
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code === 'auth/email-already-in-use') showToast('An account with this email already exists.', 'error');
      else if (code === 'auth/invalid-email') showToast('Please enter a valid email address.', 'error');
      else showToast((err as Error).message || 'Registration failed. Please try again.', 'error');
    } finally {
      setLoading(false);
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

  if (isInviteMode && inviteValid === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-white to-purple-100">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
      </div>
    );
  }

  if (isInviteMode && inviteValid === false) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-purple-50 via-white to-purple-100">
        <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-8 text-center space-y-4">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-lg font-bold text-gray-900">Invitation Invalid</h1>
          <p className="text-sm text-gray-500">{inviteError}</p>
          <Link href="/login" className="inline-block text-sm text-purple-600 hover:underline">← Back to Sign In</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-purple-50 via-white to-purple-100">
      <Toast toasts={toasts} onDismiss={dismissToast} />
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <Link href="/" className="inline-flex items-center text-sm text-purple-600 hover:text-purple-800 mb-4">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Home
          </Link>
          {tenantLogo && !isInviteMode && (
            <div className="flex justify-center mb-3">
              <img src={tenantLogo} alt={tenantName} className="h-10 w-auto max-w-[180px] object-contain" />
            </div>
          )}
          <h1 className="text-xl font-bold text-gray-900">
            {isInviteMode ? `Join ${inviteTenantName}` : 'Set Up Your Organisation'}
          </h1>
          <p className="text-gray-500 text-sm mt-2">
            {isInviteMode
              ? `You've been invited to join ${inviteTenantName}. Create your account to get started.`
              : 'Create your company profile and get started — build forms, collect feedback, and manage your team all in one place.'}
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-8 space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isInviteMode && (
              <>
                <Input label="Company Name" value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="e.g. Acme Corp" required />
                <Input label="Dashboard Domain (optional)" value={domain} onChange={e => setDomain(e.target.value)} placeholder="e.g. feedback.acme.com" />
              </>
            )}
            <Input label="Your Name" value={yourName} onChange={e => setYourName(e.target.value)} placeholder="e.g. Jane Doe" required />
            {isInviteMode ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                <input
                  type="email"
                  value={inviteEmail}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-500 cursor-not-allowed"
                />
                <p className="text-xs text-gray-400 mt-1">This email was set by your invitation.</p>
              </div>
            ) : (
              <Input label="Work Email" type="email" value={workEmail} onChange={e => setWorkEmail(e.target.value)} placeholder="jane@acme.com" required />
            )}
            <Input label="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 6 characters" required />
            <Input label="Confirm Password" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Repeat your password" required />
            <Button type="submit" disabled={loading} isLoading={loading} loadingText="Creating account…">
              {isInviteMode ? 'Create Staff Account' : 'Create Account'}
            </Button>
          </form>
          <p className="text-center text-sm text-gray-500">
            Already have an account?{' '}
            <a href="/login" className="text-purple-600 hover:underline font-medium">Sign in here</a>
          </p>
        </div>
        {poweredBy}
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-white to-purple-100">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
      </div>
    }>
      <RegisterPageInner />
    </Suspense>
  );
}
