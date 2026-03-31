// Feature: feedback-form-refactor, Property 12: Missing Firebase env var throws descriptive error
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

const FIREBASE_ENV_VARS = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'NEXT_PUBLIC_FIREBASE_APP_ID',
] as const;

type FirebaseEnvVar = typeof FIREBASE_ENV_VARS[number];

/**
 * Mirrors the validation logic in src/lib/firebase.ts.
 * Iterates over all six required env var names and throws a descriptive
 * error if any one of them is absent from the provided env record.
 */
function validateFirebaseConfig(env: Record<string, string | undefined>): void {
  for (const varName of FIREBASE_ENV_VARS) {
    if (!env[varName]) {
      throw new Error('Missing Firebase config: ' + varName);
    }
  }
}

/** A complete, valid env record with all six vars present. */
const FULL_ENV: Record<FirebaseEnvVar, string> = {
  NEXT_PUBLIC_FIREBASE_API_KEY: 'test-api-key',
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'test.firebaseapp.com',
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'test-project',
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: 'test.appspot.com',
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: '123456789',
  NEXT_PUBLIC_FIREBASE_APP_ID: '1:123:web:abc',
};

// **Validates: Requirements 7.3**
describe('Property 12: Missing Firebase env var throws descriptive error', () => {
  it('throws an error containing the missing variable name for each of the six vars', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...FIREBASE_ENV_VARS),
        (missingVar) => {
          const env: Record<string, string | undefined> = { ...FULL_ENV };
          delete env[missingVar];

          expect(() => validateFirebaseConfig(env)).toThrow(missingVar);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('does not throw when all six vars are present', () => {
    expect(() => validateFirebaseConfig({ ...FULL_ENV })).not.toThrow();
  });
});
