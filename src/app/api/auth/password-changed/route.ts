import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { getAdminApp } from '../../../../lib/firebaseAdmin';

export const dynamic = 'force-dynamic';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_FROM_EMAIL = process.env.BREVO_FROM_EMAIL || 'noreply@inan.com.ng';
const BREVO_FROM_NAME = process.env.BREVO_FROM_NAME || 'INAN Feedback';

export async function POST(req: NextRequest) {
  try {
    // ── Auth check ──────────────────────────────────────────────────────────
    const authHeader = req.headers.get('authorization') ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    try {
      await getAuth(getAdminApp()).verifyIdToken(token);
    } catch {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    // ── Validate body ───────────────────────────────────────────────────────
    const { email } = await req.json();

    if (!email || typeof email !== 'string' || !email.trim()) {
      return NextResponse.json({ error: 'Missing required field: email.' }, { status: 400 });
    }

    if (!BREVO_API_KEY) {
      console.error('BREVO_API_KEY is not configured');
      return NextResponse.json({ error: 'Mail server configuration error.' }, { status: 500 });
    }

    // ── Build timestamp ─────────────────────────────────────────────────────
    const changedAt = new Date().toLocaleString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    });

    const loginUrl = `${SITE_URL.replace(/\/$/, '')}/login`;

    // ── Email HTML ──────────────────────────────────────────────────────────
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
                      Security Alert — Password Changed
                    </h2>
                    <p style="margin:0 0 12px;color:#374151;font-size:15px;line-height:1.6;">
                      The password for your INAN Feedback account was recently changed.
                    </p>
                    <table cellpadding="0" cellspacing="0" style="margin:0 0 20px;width:100%;">
                      <tr>
                        <td style="padding:12px 16px;background:#f3f4f6;border-radius:8px;font-size:14px;color:#374151;">
                          <strong>Time:</strong> ${changedAt}
                        </td>
                      </tr>
                    </table>
                    <p style="margin:0 0 8px;color:#374151;font-size:15px;line-height:1.6;">
                      If you made this change, no further action is needed.
                    </p>
                    <p style="margin:0 0 24px;color:#DC2626;font-size:15px;font-weight:600;line-height:1.6;">
                      If you did NOT make this change, your account may be compromised.
                      Reset your password immediately using the button below.
                    </p>
                    <table cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                      <tr>
                        <td style="border-radius:8px;background:#DC2626;padding:0;">
                          <a href="${loginUrl}" style="display:block;padding:14px 28px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:8px;">
                            Reset My Password
                          </a>
                        </td>
                      </tr>
                    </table>
                    <p style="margin:0 0 8px;color:#6b7280;font-size:13px;line-height:1.5;">
                      Or copy this link: <a href="${loginUrl}" style="color:#7C3AED;">${loginUrl}</a>
                    </p>
                    <p style="margin:16px 0 0;color:#6b7280;font-size:13px;line-height:1.5;">
                      If you are unable to access your account, contact your administrator.
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

    // ── Send via Brevo ──────────────────────────────────────────────────────
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': BREVO_API_KEY,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender: { name: BREVO_FROM_NAME, email: BREVO_FROM_EMAIL },
        to: [{ email: email.trim().toLowerCase() }],
        subject: 'Security Alert — Your password was changed',
        htmlContent,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Brevo API Error (password-changed):', errorText);
      return NextResponse.json({ error: 'Email delivery failed.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Password changed notification error:', err);
    return NextResponse.json({ error: 'Failed to send notification.' }, { status: 500 });
  }
}
