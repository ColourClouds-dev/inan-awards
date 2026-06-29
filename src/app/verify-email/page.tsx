'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { sendEmailVerification, signInWithEmailAndPassword, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import Button from '../../components/Button';
import Toast from '../../components/Toast';
import { useToast } from '../../hooks/useToast';

const SESSION_KEY_EMAIL = 'verify_email';
const SESSION_KEY_PASSWORD = 'verify_password';

function VerifyEmailInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailFromUrl = searchParams?.get('email') ?? '';
  const tokenFromUrl = searchParams?.get('token') ?? '';
  const uidFromUrl = searchParams?.get('uid') ?? '';

  const { toasts, showToast, dismissToast } = useToast();
  const [resendCooldown, setResendCooldown] = useState(60);
  const [resending, setResending] = useState(false);
  const [verifying, setVerifying] = useState(false);

  // Cooldown countdown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  // Handle custom verification token from URL automatically on load
  useEffect(() => {
    if (!tokenFromUrl || !uidFromUrl) return;

    const verifyToken = async () => {
      setVerifying(true);
      try {
        const res = await fetch('/api/auth/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: tokenFromUrl, uid: uidFromUrl }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          sessionStorage.removeItem(SESSION_KEY_EMAIL);
          sessionStorage.removeItem('verify_uid');
          showToast('Email verified successfully! Redirecting to sign in...', 'success');
          setTimeout(() => router.push('/login'), 2000);
        } else {
          showToast(data.error || 'Verification failed. The link may have expired.', 'error');
        }
      } catch (err) {
        showToast('An error occurred during verification. Please try again.', 'error');
      } finally {
        setVerifying(false);
      }
    };

    verifyToken();
  }, [tokenFromUrl, uidFromUrl, router, showToast]);

  // Firebase auth state change listener (only for standard providers using Firebase Auth)
  useEffect(() => {
    const hasPassword = !!sessionStorage.getItem(SESSION_KEY_PASSWORD);
    if (!hasPassword) return;

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
        await auth.signOut();
      }
    });
    return () => unsubscribe();
  }, [router, showToast]);

  // Unified Polling logic: checks verify_uid (custom domain via API) or verify_password (standard domain via Firebase)
  useEffect(() => {
    const interval = setInterval(async () => {
      const storedUid = sessionStorage.getItem('verify_uid') || uidFromUrl;
      const storedEmail = sessionStorage.getItem(SESSION_KEY_EMAIL) || emailFromUrl;
      const storedPassword = sessionStorage.getItem(SESSION_KEY_PASSWORD);

      if (storedUid) {
        // Custom domain (Brevo) flow: poll backend status check API
        try {
          const res = await fetch(`/api/auth/verify?uid=${encodeURIComponent(storedUid)}`);
          if (res.ok) {
            const data = await res.json();
            if (data.emailVerified) {
              sessionStorage.removeItem(SESSION_KEY_EMAIL);
              sessionStorage.removeItem('verify_uid');
              showToast('Email verified! You can now sign in.', 'success');
              setTimeout(() => router.push('/login'), 1500);
            }
          }
        } catch {
          // Stop polling silently on error
        }
      } else if (storedEmail && storedPassword) {
        // Standard provider (Firebase) flow: sign in and reload user state
        if (auth.currentUser) return;
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
          // Stop polling silently on error
        }
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [uidFromUrl, emailFromUrl, router, showToast]);

  const handleResend = async () => {
    if (resendCooldown > 0 || resending) return;
    setResending(true);

    const storedEmail = sessionStorage.getItem(SESSION_KEY_EMAIL) || emailFromUrl;
    const storedUid = sessionStorage.getItem('verify_uid') || uidFromUrl;
    const storedPassword = sessionStorage.getItem(SESSION_KEY_PASSWORD);

    if (!storedEmail) {
      showToast('Session expired. Please register your account again.', 'error');
      setResending(false);
      return;
    }

    if (storedUid) {
      // Custom Domain (Brevo) resend flow
      try {
        const res = await fetch('/api/auth/send-verification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid: storedUid, email: storedEmail }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          showToast('Verification email resent via Brevo.', 'success');
          setResendCooldown(60);
        } else {
          showToast(data.error || 'Failed to resend. Please try again.', 'error');
        }
      } catch {
        showToast('Failed to resend. Please try again.', 'error');
      } finally {
        setResending(false);
      }
    } else if (storedPassword) {
      // Standard Provider (Firebase native) resend flow
      try {
        const cred = await signInWithEmailAndPassword(auth, storedEmail, storedPassword);
        await sendEmailVerification(cred.user);
        await auth.signOut();
        showToast('Verification email resent.', 'success');
        setResendCooldown(60);
      } catch {
        showToast('Failed to resend. Please try again.', 'error');
      } finally {
        setResending(false);
      }
    } else {
      showToast('Session expired. Please register your account again.', 'error');
      setResending(false);
    }
  };

  if (verifying) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-purple-50 via-white to-purple-100">
        <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-8 text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto" />
          <h1 className="text-xl font-bold text-gray-900">Verifying your email</h1>
          <p className="text-gray-500 text-sm">Please wait while we validate your token.</p>
        </div>
      </div>
    );
  }

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
