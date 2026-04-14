'use client';

import DashboardLayout from '../../components/DashboardLayout';
import AuthGuard from '../../components/AuthGuard';
import RecaptchaProvider from '../../components/RecaptchaProvider';

export default function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <RecaptchaProvider>
        <DashboardLayout>{children}</DashboardLayout>
      </RecaptchaProvider>
    </AuthGuard>
  );
}
