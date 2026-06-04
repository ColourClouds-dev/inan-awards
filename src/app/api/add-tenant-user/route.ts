import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '../../../lib/firebaseAdmin';
import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

function getAdminAuth() {
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
  }
  return getAuth();
}

export async function POST(req: NextRequest) {
  try {
    const { uid, email } = await req.json();

    if (!uid || !email) {
      return NextResponse.json({ error: 'uid and email are required.' }, { status: 400 });
    }

    // Resolve the tenant from the middleware-injected header.
    // This is the same header that every other request uses, so it correctly
    // resolves to whichever tenant is hosting this subdomain.
    const tenantId = req.headers.get('x-tenant-id');

    if (!tenantId) {
      return NextResponse.json({ error: 'Could not resolve tenant.' }, { status: 400 });
    }

    const db = getAdminDb();

    // Confirm the tenant actually exists before assigning the user to it.
    const tenantSnap = await db.doc(`tenants/${tenantId}`).get();
    if (!tenantSnap.exists) {
      return NextResponse.json({ error: 'Tenant not found.' }, { status: 404 });
    }

    // Write the tenant-admins mapping so Firestore rules and any
    // server-side lookups can resolve this user → tenant relationship.
    await db.doc(`tenant-admins/${uid}`).set(
      { tenantId, email, createdAt: new Date() },
      { merge: true }
    );

    // Stamp the tenantId as a custom claim on the Firebase Auth token.
    // This is what TenantContext reads via getIdTokenResult() and what
    // Firestore security rules check via request.auth.token.tenantId.
    await getAdminAuth().setCustomUserClaims(uid, { tenantId });

    return NextResponse.json({ success: true, tenantId });
  } catch (err) {
    console.error('add-tenant-user error:', err);
    return NextResponse.json({ error: 'Failed to add user to tenant.' }, { status: 500 });
  }
}
