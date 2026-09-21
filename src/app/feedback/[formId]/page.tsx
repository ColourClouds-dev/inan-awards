import React from 'react';
import type { Metadata } from 'next';
import FeedbackPageClient from './FeedbackPageClient';

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export function generateStaticParams() {
  return [{ formId: 'placeholder' }];
}

export const metadata: Metadata = {
  title: 'Feedback Form',
  description: 'Share your experience. Your feedback helps us improve.',
};

// params is a Promise in Next.js 15+ — the client component reads formId via useParams()
// so the page shell doesn't consume params at all.
export default function FeedbackPage(_props: { params: Promise<{ formId: string }> }) {
  return <FeedbackPageClient />;
}
