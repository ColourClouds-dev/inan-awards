import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '../../../lib/firebaseAdmin';
import { getAuth } from 'firebase-admin/auth';
import type { TenantRole } from '../../../types';

export const dynamic = 'force-dynamic';

async function verifyAuthorized(req: NextRequest): Promise<{
  isSuperAdmin: boolean;
  isOwner: boolean;
  tenantId: string | null;
} | null> {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) return null;
    const token = authHeader.slice(7);
    const decoded = await getAuth().verifyIdToken(token);
    if (decoded.superAdmin) return { isSuperAdmin: true, isOwner: false, tenantId: null };
    if (decoded.role === 'owner') return { isSuperAdmin: false, isOwner: true, tenantId: decoded.tenantId as string };
    return null;
  } catch {
    return null;
  }
}

// PATCH /api/update-user-role
// Body: { uid: string, role: 'owner' | 'staff' }
export async function PATCH(req: NextRequest) {
  const caller = await verifyAuthorized(req);
  if (!caller) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 });
  }

  let uid: string;
  let role: TenantRole;

  try {
    const body = await req.json();
    uid = body.uid?.trim();
    role = body.role;
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  if (!uid) return NextResponse.json({ error: 'uid is required.' }, { status: 400 });
  if (role !== 'owner' && role !== 'staff') {
    return NextResponse.json({ error: 'role must be "owner" or "staff".' }, { status: 400 });
  }

  const db = getAdminDb();

  // Read current tenant-admins doc to verify tenant scoping
  const adminSnap = await db.doc(`tenant-admins/${uid}`).get();
  if (!adminSnap.exists) {
    return NextResponse.json({ error: 'User not found.' }, { status: 404 });
  }

  const userData = adminSnap.data() as { tenantId: string };

  // Owners can only update users within their own tenant
  if (caller.isOwner && caller.tenantId !== userData.tenantId) {
    return NextResponse.json({ error: 'Unauthorized — user belongs to a different tenant.' }, { status: 403 });
  }

  try {
    // Update role in tenant-admins doc
    await db.doc(`tenant-admins/${uid}`).update({ role });

    // Update role in Firebase Auth custom claims (keep existing tenantId)
    const existingClaims = (await getAuth().getUser(uid)).customClaims ?? {};
    await getAuth().setCustomUserClaims(uid, { ...existingClaims, role });

    return NextResponse.json({ success: true, uid, role });
  } catch (err) {
    console.error('update-user-role error:', err);
    return NextResponse.json({ error: 'Failed to update role.' }, { status: 500 });
  }
}
