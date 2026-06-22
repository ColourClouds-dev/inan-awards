import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '../../../lib/firebaseAdmin';
import { getAuth } from 'firebase-admin/auth';

export const dynamic = 'force-dynamic';

interface Caller {
  isSuperAdmin: boolean;
  isOwner: boolean;
  tenantId: string | null;
}

async function verifyCaller(req: NextRequest): Promise<Caller | null> {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) return null;
    const decoded = await getAuth().verifyIdToken(authHeader.slice(7));
    if (decoded.superAdmin) return { isSuperAdmin: true, isOwner: false, tenantId: null };
    if (decoded.role === 'owner') return { isSuperAdmin: false, isOwner: true, tenantId: decoded.tenantId as string };
    return null;
  } catch {
    return null;
  }
}

// DELETE /api/delete-user
// Body: { uid: string }
// Allowed: super admins (any user) + owners (staff within their own tenant only)
export async function DELETE(req: NextRequest) {
  const caller = await verifyCaller(req);
  if (!caller) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  let uid: string;
  try {
    const body = await req.json();
    uid = body.uid;
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!uid?.trim()) {
    return NextResponse.json({ error: 'uid is required' }, { status: 400 });
  }

  const db = getAdminDb();

  // Look up the target user's tenant before deleting
  let tenantId: string | null = null;
  let targetRole: string | null = null;
  try {
    const adminSnap = await db.doc(`tenant-admins/${uid}`).get();
    if (adminSnap.exists) {
      tenantId = (adminSnap.data() as { tenantId?: string }).tenantId ?? null;
      targetRole = (adminSnap.data() as { role?: string }).role ?? null;
    }
  } catch { /* non-fatal — proceed with deletion */ }

  // Owners can only remove staff from their own tenant — not other owners or other tenants
  if (caller.isOwner) {
    if (!tenantId || tenantId !== caller.tenantId) {
      return NextResponse.json({ error: 'Unauthorized — user belongs to a different tenant.' }, { status: 403 });
    }
    if (targetRole === 'owner') {
      return NextResponse.json({ error: 'Owners cannot remove other admins. Contact super admin.' }, { status: 403 });
    }
  }

  try {
    // 1. Delete Firebase Auth account and tenant-admins doc in parallel
    await Promise.all([
      getAuth().deleteUser(uid).catch((err: unknown) => {
        if (
          typeof err === 'object' && err !== null && 'code' in err &&
          (err as { code: string }).code === 'auth/user-not-found'
        ) return;
        throw err;
      }),
      db.doc(`tenant-admins/${uid}`).delete(),
    ]);

    // 2. Delete all feedback forms created by this user (and their responses)
    if (tenantId) {
      const formsSnap = await db.collection('feedback-forms')
        .where('tenantId', '==', tenantId)
        .where('createdBy', '==', uid)
        .get();

      if (!formsSnap.empty) {
        const formIds = formsSnap.docs.map(d => d.id);
        await Promise.all(formsSnap.docs.map(d => d.ref.delete()));

        for (const formId of formIds) {
          const responsesSnap = await db.collection('feedback-responses')
            .where('formId', '==', formId)
            .get();
          if (!responsesSnap.empty) {
            const batches: Promise<unknown>[] = [];
            let batch = db.batch();
            let count = 0;
            for (const doc of responsesSnap.docs) {
              batch.delete(doc.ref);
              count++;
              if (count === 499) {
                batches.push(batch.commit());
                batch = db.batch();
                count = 0;
              }
            }
            if (count > 0) batches.push(batch.commit());
            await Promise.all(batches);
          }
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('delete-user error:', err);
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
  }
}
