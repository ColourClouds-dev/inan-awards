import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '../../../lib/firebaseAdmin';
import { getAuth } from 'firebase-admin/auth';

export const dynamic = 'force-dynamic';

/** Verify the request is from a verified tenant owner and return their tenantId. */
async function verifyOwner(req: NextRequest): Promise<string | null> {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) return null;
    const decoded = await getAuth().verifyIdToken(authHeader.slice(7));
    if (decoded.role === 'owner' && decoded.tenantId) {
      return decoded.tenantId as string;
    }
    return null;
  } catch {
    return null;
  }
}

/** Commit a batch of deletes, split into chunks of ≤ 499 operations. */
async function batchDelete(db: FirebaseFirestore.Firestore, refs: FirebaseFirestore.DocumentReference[]) {
  const CHUNK = 499;
  for (let i = 0; i < refs.length; i += CHUNK) {
    const batch = db.batch();
    refs.slice(i, i + CHUNK).forEach(ref => batch.delete(ref));
    await batch.commit();
  }
}

// DELETE /api/delete-all-forms
// Deletes every feedback form and every feedback response belonging to the
// caller's tenant, then resets the tenant's formCount to 0.
// Only tenant owners are allowed to call this endpoint.
export async function DELETE(req: NextRequest) {
  const tenantId = await verifyOwner(req);
  if (!tenantId) {
    return NextResponse.json({ error: 'Unauthorized. Only tenant owners can perform this action.' }, { status: 403 });
  }

  const db = getAdminDb();

  try {
    // 1. Fetch all forms for this tenant
    const formsSnap = await db
      .collection('feedback-forms')
      .where('tenantId', '==', tenantId)
      .get();

    const formRefs = formsSnap.docs.map(d => d.ref);
    const formIds = formsSnap.docs.map(d => d.id);

    // 2. Fetch all responses for this tenant
    const responsesSnap = await db
      .collection('feedback-responses')
      .where('tenantId', '==', tenantId)
      .get();

    // Also catch any responses that may be keyed by formId but missing tenantId
    // (legacy data), by fetching responses for each formId individually.
    const legacyRefs: FirebaseFirestore.DocumentReference[] = [];
    if (formIds.length > 0) {
      // Firestore 'in' supports up to 30 items per query; chunk if needed
      const CHUNK = 30;
      for (let i = 0; i < formIds.length; i += CHUNK) {
        const chunk = formIds.slice(i, i + CHUNK);
        const legacySnap = await db
          .collection('feedback-responses')
          .where('formId', 'in', chunk)
          .get();
        for (const doc of legacySnap.docs) {
          // Only include if not already captured by the tenantId query
          if (!responsesSnap.docs.find(r => r.id === doc.id)) {
            legacyRefs.push(doc.ref);
          }
        }
      }
    }

    const responseRefs = [...responsesSnap.docs.map(d => d.ref), ...legacyRefs];

    // 3. Delete responses first, then forms (in batches of 499)
    await batchDelete(db, responseRefs);
    await batchDelete(db, formRefs);

    // 4. Reset the tenant's formCount to 0
    await db.doc(`tenants/${tenantId}`).update({ formCount: 0 });

    return NextResponse.json({
      success: true,
      deleted: { forms: formRefs.length, responses: responseRefs.length },
    });
  } catch (err) {
    console.error('delete-all-forms error:', err);
    return NextResponse.json({ error: 'Failed to delete forms and responses. Please try again.' }, { status: 500 });
  }
}
