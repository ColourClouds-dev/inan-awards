import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Admin Login',
  description: 'Sign in to the Inan Feedback Management dashboard.',
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
