#!/usr/bin/env node
/**
 * Fix a single user's tenant mapping and custom claim.
 *
 * Usage: node scripts/fix-single-user.js <uid> <tenantId>
 * Example: node scripts/fix-single-user.js 6pNEzK1WBoMmW5Za3uGtzOM3WI22 inan
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

const uid = process.argv[2];
const tenantId = process.argv[3];

if (!uid || !tenantId) {
  console.error('Usage: node scripts/fix-single-user.js <uid> <tenantId>');
  console.error('Example: node scripts/fix-single-user.js 6pNEzK1WBoMmW5Za3uGtzOM3WI22 inan');
  process.exit(1);
}

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
  console.log(`Fixing user ${uid} → tenant "${tenantId}"\n`);

  // 1. Confirm tenant exists
  const tenantSnap = await db.doc(`tenants/${tenantId}`).get();
  if (!tenantSnap.exists) {
    console.error(`ERROR: Tenant "${tenantId}" does not exist.`);
    process.exit(1);
  }

  // 2. Get user's email for logging
  let email = '';
  try {
    const user = await adminAuth.getUser(uid);
    email = user.email || '';
  } catch (err) {
    console.error(`ERROR: Auth user ${uid} not found — ${err.message}`);
    process.exit(1);
  }

  // 3. Update tenant-admins doc
  await db.doc(`tenant-admins/${uid}`).set({ 
    tenantId, 
    email,
    updatedAt: new Date() 
  }, { merge: true });
  console.log(`✅ tenant-admins/${uid} — tenantId set to "${tenantId}"`);

  // 4. Set custom claim
  const existing = (await adminAuth.getUser(uid)).customClaims ?? {};
  await adminAuth.setCustomUserClaims(uid, { ...existing, tenantId });
  console.log(`✅ Custom claim set for ${email || uid} → tenantId: "${tenantId}"`);

  console.log('\nDone! User should now be able to access the dashboard.');
}

main().catch(err => {
  console.error('Script failed:', err);
  process.exit(1);
});
