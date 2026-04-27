import type { Metadata } from 'next';
import DashboardLayout from '../../components/DashboardLayout';
import AuthGuard from '../../components/AuthGuard';
import RecaptchaProvider from '../../components/RecaptchaProvider';

export const metadata: Metadata = {
  title: 'Super Admin',
};

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <RecaptchaProvider>
        <DashboardLayout>{children}</DashboardLayout>
      </RecaptchaProvider>
    </AuthGuard>
  );
}
