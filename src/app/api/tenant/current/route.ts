import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '../../../../lib/firebaseAdmin';

export async function GET(req: NextRequest) {
  try {
    const domain = req.headers.get('x-tenant-domain') ?? '';
    const tenantIdHeader = req.headers.get('x-tenant-id') ?? '';

    const db = getAdminDb();

    // Try to look up by domain first
    if (domain) {
      const snap = await db
        .collection('tenants')
        .where('domain', '==', domain)
        .limit(1)
        .get();

      if (!snap.empty) {
        const doc = snap.docs[0];
        const tenant = { id: doc.id, ...doc.data() };
        return NextResponse.json({ tenant });
      }
    }

    // Try by tenantId header
    if (tenantIdHeader) {
      const snap = await db.doc(`tenants/${tenantIdHeader}`).get();
      if (snap.exists) {
        const tenant = { id: snap.id, ...snap.data() };
        return NextResponse.json({ tenant });
      }
    }

    // Fall back to "inan" for dev
    const fallbackSnap = await db.doc('tenants/inan').get();
    if (fallbackSnap.exists) {
      const tenant = { id: fallbackSnap.id, ...fallbackSnap.data() };
      return NextResponse.json({ tenant });
    }

    // No tenant found at all — return minimal fallback
    return NextResponse.json({ tenantId: 'inan', tenant: null });
  } catch (err) {
    console.error('Tenant lookup error:', err);
    return NextResponse.json({ tenantId: 'inan', tenant: null });
  }
}
