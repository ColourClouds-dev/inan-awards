import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Nominations',
  description: 'View and manage staff award nomination results.',
};

export default function PollsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
