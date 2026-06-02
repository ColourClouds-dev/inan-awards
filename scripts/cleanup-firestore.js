/**
 * cleanup-firestore.js
 *
 * Deletes Firestore collections that are no longer used by the application:
 *   - nominations-forms
 *   - nominations-votes
 *   - nominations  (legacy)
 *   - settings     (only had survey countdown, CountdownTimer is unused)
 *   - users        (legacy, nothing reads/writes it)
 *
 * Run with:
 *   node scripts/cleanup-firestore.js
 *
 * Requires: FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL,
 *           FIREBASE_ADMIN_PRIVATE_KEY in your environment (or .env.local).
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Load .env.local manually
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '../.env.local');
try {
  const envContent = readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const val = match[2].trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) process.env[key] = val;
    }
  });
} catch {
  console.log('.env.local not found — using existing environment variables.');
}

import admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();

const DEAD_COLLECTIONS = [
  'nominations-forms',
  'nominations-votes',
  'nominations',
  'settings',
  'users',
];

async function deleteCollection(collectionName, batchSize = 300) {
  const ref = db.collection(collectionName);
  let deleted = 0;

  while (true) {
    const snap = await ref.limit(batchSize).get();
    if (snap.empty) break;

    const batch = db.batch();
    snap.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    deleted += snap.docs.length;
    console.log(`  Deleted ${deleted} docs from ${collectionName}…`);
  }

  console.log(`✓ ${collectionName} — ${deleted} document(s) deleted.`);
}

async function main() {
  console.log('Starting Firestore cleanup…\n');
  for (const col of DEAD_COLLECTIONS) {
    await deleteCollection(col);
  }
  console.log('\nDone. All unused collections have been cleared.');
  process.exit(0);
}

main().catch(err => {
  console.error('Cleanup failed:', err);
  process.exit(1);
});
