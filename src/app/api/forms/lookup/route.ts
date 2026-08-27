import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '../../../../lib/firebaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const idOrSlug = searchParams.get('idOrSlug') || searchParams.get('slug') || searchParams.get('id');
    const headerTenantId = request.headers.get('x-tenant-id');
    const queryTenantId = searchParams.get('tenantId');
    const tenantId = queryTenantId || headerTenantId;

    if (!idOrSlug) {
      return NextResponse.json({ error: 'Form identifier is required' }, { status: 400 });
    }

    const db = getAdminDb();

    // 1. Check if it's a direct document ID in feedback-forms
    const docSnap = await db.doc(`feedback-forms/${idOrSlug}`).get();
    if (docSnap.exists) {
      const data = { id: docSnap.id, ...docSnap.data() };
      return NextResponse.json({ form: data });
    }

    // 2. Look up by slug with tenant scope if provided
    if (tenantId) {
      const tenantQuerySnap = await db
        .collection('feedback-forms')
        .where('tenantId', '==', tenantId)
        .where('slug', '==', idOrSlug)
        .limit(1)
        .get();

      if (!tenantQuerySnap.empty) {
        const doc = tenantQuerySnap.docs[0];
        const data = { id: doc.id, ...doc.data() };
        return NextResponse.json({ form: data });
      }
    }

    // 3. Fallback: Search by slug across all documents
    const globalQuerySnap = await db
      .collection('feedback-forms')
      .where('slug', '==', idOrSlug)
      .limit(1)
      .get();

    if (!globalQuerySnap.empty) {
      const doc = globalQuerySnap.docs[0];
      const data = { id: doc.id, ...doc.data() };
      return NextResponse.json({ form: data });
    }

    return NextResponse.json({ form: null, error: 'Form not found' }, { status: 404 });
  } catch (err) {
    console.error('Error in form lookup API:', err);
    return NextResponse.json({ error: 'Failed to look up form' }, { status: 500 });
  }
}
