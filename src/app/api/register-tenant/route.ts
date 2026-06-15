import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { getAdminDb } from '../../../lib/firebaseAdmin';
import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import type { Tenant, TenantFeatures } from '../../../types';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = 'INAN Feedback <noreply@inan.com.ng>';
const LOGIN_URL = `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://inan.com.ng'}/login`;

const DEFAULT_FEATURES: TenantFeatures = {
  feedbackForms: true,
  seoSettings: false,
  hidePoweredBy: false,
};

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
    const { uid, tenantId, companyName, domain, email } = await req.json();

    if (!uid || !tenantId || !companyName || !email) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
    }

    const db = getAdminDb();

    // Check if tenantId already exists
    const existing = await db.doc(`tenants/${tenantId}`).get();
    if (existing.exists) {
      return NextResponse.json(
        { error: `A company with the name "${companyName}" is already registered. Please choose a different name.` },
        { status: 409 }
      );
    }

    const tenant: Tenant = {
      id: tenantId,
      name: companyName,
      domain: domain || `${tenantId}.inanfeedback.com`,
      plan: 'trial',
      status: 'trial',
      formLimit: 5,
      formCount: 0,
      features: { ...DEFAULT_FEATURES },
      createdAt: new Date(),
    };

    // Batch write: tenant doc + tenant-admins mapping
    const batch = db.batch();
    batch.set(db.doc(`tenants/${tenantId}`), JSON.parse(JSON.stringify(tenant)));
    batch.set(db.doc(`tenant-admins/${uid}`), {
      tenantId,
      email,
      createdAt: new Date(),
    });
    await batch.commit();

    // Set tenantId as a custom claim on the Firebase Auth user.
    await getAdminAuth().setCustomUserClaims(uid, { tenantId });

    // Send confirmation email (fire-and-forget — don't block registration on email failure)
    resend.emails.send({
      from: FROM,
      to: email,
      subject: `Confirm your email — ${companyName}`,
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
                        Your account for ${companyName} has been created
                      </h2>
                      <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6;">
                        Thanks for registering. Before you can sign in, you need to verify your email address.
                      </p>
                      <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6;">
                        Check your inbox for a separate verification email from Firebase and click the link inside. Once verified, you can sign in at:
                      </p>

                      <!-- Login URL -->
                      <table cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                        <tr>
                          <td style="border-radius:8px;background:#f3f4f6;padding:12px 20px;">
                            <a href="${LOGIN_URL}" style="color:#7C3AED;font-size:14px;font-weight:600;text-decoration:none;">${LOGIN_URL}</a>
                          </td>
                        </tr>
                      </table>

                      <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.5;">
                        If you didn't create this account, you can safely ignore this email.
                      </p>
                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="padding:24px 40px;border-top:1px solid #f3f4f6;text-align:center;">
                      <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.5;">
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
    }).catch(err => console.error('Confirmation email error:', err));

    return NextResponse.json({ success: true, tenantId });
  } catch (err) {
    console.error('Register tenant error:', err);
    return NextResponse.json({ error: 'Failed to create account. Please try again.' }, { status: 500 });
  }
}
