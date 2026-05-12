'use client';

import { db } from './firebase';
import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  query,
  where,
} from 'firebase/firestore';
import type { Employee } from '../types';

const COL = 'employees';
const DEFAULT_TENANT = 'inan';

export async function getAllEmployees(tenantId: string = DEFAULT_TENANT): Promise<Employee[]> {
  const q = query(collection(db, COL), where('tenantId', '==', tenantId));
  const snap = await getDocs(q);
  const list = snap.docs.map(d => d.data() as Employee);
  return list.sort((a, b) => a.Employee.localeCompare(b.Employee));
}

export async function saveEmployee(employee: Employee, tenantId: string = DEFAULT_TENANT): Promise<void> {
  const id = String(employee['Employee ID']);
  const clean = JSON.parse(JSON.stringify({ ...employee, tenantId }));
  await setDoc(doc(db, COL, id), clean);
}

export async function updateEmployee(employeeId: string, updates: Partial<Employee>): Promise<void> {
  await updateDoc(doc(db, COL, employeeId), updates as Record<string, any>);
}

export async function deleteEmployee(employeeId: string): Promise<void> {
  await deleteDoc(doc(db, COL, employeeId));
}

/** Bulk import employees from a parsed list — used for CSV/Excel import */
export async function bulkSaveEmployees(employees: Employee[], tenantId: string): Promise<void> {
  const BATCH_SIZE = 400;
  for (let i = 0; i < employees.length; i += BATCH_SIZE) {
    const chunk = employees.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);
    chunk.forEach(emp => {
      const id = `${tenantId}_${String(emp['Employee ID'])}`;
      batch.set(doc(db, COL, id), JSON.parse(JSON.stringify({ ...emp, tenantId })));
    });
    await batch.commit();
  }
}

/** Seed Firestore from the static employees.json — only runs for the inan tenant if collection is empty */
export async function seedEmployeesIfEmpty(tenantId: string = DEFAULT_TENANT): Promise<void> {
  // Only seed from the static file for the Inan tenant.
  // Other tenants start with an empty employee list and add their own.
  if (tenantId !== 'inan') return;

  const q = query(collection(db, COL), where('tenantId', '==', tenantId));
  const snap = await getDocs(q);
  if (!snap.empty) return;

  const res = await fetch('/employees.json');
  const list: Employee[] = await res.json();

  const batch = writeBatch(db);
  list.forEach(emp => {
    const id = String(emp['Employee ID']);
    batch.set(doc(db, COL, id), JSON.parse(JSON.stringify({ ...emp, tenantId })));
  });
  await batch.commit();
}
