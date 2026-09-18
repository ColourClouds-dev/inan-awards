import type { Metadata } from 'next';
import PublicPollClient from './PublicPollClient';

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export const metadata: Metadata = { title: 'Poll' };

export default function PublicPollPage() {
  return <PublicPollClient />;
}
