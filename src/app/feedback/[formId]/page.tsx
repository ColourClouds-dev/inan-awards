import React from 'react';
import FeedbackPageClient from './FeedbackPageClient';

// Allow any formId at runtime — form data is fetched client-side via useParams().
// generateStaticParams provides the static HTML shell; dynamicParams allows
// any formId beyond the placeholder to be served without a build-time error.
export const dynamicParams = true;

export function generateStaticParams() {
  return [{ formId: 'placeholder' }];
}

export default function FeedbackPage() {
  return <FeedbackPageClient />;
}
