'use client';

import React, { useState, useEffect } from 'react';
import { signInWithEmailAndPassword, onAuthStateChanged, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Button from '../../components/Button';
import Input from '../../components/Input';
import Toast from '../../components/Toast';
import { useToast } from '../../hooks/useToast';
import CreateAccountModal from '../../components/CreateAccountModal';

function getErrorMessage(error: { code?: string } | null | undefined): string {
  switch (error?.code) {
    case 'auth/invalid-email':
      return 'Invalid email address format.';
    case 'auth/user-disabled':
      return 'This account has been disabled.';
    case 'auth/user-not-found':
      return 'No account found with this email.';
    case 'auth/wrong-password':
      return 'Incorrect password.';
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Please try again later.';
    default:
      return 'Failed to sign in. Please check your credentials.';
  }
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [showCreateAccount, setShowCreateAccount] = useState(false);

  // Forgot password state
  const [mode, setMode] = useState<'login' | 'forgot'>('login');
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  const { toasts, showToast, dismissToast } = useToast();
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        router.push('/dashboard');
      } else {
        setIsCheckingAuth(false);
      }
    });
    return () => unsubscribe();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      showToast('Signed in successfully!', 'success');
      setTimeout(() => router.push('/dashboard'), 1000);
    } catch (err: any) {
      const msg = getErrorMessage(err);
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) {
      showToast('Please enter your email address.', 'error');
      return;
    }
    setResetLoading(true);
    try {
      await sendPasswordResetEmail(auth, resetEmail.trim());
      showToast('Password reset email sent! Check your inbox.', 'success');
      // Switch back to login after a short delay so the user sees the toast
      setTimeout(() => {
        setMode('login');
        setResetEmail('');
      }, 2500);
    } catch (err: any) {
      if (err?.code === 'auth/user-not-found') {
        showToast('No account found with that email address.', 'error');
      } else if (err?.code === 'auth/invalid-email') {
        showToast('Please enter a valid email address.', 'error');
      } else {
        showToast('Failed to send reset email. Please try again.', 'error');
      }
    } finally {
      setResetLoading(false);
    }
  };

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-indigo-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <Toast toasts={toasts} onDismiss={dismissToast} />
      <CreateAccountModal
        isOpen={showCreateAccount}
        onClose={() => setShowCreateAccount(false)}
      />

      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <Link href="/" className="inline-flex items-center text-sm text-purple-600 hover:text-purple-800 mb-4">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Home
          </Link>
          <h1 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            INAN Admin Feedback System
          </h1>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-lg sm:rounded-xl sm:px-10">

          {/* ── Login form ─────────────────────────────────────────────── */}
          {mode === 'login' && (
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  label="Email address"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  label="Password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <div className="flex justify-end mt-1">
                  <button
                    type="button"
                    onClick={() => { setMode('forgot'); setResetEmail(email); setError(''); }}
                    className="text-sm text-purple-600 hover:text-purple-800 font-medium transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>
              </div>

              {error && (
                <div className="rounded-md bg-red-50 p-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-red-800">{error}</h3>
                    </div>
                  </div>
                </div>
              )}

              <Button type="submit" disabled={loading} isLoading={loading} loadingText="Signing in…">
                Sign in
              </Button>
            </form>
          )}

          {/* ── Forgot password form ───────────────────────────────────── */}
          {mode === 'forgot' && (
            <form className="space-y-6" onSubmit={handlePasswordReset}>
              <div className="text-center space-y-1">
                <h2 className="text-xl font-semibold text-gray-900">Reset your password</h2>
                <p className="text-sm text-gray-500">
                  Enter your email and we&apos;ll send you a link to reset your password.
                </p>
              </div>

              <Input
                id="reset-email"
                name="reset-email"
                type="email"
                label="Email address"
                autoComplete="email"
                required
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                placeholder="Enter your account email"
              />

              <Button
                type="submit"
                disabled={resetLoading}
                isLoading={resetLoading}
                loadingText="Sending…"
              >
                Send Reset Link
              </Button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => { setMode('login'); setResetEmail(''); }}
                  className="inline-flex items-center text-sm text-purple-600 hover:text-purple-800 font-medium transition-colors"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Back to Sign in
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {mode === 'login' && (
        <div className="mt-4 sm:mx-auto sm:w-full sm:max-w-md text-center">
          <p className="text-sm text-gray-600">
            Don&apos;t have an account?{' '}
            <button
              onClick={() => setShowCreateAccount(true)}
              className="font-medium text-purple-600 hover:text-purple-800 transition-colors"
            >
              Create one
            </button>
          </p>
        </div>
      )}
    </div>
  );
}
