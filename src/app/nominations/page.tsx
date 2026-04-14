import React from 'react';
import type { Metadata } from 'next';
import AwardNominations from '../../components/AwardNominations';

export const metadata: Metadata = {
  title: 'Staff Award Nominations',
  description: 'Nominate your colleagues for the Inan Staff Awards. Cast your votes across all award categories.',
  openGraph: {
    title: 'Staff Award Nominations | Inan Feedback',
    description: 'Nominate your colleagues for the Inan Staff Awards. Cast your votes across all award categories.',
    type: 'website',
    images: [{ url: '/staff-awards.svg', width: 1200, height: 630, alt: 'Inan Staff Awards' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Staff Award Nominations | Inan Feedback',
    description: 'Nominate your colleagues for the Inan Staff Awards.',
    images: ['/staff-awards.svg'],
  },
};

export default function NominationsPage() {
  return <AwardNominations />;
}
