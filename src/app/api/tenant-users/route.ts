import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '../../../lib/firebaseAdmin';
import { getAuth } from 'firebase-admin/auth';

import type { QueryDocumentSnapshot, DocumentData } from 'firebase-admin/firestore';

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

// GET /api/tenant-users?tenantId=xxx
export async function GET(req: NextRequest) {
  const isSuperAdmin = await verifySuperAdmin(req);
  if (!isSuperAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const tenantId = searchParams.get('tenantId');
  if (!tenantId) {
    return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
  }

  try {
    const db = getAdminDb();
    const snap = await db
      .collection('tenant-admins')
      .where('tenantId', '==', tenantId)
      .get();

    const users = snap.docs.map((doc: QueryDocumentSnapshot<DocumentData>) => ({
      uid: doc.id,
      email: doc.data().email ?? '',
      createdAt: doc.data().createdAt ?? null,
      welcomeSent: doc.data().welcomeSent ?? false,
    }));

    return NextResponse.json({ users });
  } catch (err) {
    console.error('tenant-users error:', err);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}
