'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../lib/firebase';

interface AuthGuardProps {
  children: React.ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [unverified, setUnverified] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        router.push('/login');
        setLoading(false);
        return;
      }

      if (!currentUser.emailVerified) {
        // Signed in but hasn't clicked the verification link yet.
        // Sign them out so they can't linger on the dashboard route,
        // then show a clear message before redirecting.
        auth.signOut().finally(() => {
          setUnverified(true);
          setLoading(false);
        });
        return;
      }

      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (unverified) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-indigo-50 p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center space-y-4">
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-yellow-100 mx-auto">
            <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900">Verify your email first</h2>
          <p className="text-sm text-gray-500">
            You need to click the verification link we emailed you before you can access the dashboard.
            Check your inbox (and your spam folder).
          </p>
          <a
            href="/login"
            className="inline-block mt-2 px-5 py-2.5 rounded-lg text-white text-sm font-medium bg-purple-600 hover:bg-purple-700 transition-colors"
          >
            Back to Sign In
          </a>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return <>{children}</>;
}
