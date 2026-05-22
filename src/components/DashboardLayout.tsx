'use client';

import React, { ReactNode, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { useTenant } from '../contexts/TenantContext';
import Sidebar from './Sidebar';
import DashboardHeader from './DashboardHeader';

// ── Nav icons ─────────────────────────────────────────────────────────────────

const IconOverview = (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  </svg>
);

const IconFeedback = (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
  </svg>
);

const IconSettings = (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const IconSuperAdmin = (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
);

// ─────────────────────────────────────────────────────────────────────────────

interface DashboardLayoutProps {
  children: ReactNode;
}

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [role, setRole] = useState('Admin');
  const { tenant, isImpersonating } = useTenant();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setDisplayName(user.displayName || user.email || '');
        setPhotoUrl(user.photoURL || '');
        user.getIdTokenResult().then((result) => {
          const isSuper = result.claims.superAdmin === true;
          setIsSuperAdmin(isSuper);
          setRole(isSuper ? 'Super Admin' : 'Admin');
        });

        // Fire welcome email once — the API guards against duplicates server-side
        if (user.emailVerified) {
          fetch('/api/welcome-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              uid: user.uid,
              email: user.email,
              companyName: user.displayName || '',
            }),
          }).catch(() => { /* non-fatal */ });
        }
      }
    });
    return () => unsubscribe();
  }, []);

  const allNavItems = [
    { href: '/dashboard',          label: 'Overview',    icon: IconOverview,    show: true },
    {
      href: '/dashboard/feedback',
      label: 'Feedback',
      icon: IconFeedback,
      show: true,
      children: [
        { href: '/dashboard/feedback/forms',     label: 'Forms' },
        { href: '/dashboard/feedback/responses', label: 'Responses' },
        { href: '/dashboard/feedback/analytics', label: 'Analytics' },
      ],
    },
    { href: '/dashboard/settings', label: 'Settings',    icon: IconSettings,    show: true },
    { href: '/super-admin',        label: 'Super Admin', icon: IconSuperAdmin,  show: isSuperAdmin && !isImpersonating },
  ];

  const handleSignOut = async () => {
    setIsSigningOut(true);
    setSignOutError(null);
    try {
      await signOut(auth);
      router.push('/login');
    } catch (error) {
      console.error('Error signing out:', error);
      setSignOutError('Failed to sign out. Please try again.');
    } finally {
      setIsSigningOut(false);
    }
  };

  const handleExitImpersonation = async () => {
    try {
      await fetch('/api/impersonate', { method: 'DELETE' });
      window.location.href = '/super-admin';
    } catch {
      // ignore
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* ── Impersonation banner ───────────────────────────────────────── */}
      {isImpersonating && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-400 text-yellow-900 px-4 py-2 flex items-center justify-between text-sm font-medium">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            Viewing as <strong className="ml-1">{tenant?.name ?? 'Unknown Tenant'}</strong>
          </div>
          <button
            onClick={handleExitImpersonation}
            className="flex items-center gap-1.5 px-3 py-1 bg-yellow-900 text-yellow-100 rounded-md hover:bg-yellow-800 transition-colors text-xs font-semibold"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Exit
          </button>
        </div>
      )}

      {/* ── Main flex row: sidebar + content ──────────────────────────── */}
      <div className={`flex min-h-screen ${isImpersonating ? 'pt-10' : ''}`}>
        {/* Sidebar */}
        <Sidebar
          isOpen={isMobileOpen}
          onClose={() => setIsMobileOpen(false)}
          navigationItems={allNavItems}
          displayName={displayName}
          role={role}
          photoUrl={photoUrl}
          isSigningOut={isSigningOut}
          onSignOut={handleSignOut}
          logoUrl={tenant?.branding?.logoUrl}
          tenantName={tenant?.name}
        />

        {/* ── Content area ──────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0 md:ml-60">
          {/* Persistent header — desktop + mobile */}
          <DashboardHeader
            displayName={displayName}
            role={role}
            photoUrl={photoUrl}
            tenantName={tenant?.name}
            isSigningOut={isSigningOut}
            onSignOut={handleSignOut}
            onMobileMenuOpen={() => setIsMobileOpen(true)}
          />

          {/* Sign-out error */}
          {signOutError && (
            <div className="mx-4 mt-4">
              <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded">
                <div className="flex">
                  <svg className="h-5 w-5 text-red-400 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <p className="ml-3 text-sm text-red-700">{signOutError}</p>
                </div>
              </div>
            </div>
          )}

          {/* Page content */}
          <main className="flex-1 py-6 px-4 sm:px-6 lg:px-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
};

export default DashboardLayout;
