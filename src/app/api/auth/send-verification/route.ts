import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { createVerificationToken } from '../../../../lib/auth';

export const dynamic = 'force-dynamic';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_FROM_EMAIL = process.env.BREVO_FROM_EMAIL || 'noreply@inan.com.ng';
const BREVO_FROM_NAME = process.env.BREVO_FROM_NAME || 'INAN Feedback';

export async function POST(req: NextRequest) {
  try {
    const { uid, email } = await req.json();

    if (!uid || !email) {
      return NextResponse.json({ error: 'Missing required fields (uid, email).' }, { status: 400 });
    }

    if (!BREVO_API_KEY) {
      console.error('BREVO_API_KEY is not configured in .env.local');
      return NextResponse.json({ error: 'Mail server configuration error.' }, { status: 500 });
    }

    const auth = getAuth();
    let userRecord;
    try {
      userRecord = await auth.getUser(uid);
    } catch (err) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    if (userRecord.email?.toLowerCase() !== email.trim().toLowerCase()) {
      return NextResponse.json({ error: 'Email does not match user record.' }, { status: 400 });
    }

    if (userRecord.emailVerified) {
      return NextResponse.json({ error: 'Email is already verified.' }, { status: 400 });
    }

    // Generate token (handles rate limit internally)
    let token: string;
    try {
      token = await createVerificationToken(uid, email.trim().toLowerCase());
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 429 });
    }

    const verifyUrl = `${SITE_URL}/verify-email?token=${token}&uid=${uid}&email=${encodeURIComponent(email)}`;
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
                      Verify your email address
                    </h2>
                    <p style="margin:0 0 16px;color:#d5e0f2;font-size:15px;line-height:1.6;">
                      Thank you for registering. Please verify your email address to complete setting up your account.
                      This link will expire in 12 hours.
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
        to: [{ email: email.trim().toLowerCase() }],
        subject: 'Verify your email address',
        htmlContent: htmlContent,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Brevo API Error:', errorText);
      return NextResponse.json({ error: 'Brevo email delivery failed.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Send verification error:', err);
    return NextResponse.json({ error: 'Failed to send verification email.' }, { status: 500 });
  }
}
