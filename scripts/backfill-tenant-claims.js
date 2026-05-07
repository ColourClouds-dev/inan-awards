#!/usr/bin/env node
/**
 * Backfill tenantId custom claims for all existing users.
 * Reads tenant-admins/{uid} documents and sets the tenantId claim
 * on each corresponding Firebase Auth user.
 *
 * Usage: node scripts/backfill-tenant-claims.js
 *
 * Requires FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL,
 * and FIREBASE_ADMIN_PRIVATE_KEY in .env.local
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

try {
  const { config } = require('dotenv');
  config({ path: '.env.local' });
} catch { /* dotenv not installed */ }

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

async function main() {
  console.log('=== Backfilling tenantId custom claims ===\n');

  const snap = await db.collection('tenant-admins').get();

  if (snap.empty) {
    console.log('No tenant-admins documents found. Nothing to backfill.');
    return;
  }

  let success = 0;
  let skipped = 0;
  let failed = 0;

  for (const doc of snap.docs) {
    const uid = doc.id;
    const { tenantId, email } = doc.data();

    if (!tenantId) {
      console.log(`  [SKIP] ${uid} — no tenantId in document`);
      skipped++;
      continue;
    }

    try {
      // Check existing claims first
      const user = await adminAuth.getUser(uid);
      const existing = user.customClaims ?? {};

      if (existing.tenantId === tenantId) {
        console.log(`  [SKIP] ${email ?? uid} — already has tenantId: "${tenantId}"`);
        skipped++;
        continue;
      }

      // Preserve existing claims (e.g. superAdmin) and add tenantId
      await adminAuth.setCustomUserClaims(uid, { ...existing, tenantId });
      console.log(`  [OK]   ${email ?? uid} → tenantId: "${tenantId}"`);
      success++;
    } catch (err) {
      console.error(`  [FAIL] ${email ?? uid} — ${err.message}`);
      failed++;
    }
  }

  console.log(`\n=== Done! ${success} updated, ${skipped} skipped, ${failed} failed ===`);
}

main().catch(err => {
  console.error('Script failed:', err);
  process.exit(1);
});
