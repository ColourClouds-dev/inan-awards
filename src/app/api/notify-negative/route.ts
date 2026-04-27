import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { getAdminDb } from '../../../lib/firebaseAdmin';

const resend = new Resend(process.env.RESEND_API_KEY);

const FALLBACK_EMAIL = 'adminaccess@inan.com.ng';

async function getNotificationEmails(tenantId: string): Promise<string[]> {
  try {
    const snap = await getAdminDb().doc(`tenant-settings/${tenantId}/config/notifications`).get();
    if (snap.exists) {
      const emails = (snap.data() as { emails?: string[] }).emails;
      if (Array.isArray(emails) && emails.length > 0) return emails;
    }
  } catch (err) {
    console.error('Failed to fetch notification emails from Firestore:', err);
  }
  return [FALLBACK_EMAIL];
}

export async function POST(req: NextRequest) {
  try {
    const tenantId = req.headers.get('x-tenant-id') || 'inan';
    const { formTitle, location, tags, timeSpent, visitorCountry, submittedAt } = await req.json();
    const recipients = await getNotificationEmails(tenantId);
    const tagLabels = (tags as { label: string }[]).map(t => t.label).join(', ');

    await resend.emails.send({
      from: 'INAN Feedback <notifications@inan.com.ng>',
      to: recipients,
      subject: `⚠️ Negative Feedback Alert — ${formTitle}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #dc2626;">Negative Feedback Alert</h2>
          <p>A response flagged as <strong>Negative</strong> was submitted on your feedback form.</p>
          <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
            <tr style="background: #f9fafb;">
              <td style="padding: 8px 12px; font-weight: bold; border: 1px solid #e5e7eb;">Form</td>
              <td style="padding: 8px 12px; border: 1px solid #e5e7eb;">${formTitle}</td>
            </tr>
            <tr>
              <td style="padding: 8px 12px; font-weight: bold; border: 1px solid #e5e7eb;">Location</td>
              <td style="padding: 8px 12px; border: 1px solid #e5e7eb;">${location}</td>
            </tr>
            <tr style="background: #f9fafb;">
              <td style="padding: 8px 12px; font-weight: bold; border: 1px solid #e5e7eb;">Tags</td>
              <td style="padding: 8px 12px; border: 1px solid #e5e7eb;">${tagLabels}</td>
            </tr>
            <tr>
              <td style="padding: 8px 12px; font-weight: bold; border: 1px solid #e5e7eb;">Time Spent</td>
              <td style="padding: 8px 12px; border: 1px solid #e5e7eb;">${timeSpent}</td>
            </tr>
            <tr style="background: #f9fafb;">
              <td style="padding: 8px 12px; font-weight: bold; border: 1px solid #e5e7eb;">Visitor Country</td>
              <td style="padding: 8px 12px; border: 1px solid #e5e7eb;">${visitorCountry ?? '—'}</td>
            </tr>
            <tr>
              <td style="padding: 8px 12px; font-weight: bold; border: 1px solid #e5e7eb;">Submitted At</td>
              <td style="padding: 8px 12px; border: 1px solid #e5e7eb;">${new Date(submittedAt).toLocaleString()}</td>
            </tr>
          </table>
          <p style="margin-top: 24px; color: #6b7280; font-size: 14px;">
            Log in to your dashboard to review this response in detail.
          </p>
        </div>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Email notification error:', err);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
