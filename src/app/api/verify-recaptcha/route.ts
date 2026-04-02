import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();

    if (!token) {
      return NextResponse.json({ success: false, error: 'No token provided' }, { status: 400 });
    }

    const secretKey = process.env.RECAPTCHA_SECRET_KEY;
    if (!secretKey) {
      return NextResponse.json({ success: false, error: 'reCAPTCHA not configured' }, { status: 500 });
    }

    const verifyRes = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `secret=${secretKey}&response=${token}`,
    });

    const data = await verifyRes.json();

    // Require a score of 0.5 or above (0 = bot, 1 = human)
    if (!data.success || data.score < 0.5) {
      return NextResponse.json(
        { success: false, error: 'Bot detected. Submission blocked.', score: data.score },
        { status: 403 }
      );
    }

    return NextResponse.json({ success: true, score: data.score });
  } catch (err) {
    return NextResponse.json({ success: false, error: 'Verification failed' }, { status: 500 });
  }
}
