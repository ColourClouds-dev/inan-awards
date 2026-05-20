import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '../../../lib/firebaseAdmin';
import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import type { Tenant, TenantFeatures } from '../../../types';

const DEFAULT_FEATURES: TenantFeatures = {
  feedbackForms: true,
  employeeRecords: false,
  seoSettings: false,
  hidePoweredBy: false,
};

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
    const { uid, tenantId, companyName, domain, email } = await req.json();

    if (!uid || !tenantId || !companyName || !email) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
    }

    const db = getAdminDb();

    // Check if tenantId already exists
    const existing = await db.doc(`tenants/${tenantId}`).get();
    if (existing.exists) {
      return NextResponse.json(
        { error: `A company with the name "${companyName}" is already registered. Please choose a different name.` },
        { status: 409 }
      );
    }

    const tenant: Tenant = {
      id: tenantId,
      name: companyName,
      domain: domain || `${tenantId}.inanfeedback.com`,
      plan: 'trial',
      status: 'trial',
      formLimit: 5,
      formCount: 0,
      features: { ...DEFAULT_FEATURES },
      createdAt: new Date(),
    };

    // Batch write: tenant doc + tenant-admins mapping
    const batch = db.batch();
    batch.set(db.doc(`tenants/${tenantId}`), JSON.parse(JSON.stringify(tenant)));
    batch.set(db.doc(`tenant-admins/${uid}`), {
      tenantId,
      email,
      createdAt: new Date(),
    });
    await batch.commit();

    // Set tenantId as a custom claim on the Firebase Auth user.
    // This makes it instantly available in the user's ID token and
    // allows Firestore rules to check request.auth.token.tenantId
    // without needing a Firestore lookup.
    await getAdminAuth().setCustomUserClaims(uid, { tenantId });

    return NextResponse.json({ success: true, tenantId });
  } catch (err) {
    console.error('Register tenant error:', err);
    return NextResponse.json({ error: 'Failed to create account. Please try again.' }, { status: 500 });
  }
}
