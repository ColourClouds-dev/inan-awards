#!/usr/bin/env node
/**
 * Seeds tenant-admins documents for existing Firebase Auth users.
 * Maps all existing users to tenantId: "inan" if they don't already
 * have a tenant-admins document.
 *
 * Usage: node scripts/seed-tenant-admins.js
 *
 * Requires FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL,
 * and FIREBASE_ADMIN_PRIVATE_KEY in .env.local
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

try {
  const { config } = require('dotenv');
  config({ path: '.env.local' });
} catch { /* dotenv not installed — env vars must be set externally */ }

const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const adminAuth = getAuth();
const db = getFirestore();
const TENANT_ID = 'inan';

async function main() {
  console.log('=== Seeding tenant-admins for existing users ===\n');

  // List all users (handles pagination)
  let nextPageToken;
  let totalProcessed = 0;
  let totalCreated = 0;

  do {
    const listResult = await adminAuth.listUsers(1000, nextPageToken);

    for (const user of listResult.users) {
      totalProcessed++;
      const ref = db.doc(`tenant-admins/${user.uid}`);
      const snap = await ref.get();

      if (snap.exists) {
        console.log(`  [SKIP] ${user.email} — already mapped to "${snap.data().tenantId}"`);
        continue;
      }

      await ref.set({
        tenantId: TENANT_ID,
        email: user.email ?? '',
        createdAt: new Date(),
      });
      totalCreated++;
      console.log(`  [OK]   ${user.email} → tenantId: "${TENANT_ID}"`);
    }

    nextPageToken = listResult.pageToken;
  } while (nextPageToken);

  console.log(`\n=== Done! Processed ${totalProcessed} users, created ${totalCreated} mappings ===`);
}

main().catch(err => {
  console.error('Script failed:', err);
  process.exit(1);
});
