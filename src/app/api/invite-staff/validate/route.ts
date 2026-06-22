import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '../../../../lib/firebaseAdmin';

export const dynamic = 'force-dynamic';

// GET /api/invite-staff/validate?token=xxx
// Returns the invitation details so the register page can pre-fill email
// and know which tenant to join.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.json({ error: 'token is required' }, { status: 400 });
  }

  try {
    const db = getAdminDb();
    const snap = await db.doc(`tenant-invitations/${token}`).get();

    if (!snap.exists) {
      return NextResponse.json({ error: 'Invitation not found.' }, { status: 404 });
    }

    const data = snap.data() as {
      tenantId: string;
      email: string;
      role: string;
      used: boolean;
      expiresAt: { toDate: () => Date } | Date;
    };

    if (data.used) {
      return NextResponse.json({ error: 'This invitation has already been used.' }, { status: 410 });
    }

    const expiresAt = typeof data.expiresAt === 'object' && 'toDate' in data.expiresAt
      ? data.expiresAt.toDate()
      : new Date(data.expiresAt as unknown as string);

    if (expiresAt < new Date()) {
      return NextResponse.json({ error: 'This invitation has expired.' }, { status: 410 });
    }

    // Resolve tenant name for display
    let tenantName = data.tenantId;
    try {
      const tenantSnap = await db.doc(`tenants/${data.tenantId}`).get();
      if (tenantSnap.exists) tenantName = (tenantSnap.data() as { name: string }).name;
    } catch { /* non-fatal */ }

    return NextResponse.json({
      valid: true,
      email: data.email,
      tenantId: data.tenantId,
      tenantName,
      role: data.role,
    });
  } catch (err) {
    console.error('validate-invite error:', err);
    return NextResponse.json({ error: 'Failed to validate invitation.' }, { status: 500 });
  }
}
