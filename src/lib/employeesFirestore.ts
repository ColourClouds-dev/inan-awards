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
} from 'firebase/firestore';
import type { Employee } from '../types';

const COL = 'employees';

export async function getAllEmployees(): Promise<Employee[]> {
  const snap = await getDocs(collection(db, COL));
  const list = snap.docs.map(d => d.data() as Employee);
  return list.sort((a, b) => a.Employee.localeCompare(b.Employee));
}

export async function saveEmployee(employee: Employee): Promise<void> {
  const id = String(employee['Employee ID']);
  const clean = JSON.parse(JSON.stringify(employee));
  await setDoc(doc(db, COL, id), clean);
}

export async function updateEmployee(employeeId: string, updates: Partial<Employee>): Promise<void> {
  await updateDoc(doc(db, COL, employeeId), updates as Record<string, unknown>);
}

export async function deleteEmployee(employeeId: string): Promise<void> {
  await deleteDoc(doc(db, COL, employeeId));
}

/** Seed Firestore from the static employees.json — only runs if collection is empty */
export async function seedEmployeesIfEmpty(): Promise<void> {
  const snap = await getDocs(collection(db, COL));
  if (!snap.empty) return;

  const res = await fetch('/employees.json');
  const list: Employee[] = await res.json();

  const batch = writeBatch(db);
  list.forEach(emp => {
    const id = String(emp['Employee ID']);
    batch.set(doc(db, COL, id), JSON.parse(JSON.stringify(emp)));
  });
  await batch.commit();
}
