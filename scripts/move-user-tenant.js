#!/usr/bin/env node
/**
 * Move a user to a different tenant and/or role by updating their
 * Firebase Auth custom claims AND their tenant-admins Firestore document.
 *
 * Usage:
 *   node scripts/move-user-tenant.js <email> <newTenantId> <newRole>
 *
 * Examples:
 *   node scripts/move-user-tenant.js john@inan.com.ng inan-management staff
 *   node scripts/move-user-tenant.js john@inan.com.ng inan-management owner
 *
 * Requires FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL,
 * and FIREBASE_ADMIN_PRIVATE_KEY to be set in the environment (or .env.local).
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
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');

const [email, newTenantId, newRole] = process.argv.slice(2);

if (!email || !newTenantId || !newRole) {
  console.error('Usage: node scripts/move-user-tenant.js <email> <newTenantId> <newRole>');
  console.error('Example: node scripts/move-user-tenant.js john@inan.com.ng inan-management staff');
  process.exit(1);
}

if (!['staff', 'owner'].includes(newRole)) {
  console.error('❌ newRole must be either "staff" or "owner"');
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

async function run() {
  // 1. Look up the user
  const user = await adminAuth.getUserByEmail(email);
  console.log(`Found user: ${user.uid} (${email})`);

  // 2. Read existing claims so we only overwrite what we need to
  const existing = user.customClaims || {};
  console.log('Current claims:', existing);

  // 3. Set new claims — preserve any other claims (e.g. superAdmin) untouched
  const newClaims = {
    ...existing,
    tenantId: newTenantId,
    role: newRole,
  };
  await adminAuth.setCustomUserClaims(user.uid, newClaims);
  console.log(`✅ Custom claims updated:`, newClaims);

  // 4. Update the tenant-admins Firestore document to keep it in sync
  const docRef = db.collection('tenant-admins').doc(user.uid);
  const snap = await docRef.get();

  if (snap.exists) {
    await docRef.update({ tenantId: newTenantId, role: newRole });
    console.log(`✅ tenant-admins/${user.uid} document updated`);
  } else {
    // Document doesn't exist yet — create it
    await docRef.set({
      uid: user.uid,
      email,
      tenantId: newTenantId,
      role: newRole,
    });
    console.log(`✅ tenant-admins/${user.uid} document created`);
  }

  console.log(`\nDone. ${email} is now "${newRole}" in tenant "${newTenantId}".`);
  console.log('The user must sign out and sign back in for the new token claims to take effect.');
}

run().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
