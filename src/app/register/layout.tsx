import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Create Your Account',
  description: 'Sign up for Inan Feedback — the multi-tenant feedback management platform.',
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
