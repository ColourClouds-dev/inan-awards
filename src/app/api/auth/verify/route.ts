import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { validateVerificationToken } from '../../../../lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { token, uid } = await req.json();

    if (!token || !uid) {
      return NextResponse.json({ error: 'Missing required fields (token, uid).' }, { status: 400 });
    }

    // Check if user is already verified
    const auth = getAuth();
    let userRecord;
    try {
      userRecord = await auth.getUser(uid);
    } catch {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    if (userRecord.emailVerified) {
      return NextResponse.json({ success: true, message: 'Email is already verified.' });
    }

    const validationResult = await validateVerificationToken(uid, token);

    if (!validationResult.success) {
      return NextResponse.json({ error: validationResult.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Verify token error:', err);
    return NextResponse.json({ error: 'Failed to verify email.' }, { status: 500 });
  }
}

// Support a simple status-check GET request (useful if the client just wants to query if verified)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const uid = searchParams.get('uid');

    if (!uid) {
      return NextResponse.json({ error: 'Missing uid.' }, { status: 400 });
    }

    const auth = getAuth();
    const user = await auth.getUser(uid);
    return NextResponse.json({ emailVerified: user.emailVerified });
  } catch {
    return NextResponse.json({ emailVerified: false });
  }
}
