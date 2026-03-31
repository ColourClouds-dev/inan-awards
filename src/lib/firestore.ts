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
  orderBy,
  query,
} from 'firebase/firestore';
import type { FeedbackForm, FeedbackResponse } from '../types';

export async function submitFeedback(response: FeedbackResponse): Promise<void> {
  await addDoc(collection(db, 'feedback-responses'), response);
}

export async function getAllResponses(): Promise<FeedbackResponse[]> {
  const q = query(collection(db, 'feedback-responses'), orderBy('submittedAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as FeedbackResponse));
}

export async function getAllForms(): Promise<FeedbackForm[]> {
  const q = query(collection(db, 'feedback-forms'), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as FeedbackForm));
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

export async function saveForm(form: FeedbackForm): Promise<void> {
  const docRef = doc(db, 'feedback-forms', form.id);
  await setDoc(docRef, form);
}
