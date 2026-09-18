import type { Metadata } from 'next';
import { Suspense } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import AuthGuard from '../../components/AuthGuard';
import RecaptchaProvider from '../../components/RecaptchaProvider';

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export const metadata: Metadata = {
  title: 'Super Admin',
};

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense>
      <AuthGuard>
        <RecaptchaProvider>
          <DashboardLayout>{children}</DashboardLayout>
        </RecaptchaProvider>
      </AuthGuard>
    </Suspense>
  );
}
