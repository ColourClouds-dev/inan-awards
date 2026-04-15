'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

// Builder is now on the main polls page
export default function PollsNewRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/dashboard/polls'); }, [router]);
  return null;
}
