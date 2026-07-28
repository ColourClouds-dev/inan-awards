import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { getAdminDb } from '../../../lib/firebaseAdmin';
import { createVerificationToken } from '../../../lib/auth';
import { isCustomDomainEmail } from '../../../lib/emailUtils';

export const dynamic = 'force-dynamic';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_FROM_EMAIL = process.env.BREVO_FROM_EMAIL || 'noreply@inan.com.ng';
const BREVO_FROM_NAME = process.env.BREVO_FROM_NAME || 'INAN Feedback';

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

export async function PATCH(req: NextRequest) {
  const isSuperAdmin = await verifySuperAdmin(req);
  if (!isSuperAdmin) {
    return NextResponse.json({ error: 'Unauthorized — Super Admin access required.' }, { status: 403 });
  }

  let uid: string;
  let newEmail: string;

  try {
    const body = await req.json();
    uid = body.uid;
    newEmail = body.newEmail?.trim().toLowerCase();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  if (!uid || !newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
    return NextResponse.json({ error: 'A valid user ID and new email address are required.' }, { status: 400 });
  }

  if (!BREVO_API_KEY) {
    console.error('BREVO_API_KEY is not configured in .env.local');
    return NextResponse.json({ error: 'Mail server configuration error.' }, { status: 500 });
  }

  const auth = getAuth();

  try {
    // 1. Fetch current user and verify they exist
    const userRecord = await auth.getUser(uid);
    if (userRecord.email?.toLowerCase() === newEmail) {
      return NextResponse.json({ error: 'New email cannot be the same as the current email.' }, { status: 400 });
    }

    // 2. Check if new email is already taken
    try {
      await auth.getUserByEmail(newEmail);
      return NextResponse.json({ error: 'That email is already in use by another user.' }, { status: 409 });
    } catch (err: any) {
      if (err.code !== 'auth/user-not-found') {
        throw err;
      }
    }

    // 3. Update Firebase Auth record (marks emailVerified as false)
    await auth.updateUser(uid, { email: newEmail, emailVerified: false });

    // 4. Update the email field in Firestore tenant-admins collection
    const db = getAdminDb();
    await db.doc(`tenant-admins/${uid}`).update({ email: newEmail });

    // 5. Route verification email
    const isCustom = isCustomDomainEmail(newEmail);
    let verifyUrl = '';
    let emailSubject = 'Verify your new email address';
    let introText = 'You requested to change your email address. Please verify this new email address to complete the update.';

    if (isCustom) {
      // Custom domain → generate custom verification token and verifyUrl pointing to our app
      const token = await createVerificationToken(uid, newEmail);
      verifyUrl = `${SITE_URL}/verify-email?token=${token}&uid=${uid}&email=${encodeURIComponent(newEmail)}`;
    } else {
      // Standard domain → generate Firebase native verification link
      verifyUrl = await auth.generateEmailVerificationLink(newEmail, { url: `${SITE_URL}/login` });
      emailSubject = 'Verify your email address';
      introText = 'Please verify your email address to complete setting up your account.';
    }

    const htmlContent = `
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
                      ${isCustom ? 'Verify your new email address' : 'Verify your email address'}
                    </h2>
                    <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6;">
                      ${introText}
                      This link will expire ${isCustom ? 'in 12 hours' : 'soon'}.
                    </p>
                    <table cellpadding="0" cellspacing="0" style="margin:24px 0;">
                      <tr>
                        <td style="border-radius:8px;background:#7C3AED;padding:0;">
                          <a href="${verifyUrl}" style="display:block;padding:14px 28px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:8px;">
                            Verify Email
                          </a>
                        </td>
                      </tr>
                    </table>
                    <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.5;">
                      Or copy this link: <a href="${verifyUrl}" style="color:#7C3AED;">${verifyUrl}</a>
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
    `;

    // Send email using Brevo HTTP API
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': BREVO_API_KEY,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender: {
          name: BREVO_FROM_NAME,
          email: BREVO_FROM_EMAIL,
        },
        to: [{ email: newEmail }],
        subject: emailSubject,
        htmlContent: htmlContent,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Brevo API Error:', errorText);
      return NextResponse.json({ error: 'Brevo email delivery failed for verification.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Change user email error:', err);
    if (err.code === 'auth/invalid-email') {
      return NextResponse.json({ error: 'Invalid email address format.' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to update user email.' }, { status: 500 });
  }
}
