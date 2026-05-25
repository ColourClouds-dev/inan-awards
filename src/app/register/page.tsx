'use client';

import React, { useState, useEffect } from 'react';
import { createUserWithEmailAndPassword, updateProfile, sendEmailVerification } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import Button from '../../components/Button';
import Input from '../../components/Input';
import Toast from '../../components/Toast';
import { useToast } from '../../hooks/useToast';

function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export default function RegisterPage() {
  const { toasts, showToast, dismissToast } = useToast();

  const [tenantName, setTenantName] = useState('');
  const [tenantLogo, setTenantLogo] = useState('');

  const [companyName, setCompanyName] = useState('');
  const [yourName, setYourName] = useState('');
  const [workEmail, setWorkEmail] = useState('');
  const [domain, setDomain] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const [step, setStep] = useState<'details' | 'verify'>('details');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resending, setResending] = useState(false);

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

  // Countdown timer for resend cooldown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

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

      // Send Firebase email verification
      await sendEmailVerification(user);

      setStep('verify');
      setResendCooldown(60);
    } catch (err: any) {
      if (err?.code === 'auth/email-already-in-use') showToast('An account with this email already exists.', 'error');
      else if (err?.code === 'auth/invalid-email') showToast('Please enter a valid email address.', 'error');
      else showToast(err?.message || 'Registration failed. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || resending) return;
    setResending(true);
    try {
      const user = auth.currentUser;
      if (user) {
        await sendEmailVerification(user);
        showToast('Verification email resent.', 'success');
        setResendCooldown(60);
      }
    } catch {
      showToast('Failed to resend. Please try again.', 'error');
    } finally {
      setResending(false);
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
              <h1 className="text-xl font-bold text-gray-900">Create Your Account</h1>
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

        {/* ── Step 2: Check your email ────────────────────────────────────── */}
        {step === 'verify' && (
          <>
            <div className="text-center">
              {/* Animated envelope */}
              <div className="flex justify-center mb-4">
                <div
                  className="w-20 h-20 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: 'color-mix(in srgb, var(--brand) 12%, white)' }}
                >
                  <svg
                    className="w-10 h-10"
                    style={{ color: 'var(--brand)' }}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                      style={{
                        strokeDasharray: 80,
                        strokeDashoffset: 80,
                        animation: 'envelopeDraw 0.7s ease-out 0.1s forwards',
                      }}
                    />
                  </svg>
                </div>
              </div>

              <style>{`
                @keyframes envelopeDraw { to { stroke-dashoffset: 0; } }
              `}</style>

              <h1 className="text-xl font-bold text-gray-900 mb-2">Check your email</h1>
              <p className="text-gray-500 text-sm">
                We sent a verification link to
              </p>
              <p className="font-semibold text-gray-800 text-sm mt-1 mb-4">{workEmail}</p>
              <p className="text-gray-500 text-sm max-w-xs mx-auto">
                Click the link in the email to verify your account. Once verified, you can sign in.
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6 space-y-4">
              {/* Resend */}
              <div className="text-center">
                <p className="text-sm text-gray-500 mb-3">Didn't receive it? Check your spam folder or resend.</p>
                <Button
                  onClick={handleResend}
                  disabled={resendCooldown > 0 || resending}
                  isLoading={resending}
                  loadingText="Sending…"
                  fullWidth={false}
                >
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Email'}
                </Button>
              </div>

              <div className="border-t border-gray-100 pt-4 text-center">
                <a
                  href="/login"
                  className="text-sm font-medium hover:underline"
                  style={{ color: 'var(--brand)' }}
                >
                  ← Back to Sign In
                </a>
              </div>
            </div>

            {poweredBy}
          </>
        )}

      </div>
    </div>
  );
}
