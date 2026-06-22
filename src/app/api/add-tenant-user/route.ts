import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '../../../lib/firebaseAdmin';
import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import type { TenantRole } from '../../../types';

function getAdminAuth() {
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
  }
  return getAuth();
}

export async function POST(req: NextRequest) {
  try {
    const { uid, email, inviteToken } = await req.json();

    if (!uid || !email) {
      return NextResponse.json({ error: 'uid and email are required.' }, { status: 400 });
    }

    const tenantId = req.headers.get('x-tenant-id');
    if (!tenantId) {
      return NextResponse.json({ error: 'Could not resolve tenant.' }, { status: 400 });
    }

    const db = getAdminDb();

    // Confirm the tenant exists
    const tenantSnap = await db.doc(`tenants/${tenantId}`).get();
    if (!tenantSnap.exists) {
      return NextResponse.json({ error: 'Tenant not found.' }, { status: 404 });
    }
    const tenantData = tenantSnap.data() as { formLimit?: number };
    const tenantFormLimit = tenantData.formLimit ?? 5;

    // Resolve role — check invitation token first, default to 'staff'
    let role: TenantRole = 'staff';
    let inviteDocRef: FirebaseFirestore.DocumentReference | null = null;

    if (inviteToken) {
      const inviteSnap = await db.doc(`tenant-invitations/${inviteToken}`).get();
      if (inviteSnap.exists) {
        const invite = inviteSnap.data() as {
          tenantId: string;
          email: string;
          role: TenantRole;
          used: boolean;
          expiresAt: { toDate: () => Date } | Date;
        };

        // Validate: same tenant, same email, not used, not expired
        const expiresAt = typeof invite.expiresAt === 'object' && 'toDate' in invite.expiresAt
          ? invite.expiresAt.toDate()
          : new Date(invite.expiresAt as unknown as string);

        if (
          invite.tenantId === tenantId &&
          invite.email.toLowerCase() === email.toLowerCase() &&
          !invite.used &&
          expiresAt > new Date()
        ) {
          role = invite.role;
          inviteDocRef = db.doc(`tenant-invitations/${inviteToken}`);
        }
      }
    }

    // Write tenant-admins doc
    await db.doc(`tenant-admins/${uid}`).set(
      {
        tenantId,
        email,
        role,
        createdAt: new Date(),
        formCount: 0,
        formLimit: tenantFormLimit,
      },
      { merge: true }
    );

    // Stamp tenantId + role as custom claims
    await getAdminAuth().setCustomUserClaims(uid, { tenantId, role });

    // Mark invite as used (fire-and-forget)
    if (inviteDocRef) {
      inviteDocRef.update({ used: true }).catch(() => {});
    }

    return NextResponse.json({ success: true, tenantId, role });
  } catch (err) {
    console.error('add-tenant-user error:', err);
    return NextResponse.json({ error: 'Failed to add user to tenant.' }, { status: 500 });
  }
}
