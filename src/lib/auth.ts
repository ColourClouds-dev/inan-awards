import { getAdminDb } from './firebaseAdmin';
import { getAuth } from 'firebase-admin/auth';
import { v4 as uuidv4 } from 'uuid';

export interface VerificationToken {
  token: string;
  email: string;
  createdAt: any;
  expiresAt: any;
  used: boolean;
}

const TOKEN_EXPIRY_HOURS = 12;
const RATE_LIMIT_COOLDOWN_MS = 60 * 1000; // 60 seconds

/**
 * Generates and stores a secure verification token for a user.
 * Ensures that the rate limit (60s) is respected.
 */
export async function createVerificationToken(userId: string, email: string): Promise<string> {
  const db = getAdminDb();
  const tokenCollectionRef = db.collection(`users/${userId}/verification_tokens`);

  // Check rate limit: find any token created in the last 60 seconds
  const recentTokensSnap = await tokenCollectionRef
    .orderBy('createdAt', 'desc')
    .limit(1)
    .get();

  if (!recentTokensSnap.empty) {
    const lastToken = recentTokensSnap.docs[0].data();
    // Support either firestore Timestamp or JavaScript Date
    const lastCreatedAt = typeof lastToken.createdAt.toDate === 'function' 
      ? lastToken.createdAt.toDate().getTime() 
      : new Date(lastToken.createdAt).getTime();
    
    const now = Date.now();
    if (now - lastCreatedAt < RATE_LIMIT_COOLDOWN_MS) {
      const waitSeconds = Math.ceil((RATE_LIMIT_COOLDOWN_MS - (now - lastCreatedAt)) / 1000);
      throw new Error(`Please wait ${waitSeconds}s before requesting another verification email.`);
    }
  }

  const token = uuidv4();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

  const verificationDoc: VerificationToken = {
    token,
    email,
    createdAt: now,
    expiresAt,
    used: false,
  };

  await tokenCollectionRef.doc(token).set(verificationDoc);
  return token;
}

/**
 * Validates a verification token for a user.
 * If valid, updates Firebase Auth record to emailVerified = true.
 */
export async function validateVerificationToken(userId: string, token: string): Promise<{ success: boolean; error?: string }> {
  const db = getAdminDb();
  const tokenDocRef = db.doc(`users/${userId}/verification_tokens/${token}`);
  const snap = await tokenDocRef.get();

  if (!snap.exists) {
    return { success: false, error: 'Invalid verification token.' };
  }

  const tokenData = snap.data() as VerificationToken;

  if (tokenData.used) {
    return { success: false, error: 'This token has already been used.' };
  }

  const expiresTime = typeof tokenData.expiresAt.toDate === 'function' 
    ? tokenData.expiresAt.toDate().getTime() 
    : new Date(tokenData.expiresAt).getTime();

  if (Date.now() > expiresTime) {
    return { success: false, error: 'This token has expired.' };
  }

  // Mark token as used
  await tokenDocRef.update({ used: true });

  // Update Firebase Auth user
  const auth = getAuth();
  await auth.updateUser(userId, { emailVerified: true });

  return { success: true };
}

const STANDARD_DOMAINS = new Set([
  'gmail.com',
  'yahoo.com',
  'hotmail.com',
  'outlook.com',
  'icloud.com',
  'aol.com',
  'proton.me',
  'protonmail.com',
  'zoho.com',
  'yandex.com',
  'mail.com',
  'gmx.com'
]);

export function isCustomDomainEmail(email: string): boolean {
  if (!email || !email.includes('@')) return true;
  const domain = email.split('@').pop()?.trim().toLowerCase() ?? '';
  return !STANDARD_DOMAINS.has(domain);
}
