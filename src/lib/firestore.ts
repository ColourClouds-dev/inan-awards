'use client';

import { db } from './firebase';
import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import type { FeedbackForm, FeedbackResponse } from '../types';

export async function submitFeedback(response: FeedbackResponse): Promise<void> {
  await addDoc(collection(db, 'feedback-responses'), response);
}

export async function getAllResponses(): Promise<FeedbackResponse[]> {
  const snapshot = await getDocs(collection(db, 'feedback-responses'));
  const responses = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as FeedbackResponse));
  return responses.sort((a, b) => {
    const aTime = a.submittedAt instanceof Date ? a.submittedAt.getTime() : (a.submittedAt as any)?.seconds ?? 0;
    const bTime = b.submittedAt instanceof Date ? b.submittedAt.getTime() : (b.submittedAt as any)?.seconds ?? 0;
    return bTime - aTime;
  });
}

export async function getAllForms(): Promise<FeedbackForm[]> {
  const snapshot = await getDocs(collection(db, 'feedback-forms'));
  const forms = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as FeedbackForm));
  // Sort client-side to avoid Firestore index requirements
  return forms.sort((a, b) => {
    const aTime = a.createdAt instanceof Date ? a.createdAt.getTime() : (a.createdAt as any)?.seconds ?? 0;
    const bTime = b.createdAt instanceof Date ? b.createdAt.getTime() : (b.createdAt as any)?.seconds ?? 0;
    return bTime - aTime;
  });
}

export async function getFormById(formId: string): Promise<FeedbackForm | null> {
  const docRef = doc(db, 'feedback-forms', formId);
  const snapshot = await getDoc(docRef);
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...snapshot.data() } as FeedbackForm;
}

export async function deactivateForm(formId: string): Promise<void> {
  const docRef = doc(db, 'feedback-forms', formId);
  await updateDoc(docRef, { isActive: false });
}

export async function reactivateForm(formId: string): Promise<void> {
  const docRef = doc(db, 'feedback-forms', formId);
  await updateDoc(docRef, { isActive: true });
}

export async function saveForm(form: FeedbackForm): Promise<void> {
  const docRef = doc(db, 'feedback-forms', form.id);
  await setDoc(docRef, form);
}

export async function deleteForm(formId: string): Promise<void> {
  const docRef = doc(db, 'feedback-forms', formId);
  await deleteDoc(docRef);
}

/** Check if an IP has already submitted a response for a specific form */
export async function hasIpSubmittedForm(formId: string, ip: string): Promise<boolean> {
  const q = query(
    collection(db, 'feedback-responses'),
    where('formId', '==', formId),
    where('visitorIp', '==', ip)
  );
  const snapshot = await getDocs(q);
  return !snapshot.empty;
}
