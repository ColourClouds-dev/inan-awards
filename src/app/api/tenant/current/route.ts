import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '../../../../lib/firebaseAdmin';
export const dynamic = 'force-dynamic';


export async function GET(req: NextRequest) {
  try {
    const domain = req.headers.get('x-tenant-domain') ?? '';
    const tenantIdHeader = req.headers.get('x-tenant-id') ?? '';
    const isImpersonating = req.headers.get('x-impersonating') === 'true';

    const db = getAdminDb();

    // Try by tenantId header first (covers both impersonation and static map)
    if (tenantIdHeader) {
      const snap = await db.doc(`tenants/${tenantIdHeader}`).get();
      if (snap.exists) {
        const tenant = { id: snap.id, ...snap.data() };
        return NextResponse.json({ tenant, isImpersonating });
      }
    }

    // Try to look up by domain
    if (domain) {
      const snap = await db
        .collection('tenants')
        .where('domain', '==', domain)
        .limit(1)
        .get();

      if (!snap.empty) {
        const doc = snap.docs[0];
        const tenant = { id: doc.id, ...doc.data() };
        return NextResponse.json({ tenant, isImpersonating: false });
      }
    }

    // Fall back to "inan" for dev
    const fallbackSnap = await db.doc('tenants/inan').get();
    if (fallbackSnap.exists) {
      const tenant = { id: fallbackSnap.id, ...fallbackSnap.data() };
      return NextResponse.json({ tenant, isImpersonating: false });
    }

    return NextResponse.json({ tenantId: 'inan', tenant: null, isImpersonating: false });
  } catch (err) {
    console.error('Tenant lookup error:', err);
    return NextResponse.json({ tenantId: 'inan', tenant: null, isImpersonating: false });
  }
}
