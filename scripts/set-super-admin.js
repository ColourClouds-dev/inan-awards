#!/usr/bin/env node
/**
 * Set the superAdmin custom claim on a Firebase Auth user by email.
 * Usage: node scripts/set-super-admin.js admin@inan.com.ng
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

const email = process.argv[2];
if (!email) {
  console.error('Usage: node scripts/set-super-admin.js <email>');
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

adminAuth
  .getUserByEmail(email)
  .then(user => adminAuth.setCustomUserClaims(user.uid, { superAdmin: true }))
  .then(() => {
    console.log(`✅ superAdmin claim set for ${email}`);
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
  });
