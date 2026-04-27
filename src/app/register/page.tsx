'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import Button from '../../components/Button';
import Input from '../../components/Input';
import Toast from '../../components/Toast';
import { useToast } from '../../hooks/useToast';

/** Convert a company name to a URL-safe slug */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export default function RegisterPage() {
  const router = useRouter();
  const { toasts, showToast, dismissToast } = useToast();
  const [companyName, setCompanyName] = useState('');
  const [yourName, setYourName] = useState('');
  const [workEmail, setWorkEmail] = useState('');
  const [domain, setDomain] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!companyName.trim()) {
      showToast('Company name is required.', 'error');
      return;
    }
    if (password !== confirmPassword) {
      showToast('Passwords do not match.', 'error');
      return;
    }
    if (password.length < 6) {
      showToast('Password must be at least 6 characters.', 'error');
      return;
    }

    setLoading(true);
    try {
      // 1. Create Firebase Auth account
      const credential = await createUserWithEmailAndPassword(auth, workEmail.trim(), password);
      const { user } = credential;
      await updateProfile(user, { displayName: yourName.trim() });

      const tenantId = slugify(companyName);

      // 2. Call server-side API to create tenant + tenant-admins documents
      //    (client cannot write to 'tenants' collection directly — requires server-side)
      const res = await fetch('/api/register-tenant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: user.uid,
          tenantId,
          companyName: companyName.trim(),
          domain: domain.trim() || `${tenantId}.inanfeedback.com`,
          email: workEmail.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to set up your account.');
      }

      showToast('Account created successfully! Redirecting…', 'success');
      setTimeout(() => router.push('/dashboard?welcome=1'), 1500);
    } catch (err: any) {
      if (err?.code === 'auth/email-already-in-use') {
        showToast('An account with this email already exists.', 'error');
      } else if (err?.code === 'auth/invalid-email') {
        showToast('Please enter a valid email address.', 'error');
      } else {
        showToast(err?.message || 'Registration failed. Please try again.', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-purple-50 via-white to-purple-100">
      <Toast toasts={toasts} onDismiss={dismissToast} />
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">Create Your Account</h1>
          <p className="text-gray-500 text-sm mt-2">Start collecting feedback for your organisation.</p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-xl shadow-lg p-8 space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Company Name"
              value={companyName}
              onChange={e => setCompanyName(e.target.value)}
              placeholder="e.g. Acme Corp"
              required
            />
            <Input
              label="Your Name"
              value={yourName}
              onChange={e => setYourName(e.target.value)}
              placeholder="e.g. Jane Doe"
              required
            />
            <Input
              label="Work Email"
              type="email"
              value={workEmail}
              onChange={e => setWorkEmail(e.target.value)}
              placeholder="jane@acme.com"
              required
            />
            <Input
              label="Dashboard Domain (optional)"
              value={domain}
              onChange={e => setDomain(e.target.value)}
              placeholder="e.g. feedback.acme.com"
            />
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              required
            />
            <Input
              label="Confirm Password"
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Repeat your password"
              required
            />

            <Button type="submit" disabled={loading} isLoading={loading} loadingText="Creating account…">
              Create Account
            </Button>
          </form>

          <p className="text-center text-sm text-gray-500">
            Already have an account?{' '}
            <a href="/login" className="text-purple-600 hover:underline font-medium">Sign in here</a>
          </p>
        </div>

        {/* Footer */}
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
