import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Feedback',
  description: 'Create and manage guest feedback forms across all Inan hotel locations.',
};

export default function FeedbackLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
