import React from 'react';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import FeedbackPageClient from './FeedbackPageClient';
import { getAdminDb } from '../../../lib/firebaseAdmin';

export const dynamicParams = true;

export function generateStaticParams() {
  return [{ formId: 'placeholder' }];
}

export async function generateMetadata(
  { params }: { params: { formId: string } }
): Promise<Metadata> {
  const fallbackUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://inan.com.ng';

  try {
    const db = getAdminDb();
    const headersList = headers();
    const tenantId = headersList.get('x-tenant-id') || 'inan';

    // Fetch form and per-tenant SEO settings in parallel
    const [formSnap, seoSnap] = await Promise.all([
      db.doc(`feedback-forms/${params.formId}`).get(),
      db.doc(`tenant-settings/${tenantId}/config/seo`).get(),
    ]);

    const seo = seoSnap.exists ? seoSnap.data() as {
      siteUrl?: string; siteName?: string; defaultDescription?: string; ogImageUrl?: string;
    } : {};

    const siteUrl = seo.siteUrl || fallbackUrl;
    const siteName = seo.siteName || 'Inan Feedback';
    const defaultOgImage = seo.ogImageUrl || '/inan.svg';

    if (!formSnap.exists) return { title: 'Feedback Form' };

    const data = formSnap.data() as {
      title?: string; description?: string; location?: string; ogImageUrl?: string;
    };

    const title = data.title ?? 'Feedback Form';
    const description = data.description
      ?? `Share your experience at ${data.location ?? 'our location'}. Your feedback helps us improve.`;
    const pageUrl = `${siteUrl}/feedback/${params.formId}`;
    const ogImage = data.ogImageUrl || defaultOgImage;

    return {
      title,
      description,
      openGraph: {
        title: `${title} | ${siteName}`,
        description,
        url: pageUrl,
        type: 'website',
        images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
      },
      twitter: {
        card: 'summary_large_image',
        title: `${title} | ${siteName}`,
        description,
        images: [ogImage],
      },
    };
  } catch {
    return { title: 'Feedback Form' };
  }
}

export default function FeedbackPage() {
  return <FeedbackPageClient />;
}
