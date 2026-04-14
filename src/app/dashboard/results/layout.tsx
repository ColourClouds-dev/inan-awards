import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Results',
  description: 'View award results and nomination charts.',
};

export default function ResultsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
