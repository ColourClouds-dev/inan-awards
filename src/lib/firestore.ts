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
  writeBatch,
  query,
  where,
} from 'firebase/firestore';
import type { FeedbackForm, FeedbackResponse } from '../types';
import { incrementFormCount } from './tenantFirestore';

const DEFAULT_TENANT = 'inan';

function getTimestampMillis(value: unknown): number {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string') return new Date(value).getTime();
  if (value && typeof (value as any).toDate === 'function') return (value as any).toDate().getTime();
  if (value && typeof (value as any).seconds === 'number') return (value as any).seconds * 1000;
  return 0;
}

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

  return responses.sort((a, b) => getTimestampMillis(b.submittedAt) - getTimestampMillis(a.submittedAt));
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
  return forms.sort((a, b) => getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt));
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
  // 1. Delete all responses for this form first
  const responsesQuery = query(
    collection(db, 'feedback-responses'),
    where('formId', '==', formId)
  );
  const responsesSnap = await getDocs(responsesQuery);

  // Client SDK writeBatch is limited to 500 ops — chunk if needed
  const CHUNK = 499;
  const responseDocs = responsesSnap.docs;
  for (let i = 0; i < responseDocs.length; i += CHUNK) {
    const batch = writeBatch(db);
    responseDocs.slice(i, i + CHUNK).forEach(d => batch.delete(d.ref));
    await batch.commit();
  }

  // 2. Delete the form document itself
  await deleteDoc(doc(db, 'feedback-forms', formId));
}

/**
 * Check whether a slug is already used by another form in the same tenant.
 * @param slug      The candidate slug to check.
 * @param tenantId  Tenant scope for the query.
 * @param excludeId Optional form ID to exclude (used when editing an existing form).
 */
export async function isSlugTaken(
  slug: string,
  tenantId: string,
  excludeId?: string,
): Promise<boolean> {
  const q = query(
    collection(db, 'feedback-forms'),
    where('tenantId', '==', tenantId),
    where('slug', '==', slug),
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return false;

  // A slug is only "taken" if there is an active form using it.
  // Inactive (deactivated) forms and ghost docs left by a failed delete
  // should not block slug reuse.
  const activeDocs = snapshot.docs.filter(d => {
    const data = d.data();
    // Exclude the form being edited
    if (excludeId && d.id === excludeId) return false;
    // Only count docs that are still active
    return data.isActive === true;
  });

  return activeDocs.length > 0;
}

/**
 * Resolve a form by its slug within a tenant.
 * Returns the form or null if not found.
 */
export async function getFormBySlug(
  slug: string,
  tenantId: string,
): Promise<FeedbackForm | null> {
  const q = query(
    collection(db, 'feedback-forms'),
    where('tenantId', '==', tenantId),
    where('slug', '==', slug),
    where('isActive', '==', true),
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const d = snapshot.docs[0];
  return { id: d.id, ...d.data() } as FeedbackForm;
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
  if (snapshot.empty) return false;

  const now = Date.now();
  const twentyFourHours = 24 * 60 * 60 * 1000;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (!data.submittedAt) continue;

    let submittedDate: Date;
    if (data.submittedAt.toDate && typeof data.submittedAt.toDate === 'function') {
      submittedDate = data.submittedAt.toDate();
    } else if (data.submittedAt instanceof Date) {
      submittedDate = data.submittedAt;
    } else if (data.submittedAt.seconds) {
      submittedDate = new Date(data.submittedAt.seconds * 1000);
    } else {
      submittedDate = new Date(data.submittedAt);
    }

    if (now - submittedDate.getTime() < twentyFourHours) {
      return true;
    }
  }

  return false;
}
