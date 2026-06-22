import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '../../../lib/firebaseAdmin';
import { getAuth } from 'firebase-admin/auth';
import { Resend } from 'resend';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = 'INAN Feedback <noreply@inan.com.ng>';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://inan.com.ng';

async function verifyOwner(req: NextRequest): Promise<{ uid: string; tenantId: string } | null> {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) return null;
    const token = authHeader.slice(7);
    const decoded = await getAuth().verifyIdToken(token);
    // Allow owners and super admins to send invitations
    if (decoded.role !== 'owner' && !decoded.superAdmin) return null;
    return { uid: decoded.uid, tenantId: decoded.tenantId as string };
  } catch {
    return null;
  }
}

// POST /api/invite-staff
// Body: { email: string, formLimit?: number }
export async function POST(req: NextRequest) {
  const caller = await verifyOwner(req);
  if (!caller) {
    return NextResponse.json({ error: 'Unauthorized — only owners can invite staff.' }, { status: 403 });
  }

  let email: string;
  let formLimit: number | undefined;

  try {
    const body = await req.json();
    email = body.email?.trim().toLowerCase();
    formLimit = body.formLimit ? Number(body.formLimit) : undefined;
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'A valid email address is required.' }, { status: 400 });
  }

  const db = getAdminDb();
  const tenantId = caller.tenantId;

  // Resolve tenant name for the email
  let tenantName = tenantId;
  try {
    const tenantSnap = await db.doc(`tenants/${tenantId}`).get();
    if (tenantSnap.exists) tenantName = (tenantSnap.data() as { name: string }).name;
  } catch { /* non-fatal */ }

  const token = uuidv4();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

  // Write invitation document
  await db.doc(`tenant-invitations/${token}`).set({
    tenantId,
    email,
    role: 'staff',
    invitedBy: caller.uid,
    createdAt: now,
    expiresAt,
    used: false,
    ...(formLimit !== undefined ? { formLimit } : {}),
  });

  // Update the tenant-admins doc if the user already exists (e.g. owner sets formLimit)
  if (formLimit !== undefined) {
    try {
      const existingSnap = await db.collection('tenant-admins')
        .where('tenantId', '==', tenantId)
        .where('email', '==', email)
        .limit(1)
        .get();
      if (!existingSnap.empty) {
        await existingSnap.docs[0].ref.update({ formLimit });
      }
    } catch { /* non-fatal */ }
  }

  const registerUrl = `${SITE_URL}/register?invite=${token}`;

  // Send invitation email (fire-and-forget)
  resend.emails.send({
    from: FROM,
    to: email,
    subject: `You've been invited to join ${tenantName} on INAN Feedback`,
    html: `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8" /></head>
      <body style="margin:0;padding:0;background:#f9fafb;font-family:'Helvetica Neue',Arial,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 0;">
          <tr>
            <td align="center">
              <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
                <tr>
                  <td style="background:#7C3AED;padding:32px 40px;text-align:center;">
                    <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">INAN Feedback</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding:40px;">
                    <h2 style="margin:0 0 16px;color:#111827;font-size:20px;font-weight:700;">
                      You've been invited to ${tenantName}
                    </h2>
                    <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6;">
                      You have been invited to join <strong>${tenantName}</strong> as a staff member on INAN Feedback.
                      Click the button below to create your account. This invitation expires in 7 days.
                    </p>
                    <table cellpadding="0" cellspacing="0" style="margin:24px 0;">
                      <tr>
                        <td style="border-radius:8px;background:#7C3AED;padding:0;">
                          <a href="${registerUrl}" style="display:block;padding:14px 28px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:8px;">
                            Accept Invitation
                          </a>
                        </td>
                      </tr>
                    </table>
                    <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.5;">
                      Or copy this link: <a href="${registerUrl}" style="color:#7C3AED;">${registerUrl}</a>
                    </p>
                    <p style="margin:16px 0 0;color:#6b7280;font-size:13px;line-height:1.5;">
                      If you weren't expecting this invitation, you can safely ignore this email.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:24px 40px;border-top:1px solid #f3f4f6;text-align:center;">
                    <p style="margin:0;color:#9ca3af;font-size:12px;">
                      © ${new Date().getFullYear()} Inan Management Ltd · All rights reserved.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
  }).catch(err => console.error('Invite email error:', err));

  return NextResponse.json({ success: true, token });
}
