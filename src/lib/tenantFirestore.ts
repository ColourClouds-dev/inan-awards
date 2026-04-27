'use client';

import { db } from './firebase';
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  query,
  where,
  increment,
} from 'firebase/firestore';
import type { Tenant } from '../types';

const COL = 'tenants';

export async function getTenantByDomain(domain: string): Promise<Tenant | null> {
  const q = query(collection(db, COL), where('domain', '==', domain));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() } as Tenant;
}

export async function getTenantById(tenantId: string): Promise<Tenant | null> {
  const snap = await getDoc(doc(db, COL, tenantId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Tenant;
}

export async function getAllTenants(): Promise<Tenant[]> {
  const snap = await getDocs(collection(db, COL));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Tenant));
}

export async function saveTenant(tenant: Tenant): Promise<void> {
  const clean = JSON.parse(JSON.stringify(tenant));
  await setDoc(doc(db, COL, tenant.id), clean);
}

export async function updateTenant(tenantId: string, updates: Partial<Tenant>): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await updateDoc(doc(db, COL, tenantId), updates as Record<string, any>);
}

export async function incrementFormCount(tenantId: string): Promise<void> {
  await updateDoc(doc(db, COL, tenantId), { formCount: increment(1) });
}

export async function incrementNominationFormCount(tenantId: string): Promise<void> {
  await updateDoc(doc(db, COL, tenantId), { nominationFormCount: increment(1) });
}
