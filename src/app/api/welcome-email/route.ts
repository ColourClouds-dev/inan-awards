import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { getAdminDb } from '../../../lib/firebaseAdmin';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = 'INAN Feedback <noreply@inan.com.ng>';
const DASHBOARD_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://inan.com.ng';

export async function POST(req: NextRequest) {
  try {
    const { uid, email, companyName } = await req.json();

    if (!uid || !email) {
      return NextResponse.json({ error: 'uid and email are required.' }, { status: 400 });
    }

    const db = getAdminDb();
    const adminRef = db.doc(`tenant-admins/${uid}`);
    const adminSnap = await adminRef.get();

    // Guard: only send once
    if (adminSnap.exists && (adminSnap.data() as { welcomeSent?: boolean }).welcomeSent) {
      return NextResponse.json({ skipped: true });
    }

    const name = companyName || 'there';

    await resend.emails.send({
      from: FROM,
      to: email,
      subject: `Welcome to INAN Feedback, ${name}! 🎉`,
      html: `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8" /></head>
        <body style="margin:0;padding:0;background:#f9fafb;font-family:'Helvetica Neue',Arial,sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 0;">
            <tr>
              <td align="center">
                <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">

                  <!-- Header -->
                  <tr>
                    <td style="background:#7C3AED;padding:32px 40px;text-align:center;">
                      <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.3px;">INAN Feedback</h1>
                    </td>
                  </tr>

                  <!-- Body -->
                  <tr>
                    <td style="padding:40px;">
                      <h2 style="margin:0 0 16px;color:#111827;font-size:20px;font-weight:700;">
                        Welcome aboard, ${name}! 👋
                      </h2>
                      <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6;">
                        Your account is all set. We're glad to have you on INAN Feedback — the platform that helps you collect, manage, and act on feedback from your customers and team.
                      </p>
                      <p style="margin:0 0 32px;color:#374151;font-size:15px;line-height:1.6;">
                        Head over to your dashboard to create your first feedback form, set up your locations, and start gathering insights.
                      </p>

                      <!-- CTA button -->
                      <table cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="border-radius:8px;background:#7C3AED;">
                            <a href="${DASHBOARD_URL}/dashboard"
                               style="display:inline-block;padding:14px 28px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:8px;">
                              Go to Dashboard →
                            </a>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="padding:24px 40px;border-top:1px solid #f3f4f6;text-align:center;">
                      <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.5;">
                        You're receiving this because you registered at INAN Feedback.<br />
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
    });

    // Mark welcome email as sent so it never fires again
    await adminRef.set({ welcomeSent: true }, { merge: true });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Welcome email error:', err);
    return NextResponse.json({ error: 'Failed to send welcome email.' }, { status: 500 });
  }
}
