'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { sendEmailVerification, signInWithEmailAndPassword, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { useRouter, useSearchParams } from 'next/navigation';
import Button from '../../components/Button';
import Toast from '../../components/Toast';
import { useToast } from '../../hooks/useToast';

const SESSION_KEY_EMAIL = 'verify_email';
const SESSION_KEY_PASSWORD = 'verify_password';

function VerifyEmailInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailFromUrl = searchParams?.get('email') ?? '';

  const { toasts, showToast, dismissToast } = useToast();
  const [resendCooldown, setResendCooldown] = useState(60);
  const [resending, setResending] = useState(false);

  // Cooldown countdown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  // If the user clicks the verification link and comes back to this tab,
  // onAuthStateChanged fires. Force-reload to get the latest emailVerified flag.
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) return;
      await user.reload();
      if (user.emailVerified) {
        sessionStorage.removeItem(SESSION_KEY_EMAIL);
        sessionStorage.removeItem(SESSION_KEY_PASSWORD);
        await auth.signOut();
        showToast('Email verified! You can now sign in.', 'success');
        setTimeout(() => router.push('/login'), 1500);
      } else {
        // Signed in but not yet verified — sign out so they stay on this page
        await auth.signOut();
      }
    });
    return () => unsubscribe();
  }, [router, showToast]);

  // Poll every 5 seconds in case the user verified in another tab/window
  useEffect(() => {
    const interval = setInterval(async () => {
      if (auth.currentUser) return; // onAuthStateChanged will handle it
      const storedEmail = sessionStorage.getItem(SESSION_KEY_EMAIL);
      const storedPassword = sessionStorage.getItem(SESSION_KEY_PASSWORD);
      if (!storedEmail || !storedPassword) return;
      try {
        const cred = await signInWithEmailAndPassword(auth, storedEmail, storedPassword);
        await cred.user.reload();
        if (cred.user.emailVerified) {
          sessionStorage.removeItem(SESSION_KEY_EMAIL);
          sessionStorage.removeItem(SESSION_KEY_PASSWORD);
          await auth.signOut();
          showToast('Email verified! You can now sign in.', 'success');
          setTimeout(() => router.push('/login'), 1500);
        } else {
          await auth.signOut();
        }
      } catch {
        // Credentials expired or wrong — stop polling silently
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [router, showToast]);

  const handleResend = async () => {
    if (resendCooldown > 0 || resending) return;
    setResending(true);

    const storedEmail = sessionStorage.getItem(SESSION_KEY_EMAIL);
    const storedPassword = sessionStorage.getItem(SESSION_KEY_PASSWORD);

    if (!storedEmail || !storedPassword) {
      showToast('Session expired. Please create your account again.', 'error');
      setResending(false);
      return;
    }

    try {
      // Sign in temporarily just to resend, then sign out immediately
      const cred = await signInWithEmailAndPassword(auth, storedEmail, storedPassword);
      await sendEmailVerification(cred.user);
      await auth.signOut();

      // Clear credentials after use
      sessionStorage.removeItem(SESSION_KEY_EMAIL);
      sessionStorage.removeItem(SESSION_KEY_PASSWORD);

      showToast('Verification email resent.', 'success');
      setResendCooldown(60);
    } catch {
      showToast('Failed to resend. Please try again or create your account again.', 'error');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-purple-50 via-white to-purple-100">
      <Toast toasts={toasts} onDismiss={dismissToast} />
      <div className="w-full max-w-md space-y-6">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center"
              style={{ backgroundColor: 'color-mix(in srgb, var(--brand, #7C3AED) 12%, white)' }}
            >
              <svg
                className="w-10 h-10"
                style={{ color: 'var(--brand, #7C3AED)' }}
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
          <style>{`@keyframes envelopeDraw { to { stroke-dashoffset: 0; } }`}</style>

          <h1 className="text-xl font-bold text-gray-900 mb-2">Check your email</h1>
          <p className="text-gray-500 text-sm">We sent a verification link to</p>
          {emailFromUrl && (
            <p className="font-semibold text-gray-800 text-sm mt-1">{emailFromUrl}</p>
          )}
          <p className="text-gray-500 text-sm max-w-xs mx-auto mt-3">
            Click the link in the email to verify your account.
            This page will automatically redirect to sign in once verified.
          </p>
        </div>

        {/* ── Actions card ────────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl shadow-lg p-6 space-y-4">
          <div className="text-center space-y-1">
            <p className="text-sm text-gray-500">Didn&apos;t receive it?</p>
            <p className="text-xs text-gray-400">Check your spam folder, or click below to resend.</p>
          </div>

          <div className="flex justify-center">
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
              style={{ color: 'var(--brand, #7C3AED)' }}
            >
              ← Back to Sign In
            </a>
          </div>
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

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-white to-purple-100">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
      </div>
    }>
      <VerifyEmailInner />
    </Suspense>
  );
}
