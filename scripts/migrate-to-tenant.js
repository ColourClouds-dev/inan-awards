#!/usr/bin/env node
/**
 * Migration script: adds tenantId: "inan" to all existing documents
 * and creates the tenants/inan document with Inan's config.
 *
 * Also migrates settings/* → tenant-settings/inan/config/*
 *
 * Usage: node scripts/migrate-to-tenant.js
 *
 * Requires FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL,
 * and FIREBASE_ADMIN_PRIVATE_KEY in the environment (or .env.local).
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Load .env.local if present
try {
  const { config } = require('dotenv');
  config({ path: '.env.local' });
} catch {
  // dotenv not installed — rely on environment variables being set externally
}

const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = getFirestore();
const TENANT_ID = 'inan';

const COLLECTIONS_TO_MIGRATE = [
  'feedback-forms',
  'feedback-responses',
  'nominations-forms',
  'nominations-votes',
  'employees',
  'nominations',
];

const SETTINGS_TO_MIGRATE = ['locations', 'notifications', 'seo'];

async function migrateCollection(colName) {
  const snap = await db.collection(colName).get();
  if (snap.empty) {
    console.log(`  [${colName}] empty — skipping`);
    return 0;
  }

  let updated = 0;
  const batchSize = 400;
  let batch = db.batch();
  let count = 0;

  for (const docSnap of snap.docs) {
    if (!docSnap.data().tenantId) {
      batch.update(docSnap.ref, { tenantId: TENANT_ID });
      count++;
      updated++;
      if (count >= batchSize) {
        await batch.commit();
        batch = db.batch();
        count = 0;
      }
    }
  }

  if (count > 0) await batch.commit();
  console.log(`  [${colName}] updated ${updated} / ${snap.size} documents`);
  return updated;
}

async function migrateSettings() {
  for (const key of SETTINGS_TO_MIGRATE) {
    const src = await db.doc(`settings/${key}`).get();
    if (!src.exists) {
      console.log(`  [settings/${key}] not found — skipping`);
      continue;
    }
    const dest = db.doc(`tenant-settings/${TENANT_ID}/config/${key}`);
    const destSnap = await dest.get();
    if (destSnap.exists) {
      console.log(`  [tenant-settings/${TENANT_ID}/config/${key}] already exists — skipping`);
      continue;
    }
    await dest.set(src.data());
    console.log(`  Migrated settings/${key} → tenant-settings/${TENANT_ID}/config/${key}`);
  }
}

async function createInanTenant() {
  const ref = db.doc(`tenants/${TENANT_ID}`);
  const snap = await ref.get();
  if (snap.exists) {
    console.log(`  tenants/${TENANT_ID} already exists — skipping creation`);
    return;
  }

  await ref.set({
    id: TENANT_ID,
    name: 'Inan Hotels',
    domain: 'feedback.inan.com.ng',
    emailDomain: 'inan.com.ng',
    features: {
      feedbackForms: true,
      nominations: true,
      employeeRecords: true,
      seoSettings: true,
      hidePoweredBy: true,
    },
    formLimit: 100,
    formCount: 0,
    nominationFormLimit: 20,
    nominationFormCount: 0,
    status: 'active',
    plan: 'pro',
    createdAt: new Date(),
  });
  console.log(`  Created tenants/${TENANT_ID}`);
}

async function main() {
  console.log('=== Inan Multi-Tenant Migration ===\n');

  console.log('1. Creating tenants/inan document...');
  await createInanTenant();

  console.log('\n2. Migrating collection documents...');
  let totalUpdated = 0;
  for (const col of COLLECTIONS_TO_MIGRATE) {
    totalUpdated += await migrateCollection(col);
  }

  console.log('\n3. Migrating settings to per-tenant paths...');
  await migrateSettings();

  console.log(`\n=== Done! ${totalUpdated} documents updated with tenantId: "${TENANT_ID}" ===`);
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
