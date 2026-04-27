'use client';

import { db } from './firebase';
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  Timestamp,
} from 'firebase/firestore';
import type { NominationsForm, NominationsVote } from '../types';
import { incrementNominationFormCount } from './tenantFirestore';

const FORMS_COL = 'nominations-forms';
const VOTES_COL = 'nominations-votes';
const DEFAULT_TENANT = 'inan';

function toTimestamp(v: unknown): Timestamp {
  if (v instanceof Timestamp) return v;
  if (v instanceof Date) return Timestamp.fromDate(v);
  if (v && typeof (v as any).toDate === 'function') return v as Timestamp;
  if (typeof v === 'string') return Timestamp.fromDate(new Date(v));
  if (v && typeof (v as any).seconds === 'number') return new Timestamp((v as any).seconds, (v as any).nanoseconds ?? 0);
  return Timestamp.now();
}

// ── Forms ──────────────────────────────────────────────────────────────────────

export async function saveNominationsForm(form: NominationsForm, tenantId: string = DEFAULT_TENANT): Promise<void> {
  const payload = {
    ...form,
    tenantId,
    openAt: toTimestamp(form.openAt),
    closeAt: toTimestamp(form.closeAt),
    createdAt: toTimestamp(form.createdAt),
  };
  await setDoc(doc(db, FORMS_COL, form.id), payload);
  // Increment the tenant's nomination form count
  try {
    await incrementNominationFormCount(tenantId);
  } catch {
    // Non-fatal
  }
}

export async function getAllNominationsForms(tenantId: string = DEFAULT_TENANT): Promise<NominationsForm[]> {
  const q = query(collection(db, FORMS_COL), where('tenantId', '==', tenantId));
  const snap = await getDocs(q);
  const forms = snap.docs.map(d => ({ id: d.id, ...d.data() } as NominationsForm));
  return forms.sort((a, b) => {
    const aT = a.createdAt instanceof Date ? a.createdAt.getTime() : (a.createdAt as any)?.seconds ?? 0;
    const bT = b.createdAt instanceof Date ? b.createdAt.getTime() : (b.createdAt as any)?.seconds ?? 0;
    return bT - aT;
  });
}

export async function getNominationsFormById(formId: string): Promise<NominationsForm | null> {
  const snap = await getDoc(doc(db, FORMS_COL, formId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as NominationsForm;
}

export async function deleteNominationsForm(formId: string): Promise<void> {
  await deleteDoc(doc(db, FORMS_COL, formId));
}

export async function toggleNominationsFormActive(formId: string, isActive: boolean): Promise<void> {
  await updateDoc(doc(db, FORMS_COL, formId), { isActive });
}

// ── Votes ──────────────────────────────────────────────────────────────────────

export async function submitNominationsVote(vote: NominationsVote, tenantId: string = DEFAULT_TENANT): Promise<void> {
  const clean = JSON.parse(JSON.stringify({ ...vote, tenantId }));
  await setDoc(doc(db, VOTES_COL, vote.id), clean);
}

export async function getVotesForForm(formId: string): Promise<NominationsVote[]> {
  const q = query(collection(db, VOTES_COL), where('formId', '==', formId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as NominationsVote));
}

export async function hasEmailVoted(formId: string, email: string): Promise<boolean> {
  const q = query(
    collection(db, VOTES_COL),
    where('formId', '==', formId),
    where('email', '==', email.toLowerCase())
  );
  const snap = await getDocs(q);
  return !snap.empty;
}

export async function hasAnonymousVoted(formId: string, voteId: string): Promise<boolean> {
  const snap = await getDoc(doc(db, VOTES_COL, voteId));
  return snap.exists();
}
