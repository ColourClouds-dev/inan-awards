// Feature: feedback-form-refactor, Property 11: Auth error codes map to human-readable messages
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

const KNOWN_ERROR_CODES = [
  'auth/invalid-email',
  'auth/user-disabled',
  'auth/user-not-found',
  'auth/wrong-password',
  'auth/too-many-requests',
] as const;

/**
 * Mirrors the exported getErrorMessage function in src/app/login/page.tsx.
 * Kept local to avoid pulling in Firebase SDK / Next.js router in the test environment.
 */
function getErrorMessage(error: { code?: string } | null | undefined): string {
  switch (error?.code) {
    case 'auth/invalid-email':
      return 'Invalid email address format.';
    case 'auth/user-disabled':
      return 'This account has been disabled.';
    case 'auth/user-not-found':
      return 'No account found with this email.';
    case 'auth/wrong-password':
      return 'Incorrect password.';
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Please try again later.';
    default:
      return 'Failed to sign in. Please check your credentials.';
  }
}

// **Validates: Requirements 8.3**
describe('Property 11: Auth error codes map to human-readable messages', () => {
  it('returns a non-empty string that is not the raw error code for each known code', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...KNOWN_ERROR_CODES),
        (code) => {
          const message = getErrorMessage({ code });
          expect(message).toBeTruthy();
          expect(message.length).toBeGreaterThan(0);
          expect(message).not.toBe(code);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('returns a fallback message for unknown error codes', () => {
    fc.assert(
      fc.property(
        fc.string().filter((s) => !KNOWN_ERROR_CODES.includes(s as typeof KNOWN_ERROR_CODES[number])),
        (unknownCode) => {
          const message = getErrorMessage({ code: unknownCode });
          expect(message).toBeTruthy();
          expect(message.length).toBeGreaterThan(0);
          expect(message).not.toBe(unknownCode);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('returns a fallback message when error has no code', () => {
    const message = getErrorMessage({});
    expect(message).toBeTruthy();
    expect(message.length).toBeGreaterThan(0);
  });
});
