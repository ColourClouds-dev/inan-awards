import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '../../../lib/firebaseAdmin';
import { getAuth } from 'firebase-admin/auth';

const COOKIE_NAME = 'sa-impersonate';
const COOKIE_MAX_AGE = 60 * 60 * 4; // 4 hours

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

// POST /api/impersonate — start impersonating a tenant
export async function POST(req: NextRequest) {
  const isSuperAdmin = await verifySuperAdmin(req);
  if (!isSuperAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { tenantId } = await req.json();
  if (!tenantId) {
    return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
  }

  // Verify the tenant exists
  const snap = await getAdminDb().doc(`tenants/${tenantId}`).get();
  if (!snap.exists) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
  }

  const res = NextResponse.json({ success: true, tenantId });
  res.cookies.set(COOKIE_NAME, tenantId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  });
  return res;
}

// DELETE /api/impersonate — stop impersonating
export async function DELETE(req: NextRequest) {
  const res = NextResponse.json({ success: true });
  res.cookies.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });
  return res;
}
