#!/usr/bin/env node
/**
 * Repair missing tenantId claims and tenant-admins records for users
 * who registered via the old CreateAccountModal flow (before the fix).
 *
 * Those users have a valid Firebase Auth account and verified email but:
 *   - No tenant-admins/{uid} document in Firestore
 *   - No tenantId custom claim on their Auth token
 *
 * The script does two passes:
 *
 *   Pass 1 — existing backfill (same as backfill-tenant-claims.js)
 *     For every tenant-admins doc, ensure the Auth user has the correct claim.
 *     Handles users whose Firestore mapping exists but whose claim was never set.
 *
 *   Pass 2 — orphan repair
 *     Lists every Auth user with no tenantId claim and no tenant-admins doc.
 *     Writes the missing tenant-admins/{uid} record and stamps the claim.
 *
 * Usage:
 *   node scripts/repair-missing-tenant-claims.js <tenantId>
 *
 *   <tenantId>  The tenant to assign orphaned users to (e.g. "inan").
 *               Only users with NO existing tenantId claim are touched.
 *
 * Requires in .env.local:
 *   FIREBASE_ADMIN_PROJECT_ID
 *   FIREBASE_ADMIN_CLIENT_EMAIL
 *   FIREBASE_ADMIN_PRIVATE_KEY
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

// ── Argument validation ───────────────────────────────────────────────────────

const targetTenantId = process.argv[2];

if (!targetTenantId) {
  console.error('Usage: node scripts/repair-missing-tenant-claims.js <tenantId>');
  console.error('Example: node scripts/repair-missing-tenant-claims.js inan');
  process.exit(1);
}

// ── Firebase Admin init ───────────────────────────────────────────────────────

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

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Fetch all Firebase Auth users, handling pagination automatically. */
async function listAllAuthUsers() {
  const users = [];
  let pageToken;
  do {
    const result = await adminAuth.listUsers(1000, pageToken);
    users.push(...result.users);
    pageToken = result.pageToken;
  } while (pageToken);
  return users;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== Repairing missing tenantId claims ===\n');
  console.log(`Target tenant for orphaned users: "${targetTenantId}"\n`);

  // Confirm the target tenant exists before touching anything.
  const tenantSnap = await db.doc(`tenants/${targetTenantId}`).get();
  if (!tenantSnap.exists) {
    console.error(`ERROR: Tenant "${targetTenantId}" does not exist in Firestore.`);
    console.error('Double-check the tenantId and try again.');
    process.exit(1);
  }
  console.log(`Tenant "${targetTenantId}" confirmed.\n`);

  // ── Pass 1: backfill claims for users who have a tenant-admins doc ──────────

  console.log('--- Pass 1: Backfill claims from existing tenant-admins docs ---\n');

  const adminDocsSnap = await db.collection('tenant-admins').get();
  const knownUids = new Set();

  let p1Updated = 0;
  let p1Skipped = 0;
  let p1Failed = 0;

  for (const docSnap of adminDocsSnap.docs) {
    const uid = docSnap.id;
    const { tenantId, email } = docSnap.data();
    knownUids.add(uid);

    if (!tenantId) {
      console.log(`  [SKIP] ${uid} — tenant-admins doc has no tenantId field`);
      p1Skipped++;
      continue;
    }

    try {
      const user = await adminAuth.getUser(uid);
      const existing = user.customClaims ?? {};

      if (existing.tenantId === tenantId) {
        console.log(`  [SKIP] ${email ?? uid} — claim already correct ("${tenantId}")`);
        p1Skipped++;
        continue;
      }

      // Preserve any other claims (e.g. superAdmin) while adding tenantId.
      await adminAuth.setCustomUserClaims(uid, { ...existing, tenantId });
      console.log(`  [OK]   ${email ?? uid} → tenantId claim set to "${tenantId}"`);
      p1Updated++;
    } catch (err) {
      console.error(`  [FAIL] ${email ?? uid} — ${err.message}`);
      p1Failed++;
    }
  }

  console.log(`\nPass 1 complete: ${p1Updated} updated, ${p1Skipped} skipped, ${p1Failed} failed\n`);

  // ── Pass 2: repair orphaned users (no tenant-admins doc, no claim) ──────────

  console.log('--- Pass 2: Repair orphaned Auth users ---\n');

  const allUsers = await listAllAuthUsers();

  const orphans = allUsers.filter(u => {
    const hasClaim = !!(u.customClaims?.tenantId);
    const hasDoc = knownUids.has(u.uid);
    return !hasClaim && !hasDoc;
  });

  if (orphans.length === 0) {
    console.log('  No orphaned users found. Nothing to repair.\n');
  } else {
    console.log(`  Found ${orphans.length} orphaned user(s) — assigning to "${targetTenantId}"\n`);
  }

  let p2Updated = 0;
  let p2Failed = 0;

  for (const user of orphans) {
    const label = user.email ?? user.uid;
    try {
      // Write the missing tenant-admins doc.
      await db.doc(`tenant-admins/${user.uid}`).set({
        tenantId: targetTenantId,
        email: user.email ?? '',
        createdAt: new Date(),
        repairedAt: new Date(),   // audit field so you know this was backfilled
      }, { merge: true });

      // Stamp the claim, preserving any other existing claims.
      const existing = user.customClaims ?? {};
      await adminAuth.setCustomUserClaims(user.uid, { ...existing, tenantId: targetTenantId });

      console.log(`  [OK]   ${label} → tenant-admins doc created + claim set to "${targetTenantId}"`);
      p2Updated++;
    } catch (err) {
      console.error(`  [FAIL] ${label} — ${err.message}`);
      p2Failed++;
    }
  }

  if (orphans.length > 0) {
    console.log(`\nPass 2 complete: ${p2Updated} repaired, ${p2Failed} failed\n`);
  }

  // ── Summary ─────────────────────────────────────────────────────────────────

  const totalUpdated = p1Updated + p2Updated;
  const totalFailed = p1Failed + p2Failed;
  console.log(`=== All done! ${totalUpdated} user(s) updated, ${totalFailed} failed ===`);

  if (totalFailed > 0) {
    console.log('\nUsers marked [FAIL] were not updated. Re-run the script to retry them.');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('\nScript failed unexpectedly:', err);
  process.exit(1);
});
