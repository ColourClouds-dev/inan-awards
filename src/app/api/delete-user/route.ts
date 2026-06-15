import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '../../../lib/firebaseAdmin';
import { getAuth } from 'firebase-admin/auth';

export const dynamic = 'force-dynamic';

async function verifySuperAdmin(req: NextRequest): Promise<boolean> {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) return false;
    const token = authHeader.slice(7);
    const decoded = await getAuth().verifyIdToken(token);
    return decoded.superAdmin === true;
  } catch {
    return false;
  }
}

// DELETE /api/delete-user
// Body: { uid: string }
export async function DELETE(req: NextRequest) {
  const isSuperAdmin = await verifySuperAdmin(req);
  if (!isSuperAdmin) {
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

  try {
    // Delete Firebase Auth account and Firestore tenant-admins doc in parallel
    await Promise.all([
      getAuth().deleteUser(uid),
      getAdminDb().doc(`tenant-admins/${uid}`).delete(),
    ]);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('delete-user error:', err);

    // Firebase Admin throws if the user doesn't exist in Auth —
    // still clean up Firestore in case the Auth record was already gone
    if (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code: string }).code === 'auth/user-not-found'
    ) {
      try {
        await getAdminDb().doc(`tenant-admins/${uid}`).delete();
        return NextResponse.json({ success: true });
      } catch {
        // Firestore cleanup failed — not critical, return success anyway
        return NextResponse.json({ success: true });
      }
    }

    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
  }
}
