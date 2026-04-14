import React from 'react';
import type { Metadata } from 'next';
import FeedbackPageClient from './FeedbackPageClient';
import { getAdminDb } from '../../../lib/firebaseAdmin';

export const dynamicParams = true;

export function generateStaticParams() {
  return [{ formId: 'placeholder' }];
}

export async function generateMetadata(
  { params }: { params: { formId: string } }
): Promise<Metadata> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://inan.com.ng';

  try {
    const snap = await getAdminDb().doc(`feedback-forms/${params.formId}`).get();
    if (!snap.exists) return { title: 'Feedback Form' };

    const data = snap.data() as { title?: string; description?: string; location?: string };
    const title = data.title ?? 'Feedback Form';
    const description = data.description
      ?? `Share your experience at ${data.location ?? 'our location'}. Your feedback helps us improve.`;
    const pageUrl = `${siteUrl}/feedback/${params.formId}`;

    return {
      title,
      description,
      openGraph: {
        title: `${title} | Inan Feedback`,
        description,
        url: pageUrl,
        type: 'website',
        images: [{ url: '/inan.svg', width: 1200, height: 630, alt: title }],
      },
      twitter: {
        card: 'summary_large_image',
        title: `${title} | Inan Feedback`,
        description,
        images: ['/inan.svg'],
      },
    };
  } catch {
    return { title: 'Feedback Form' };
  }
}

export default function FeedbackPage() {
  return <FeedbackPageClient />;
}
