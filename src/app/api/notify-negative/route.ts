import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const ADMIN_EMAIL = 'adminaccess@inan.com.ng';

export async function POST(req: NextRequest) {
  try {
    const { formTitle, location, tags, timeSpent, visitorCountry, submittedAt } = await req.json();

    const tagLabels = (tags as { label: string }[]).map(t => t.label).join(', ');

    await resend.emails.send({
      from: 'INAN Feedback <notifications@inan.com.ng>',
      to: ADMIN_EMAIL,
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
