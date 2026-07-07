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
  query,
  where,
} from 'firebase/firestore';
import type { FeedbackForm, FeedbackResponse } from '../types';
import { incrementFormCount } from './tenantFirestore';

const DEFAULT_TENANT = 'inan';

export async function submitFeedback(response: FeedbackResponse & { tenantId?: string }): Promise<string> {
  const docRef = await addDoc(collection(db, 'feedback-responses'), response);
  return docRef.id;
}

export async function getResponseById(responseId: string): Promise<(FeedbackResponse & { tenantId?: string }) | null> {
  const docRef = doc(db, 'feedback-responses', responseId);
  const snapshot = await getDoc(docRef);
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...snapshot.data() } as FeedbackResponse & { tenantId?: string };
}

export async function getAllResponses(
  tenantId: string = DEFAULT_TENANT,
  formIds?: string[],
): Promise<FeedbackResponse[]> {
  let q = query(
    collection(db, 'feedback-responses'),
    where('tenantId', '==', tenantId)
  );
  const snapshot = await getDocs(q);
  let responses = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as FeedbackResponse));

  // If formIds is provided, filter to only responses for those forms (staff scope)
  if (formIds && formIds.length > 0) {
    const formIdSet = new Set(formIds);
    responses = responses.filter(r => formIdSet.has(r.formId));
  }

  return responses.sort((a, b) => {
    const aTime = a.submittedAt instanceof Date ? a.submittedAt.getTime() : (a.submittedAt as any)?.seconds ?? 0;
    const bTime = b.submittedAt instanceof Date ? b.submittedAt.getTime() : (b.submittedAt as any)?.seconds ?? 0;
    return bTime - aTime;
  });
}

export async function getAllForms(
  tenantId: string = DEFAULT_TENANT,
  createdBy?: string,
): Promise<FeedbackForm[]> {
  let q = query(
    collection(db, 'feedback-forms'),
    where('tenantId', '==', tenantId)
  );
  // Staff can only see their own forms
  if (createdBy) {
    q = query(
      collection(db, 'feedback-forms'),
      where('tenantId', '==', tenantId),
      where('createdBy', '==', createdBy)
    );
  }
  const snapshot = await getDocs(q);
  const forms = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as FeedbackForm));
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

export async function saveForm(
  form: FeedbackForm,
  tenantId: string = DEFAULT_TENANT,
  createdBy?: string,
): Promise<void> {
  const docRef = doc(db, 'feedback-forms', form.id);
  const clean = JSON.parse(JSON.stringify({
    ...form,
    tenantId,
    ...(createdBy ? { createdBy } : {}),
  }));
  await setDoc(docRef, clean);
  // Increment the tenant's form count
  try {
    await incrementFormCount(tenantId);
  } catch {
    // Non-fatal — count may be slightly off but form is saved
  }
}

export async function updateForm(form: FeedbackForm, tenantId: string = DEFAULT_TENANT): Promise<void> {
  const docRef = doc(db, 'feedback-forms', form.id);
  const clean = JSON.parse(JSON.stringify({ ...form, tenantId }));
  await updateDoc(docRef, clean);
}

export async function deleteForm(formId: string): Promise<void> {
  const docRef = doc(db, 'feedback-forms', formId);
  await deleteDoc(docRef);
}

/** Check if an IP has already submitted a response for a specific form */
export async function hasIpSubmittedForm(formId: string, ip: string, tenantId: string = DEFAULT_TENANT): Promise<boolean> {
  const q = query(
    collection(db, 'feedback-responses'),
    where('formId', '==', formId),
    where('visitorIp', '==', ip),
    where('tenantId', '==', tenantId)
  );
  const snapshot = await getDocs(q);
  return !snapshot.empty;
}
