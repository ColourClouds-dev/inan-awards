import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '../../../lib/firebaseAdmin';
import type { Tenant, TenantFeatures } from '../../../types';

const DEFAULT_FEATURES: TenantFeatures = {
  feedbackForms: true,
  nominations: false,
  employeeRecords: false,
  seoSettings: false,
  hidePoweredBy: false,
};

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
      nominationFormLimit: 2,
      formCount: 0,
      nominationFormCount: 0,
      features: { ...DEFAULT_FEATURES },
      createdAt: new Date(),
    };

    // Use a batch write so both documents are created atomically
    const batch = db.batch();
    batch.set(db.doc(`tenants/${tenantId}`), JSON.parse(JSON.stringify(tenant)));
    batch.set(db.doc(`tenant-admins/${uid}`), {
      tenantId,
      email,
      createdAt: new Date(),
    });
    await batch.commit();

    return NextResponse.json({ success: true, tenantId });
  } catch (err) {
    console.error('Register tenant error:', err);
    return NextResponse.json({ error: 'Failed to create account. Please try again.' }, { status: 500 });
  }
}
