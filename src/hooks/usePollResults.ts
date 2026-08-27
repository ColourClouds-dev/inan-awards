'use client';

import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { PollVote } from '../types';

export function usePollResults(pollId: string, tenantId?: string) {
  const [results, setResults] = useState<PollVote[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!pollId) return;

    const q = tenantId
      ? query(collection(db, 'poll-votes'), where('pollId', '==', pollId), where('tenantId', '==', tenantId))
      : query(collection(db, 'poll-votes'), where('pollId', '==', pollId));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const votes = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          submittedAt: doc.data().submittedAt?.toDate ? doc.data().submittedAt.toDate() : doc.data().submittedAt,
        } as PollVote));
        setResults(votes);
        setLoading(false);
      },
      (error) => {
        console.error('Error listening to poll votes snapshots:', error);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [pollId]);

  return { results, loading };
}
