'use client';

import { db } from './firebase';
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  query,
  where,
  orderBy,
  serverTimestamp,
  QueryConstraint,
} from 'firebase/firestore';
import type { Poll, PollResponse, PollVote } from '../types';
import { getAllEmployees } from './employeesFirestore';

const POLLS_COL = 'polls';
const RESPONSES_COL = 'poll-responses';
const VOTES_COL = 'poll-votes';

export async function getAllPolls(tenantId: string, createdBy?: string): Promise<Poll[]> {
  const constraints: QueryConstraint[] = [where('tenantId', '==', tenantId)];
  if (createdBy) {
    constraints.push(where('createdBy', '==', createdBy));
  }
  constraints.push(orderBy('createdAt', 'desc'));
  
  const q = query(collection(db, POLLS_COL), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt?.toDate ? doc.data().createdAt.toDate() : doc.data().createdAt,
    endDate: doc.data().endDate?.toDate ? doc.data().endDate.toDate() : doc.data().endDate,
  } as Poll));
}

export async function getPollById(pollId: string): Promise<Poll | null> {
  const snap = await getDoc(doc(db, POLLS_COL, pollId));
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    id: snap.id,
    ...data,
    createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt,
    endDate: data.endDate?.toDate ? data.endDate.toDate() : data.endDate,
  } as Poll;
}

export async function createPoll(poll: Omit<Poll, 'id' | 'createdAt'>): Promise<string> {
  // Clean the poll data to remove undefined values
  const cleanPoll = Object.fromEntries(
    Object.entries(poll).filter(([_, value]) => value !== undefined)
  );
  
  const docRef = await addDoc(collection(db, POLLS_COL), {
    ...cleanPoll,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function updatePoll(pollId: string, updates: Partial<Poll>): Promise<void> {
  await updateDoc(doc(db, POLLS_COL, pollId), updates as Record<string, any>);
}

export async function deletePoll(pollId: string): Promise<void> {
  await deleteDoc(doc(db, POLLS_COL, pollId));
}

export async function validateEmployeeNominees(
  employeeIds: string[],
  tenantId: string
): Promise<boolean> {
  const employees = await getAllEmployees(tenantId);
  const validIds = employees.map(emp => String(emp['Employee ID']));
  return employeeIds.every(id => validIds.includes(id));
}

export async function submitPollResponse(
  response: Omit<PollResponse, 'id' | 'submittedAt'>,
  votes: Omit<PollVote, 'id' | 'submittedAt'>[]
): Promise<void> {
  const batch = writeBatch(db);
  
  // Clean response data to remove undefined values
  const cleanResponse = Object.fromEntries(
    Object.entries(response).filter(([_, value]) => value !== undefined)
  );
  
  // Create PollResponse doc with auto ID
  const responseRef = doc(collection(db, RESPONSES_COL));
  batch.set(responseRef, {
    ...cleanResponse,
    submittedAt: serverTimestamp(),
  });
  
  // Create PollVote docs with auto IDs, also cleaning undefined values
  votes.forEach(vote => {
    const cleanVote = Object.fromEntries(
      Object.entries(vote).filter(([_, value]) => value !== undefined)
    );
    const voteRef = doc(collection(db, VOTES_COL));
    batch.set(voteRef, {
      ...cleanVote,
      submittedAt: serverTimestamp(),
    });
  });
  
  await batch.commit();
}
