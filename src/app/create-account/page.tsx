'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { createUserWithEmailAndPassword, updateProfile, sendEmailVerification } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Button from '../../components/Button';
import Input from '../../components/Input';
import Toast from '../../components/Toast';
import { useToast } from '../../hooks/useToast';

// ── Password strength ─────────────────────────────────────────────────────────

const RULES = [
  { label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { label: 'At least one uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'At least one number', test: (p: string) => /[0-9]/.test(p) },
  { label: 'At least one symbol (e.g. !@#$)', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

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

function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;
  const passed = RULES.filter(r => r.test(password)).length;
  const colors = ['bg-red-400', 'bg-orange-400', 'bg-yellow-400', 'bg-green-500'];
  const labels = ['Weak', 'Fair', 'Good', 'Strong'];
  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex gap-1">
        {RULES.map((_, i) => (
          <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i < passed ? colors[passed - 1] : 'bg-gray-200'}`} />
        ))}
      </div>
      <p className={`text-xs font-medium ${passed <= 1 ? 'text-red-500' : passed === 2 ? 'text-orange-500' : passed === 3 ? 'text-yellow-600' : 'text-green-600'}`}>
        {password ? labels[passed - 1] ?? 'Weak' : ''}
      </p>
      <ul className="space-y-0.5">
        {RULES.map((rule) => (
          <li key={rule.label} className={`flex items-center gap-1.5 text-xs ${rule.test(password) ? 'text-green-600' : 'text-gray-400'}`}>
            <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {rule.test(password)
                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 12m-4 0a4 4 0 108 0 4 4 0 00-8 0" />}
            </svg>
            {rule.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

function CreateAccountInner() {
  const router = useRouter();
  const { toasts, showToast, dismissToast } = useToast();

  const [yourName, setYourName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const [tenantName, setTenantName] = useState('');
  const [tenantLogo, setTenantLogo] = useState('');

  // Load tenant branding
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

  const isPasswordStrong = RULES.every(r => r.test(password));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isPasswordStrong) {
      showToast('Password does not meet all requirements.', 'error');
      return;
    }
    if (password !== confirmPassword) {
      showToast('Passwords do not match.', 'error');
      return;
    }

    setLoading(true);
    try {
      const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const { user } = credential;

      if (yourName.trim()) {
        await updateProfile(user, { displayName: yourName.trim() });
      }

      // Register under the current tenant
      const res = await fetch('/api/add-tenant-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: user.uid, email: user.email }),
      });

      if (!res.ok) {
        await user.delete();
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || 'Failed to set up your account.');
      }

      const isCustom = isCustomDomainEmail(email.trim());

      if (isCustom) {
        // Call custom verification endpoint instead of client-side Firebase sendEmailVerification
        const sendRes = await fetch('/api/auth/send-verification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid: user.uid, email: email.trim() }),
        });
        if (!sendRes.ok) {
          const data = await sendRes.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to send verification email.');
        }

        // Store email and uid in sessionStorage so /verify-email can handle resend.
        sessionStorage.setItem('verify_email', email.trim());
        sessionStorage.setItem('verify_uid', user.uid);
      } else {
        // Native Firebase verification
        await sendEmailVerification(user);

        // Store credentials in sessionStorage so /verify-email can handle polling and resend
        sessionStorage.setItem('verify_email', email.trim());
        sessionStorage.setItem('verify_password', password);
      }

      // Sign out before navigating — must verify before accessing dashboard
      await auth.signOut();

      const redirectUrl = isCustom
        ? `/verify-email?email=${encodeURIComponent(email.trim())}&uid=${user.uid}`
        : `/verify-email?email=${encodeURIComponent(email.trim())}`;
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

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-purple-50 via-white to-purple-100">
      <Toast toasts={toasts} onDismiss={dismissToast} />
      <div className="w-full max-w-md space-y-6">

        <div className="text-center">
          <Link href="/login" className="inline-flex items-center text-sm text-purple-600 hover:text-purple-800 mb-4">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Sign In
          </Link>
          {tenantLogo && (
            <div className="flex justify-center mb-3">
              <img src={tenantLogo} alt={tenantName} className="h-10 w-auto max-w-[180px] object-contain" />
            </div>
          )}
          <h1 className="text-xl font-bold text-gray-900">Create Your Account</h1>
          <p className="text-gray-500 text-sm mt-2">
            {tenantName ? `Join ${tenantName} on INAN Feedback.` : 'Create your account to get started.'}
            {' '}You&apos;ll verify your email before signing in.
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-8 space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Your Name"
              value={yourName}
              onChange={e => setYourName(e.target.value)}
              placeholder="e.g. Jane Doe"
              required
            />
            <Input
              label="Email Address"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="jane@company.com"
              autoComplete="email"
              required
            />
            <div>
              <Input
                label="Password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Create a strong password"
                autoComplete="new-password"
                required
              />
              <PasswordStrength password={password} />
            </div>
            <Input
              label="Confirm Password"
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Repeat your password"
              autoComplete="new-password"
              required
            />
            {confirmPassword && confirmPassword !== password && (
              <p className="text-xs text-red-500 -mt-2">Passwords do not match.</p>
            )}
            <Button
              type="submit"
              disabled={loading || !isPasswordStrong || password !== confirmPassword}
              isLoading={loading}
              loadingText="Creating account…"
            >
              Create Account
            </Button>
          </form>
          <p className="text-center text-sm text-gray-500">
            Already have an account?{' '}
            <Link href="/login" className="text-purple-600 hover:underline font-medium">Sign in here</Link>
          </p>
        </div>

        <div className="text-center text-xs text-gray-400">
          Powered by{' '}
          <a href="https://inanmanagement.com" target="_blank" rel="noopener noreferrer" className="hover:text-gray-600">
            Inan Management Ltd
          </a>
        </div>
      </div>
    </div>
  );
}

export default function CreateAccountPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-white to-purple-100">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
      </div>
    }>
      <CreateAccountInner />
    </Suspense>
  );
}
