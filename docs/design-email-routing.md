# Email Routing Redesign — Design Document

## Overview

This document describes all changes required to unify email delivery under a
clean routing rule:

> **Custom domains** (`@inan.com.ng` and any non-standard domain) → **Brevo**  
> **Standard domains** (Gmail, Yahoo, Outlook, etc.) → **Firebase** (built-in)

This applies to every email event the system sends:

| Event | Current state | Target state |
|---|---|---|
| Email verification (registration) | ✅ Already split correctly | No change needed |
| Password reset | ❌ Firebase for everyone | Split by domain |
| Staff invitation | ❌ Resend for everyone | Brevo for everyone (no split needed — invites always go to work emails) |
| Email address change | ❌ Not built yet | New feature — Super Admin only, Brevo/Firebase split |

---

## Shared Utility — `src/lib/emailUtils.ts` (NEW)

**Purpose:** Single source of truth for the domain-routing decision. Eliminates
the duplicate `isCustomDomainEmail` / `STANDARD_DOMAINS` logic that currently
lives only in `register/page.tsx`.

```ts
export const STANDARD_DOMAINS = new Set([
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com',
  'icloud.com', 'aol.com', 'proton.me', 'protonmail.com',
  'zoho.com', 'yandex.com', 'mail.com', 'gmx.com',
]);

/** Returns true if the email belongs to a custom/work domain (not a standard consumer domain). */
export function isCustomDomainEmail(email: string): boolean {
  if (!email || !email.includes('@')) return true;
  const domain = email.split('@').pop()?.trim().toLowerCase() ?? '';
  return !STANDARD_DOMAINS.has(domain);
}
```

**Files that import this after the change:**
- `src/app/register/page.tsx` — remove local duplicate, import from here
- `src/app/login/page.tsx` — new import for password reset routing

---

## Change 1 — Password Reset

### Problem
`login/page.tsx` calls `sendPasswordResetEmail(auth, email)` for all users.
Firebase sends from `noreply@[project].firebaseapp.com`, which the `inan.com.ng`
mail server rejects due to DMARC.

### New API Route — `src/app/api/auth/reset-password/route.ts` (NEW)

**Method:** `POST`  
**Body:** `{ email: string }`  
**Auth:** None required (public endpoint — same as Firebase's own reset flow)

**Logic:**
1. Validate `email` is present and well-formed.
2. Call Firebase Admin `auth.generatePasswordResetLink(email)` — this produces
   the real Firebase reset URL without sending any email.
3. Send the link via Brevo using the same pattern as
   `/api/auth/send-verification`.
4. Return `{ success: true }` — or a safe generic message on error (never
   reveal whether the email exists, for security).

**Email template:** Same purple header style as the verification email.
- Subject: `Reset your password — INAN Feedback`
- Body: Brief intro, a "Reset Password" button linking to the Firebase reset URL,
  plain-text fallback link, expiry note ("This link expires in 1 hour").

**Security note:** `generatePasswordResetLink` throws
`auth/user-not-found` if the email isn't registered. The API route must catch
this and return `{ success: true }` anyway — never confirm or deny whether an
account exists.

### Changes to `src/app/login/page.tsx`

In `handlePasswordReset`:

```
BEFORE:
  await sendPasswordResetEmail(auth, resetEmail.trim());

AFTER:
  if (isCustomDomainEmail(resetEmail.trim())) {
    // Custom domain → our API → Brevo
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: resetEmail.trim() }),
    });
    if (!res.ok) throw new Error('Failed to send reset email.');
  } else {
    // Standard domain → Firebase native
    await sendPasswordResetEmail(auth, resetEmail.trim());
  }
```

---

## Change 2 — Staff Invitation (migrate from Resend to Brevo)

### Problem
`/api/invite-staff/route.ts` uses the `resend` npm package. Resend is a
separate third-party service not authenticated for `inan.com.ng`, and it adds
an unnecessary dependency now that Brevo is the designated provider.

### Changes to `src/app/api/invite-staff/route.ts`

1. Remove the `Resend` import and `resend` instance.
2. Replace `resend.emails.send(...)` with a `fetch` call to
   `https://api.brevo.com/v3/smtp/email` using `BREVO_API_KEY` — identical
   pattern to `/api/auth/send-verification/route.ts`.
3. No change to the email HTML template — just swap the sending mechanism.
4. No domain split needed here: invitations always go to work email addresses,
   so Brevo handles all of them.

**Env vars:** `BREVO_API_KEY` and `BREVO_FROM_EMAIL` already exist in
`.env.local`. No new variables needed.

**Dependency removed:** All endpoints importing `resend` (including invite-staff, welcome-email, register-tenant, and notify-negative) have been migrated to Brevo. The `resend` package has been uninstalled.

---

## Change 3 — Email Address Change (NEW FEATURE)

### Scope
Super Admin only. Allows changing a user's email address on behalf of a tenant
user — useful when a staff member's email changes (e.g. company rebrand,
name change).

### User flow (Super Admin perspective)
1. Super Admin expands a tenant's user list in `/super-admin`.
2. Each user row gains a small **edit (pencil) icon** next to the existing
   role selector and delete button.
3. Clicking it opens a compact inline form (or a small modal) with:
   - Current email shown as read-only
   - "New email address" text input
   - Confirm / Cancel buttons
4. On confirm:
   - If the new email is a **custom domain** → update Firebase Auth + send a
     verification email via Brevo to the new address before it becomes active.
   - If the new email is a **standard domain** → update Firebase Auth + send
     Firebase's native verification email.
5. Toast feedback: "Email updated. A verification link has been sent to
   [new email]."

### New API Route — `src/app/api/change-user-email/route.ts` (NEW)

**Method:** `PATCH`  
**Body:** `{ uid: string, newEmail: string }`  
**Auth:** Bearer token — Super Admin only (`decoded.superAdmin === true`)

**Logic:**
1. Verify the caller is a Super Admin.
2. Validate `newEmail` — well-formed, not the same as the current email.
3. Check `newEmail` is not already taken by another Firebase Auth user
   (`auth.getUserByEmail(newEmail)` — if it doesn't throw, the email is taken).
4. Call `auth.updateUser(uid, { email: newEmail, emailVerified: false })` — this
   updates Firebase Auth and marks the email as unverified.
5. Route the verification email:
   - Custom domain → call the existing `/api/auth/send-verification` logic
     (can be extracted into a shared helper or called internally)
   - Standard domain → call Firebase Admin's
     `auth.generateEmailVerificationLink(newEmail)` and send via Firebase's
     default mechanism (or send via Brevo with a verification template — 
     your call, simpler to just use Firebase native for standard domains)
6. Return `{ success: true }`.

**Error handling:**
- `auth/email-already-exists` → return 409 "That email is already in use."
- `auth/invalid-email` → return 400 "Invalid email address."
- Any other error → return 500.

### Changes to `src/app/super-admin/page.tsx`

**New state:**
```ts
const [emailChangeTarget, setEmailChangeTarget] = useState<{
  uid: string;
  currentEmail: string;
  tenantId: string;
} | null>(null);
const [newEmail, setNewEmail] = useState('');
const [emailChanging, setEmailChanging] = useState(false);
```

**New handler `handleChangeEmail`:**
- Calls `PATCH /api/change-user-email` with bearer token
- On success: updates `tenantUsers` state with the new email, clears modal,
  shows success toast
- On error: shows error toast, keeps modal open

**UI — in the user row action buttons:**
Add a pencil icon button between the role selector and the delete button:
```
[ role selector ] [ ✏️ edit email ] [ 🗑 delete ]
```

**UI — email change modal:**
Use the existing `<Modal>` component (already imported):
- Title: "Change Email Address"
- Body:
  - Read-only field showing current email (grey, labelled "Current email")
  - Text input for new email (labelled "New email address")
  - Small helper text: "A verification link will be sent to the new address."
- Footer: Cancel + "Update Email" (with loading state)

---

## Files Changed — Summary

| File | Action |
|---|---|
| `src/lib/emailUtils.ts` | **New** — shared `isCustomDomainEmail` + `STANDARD_DOMAINS` |
| `src/app/api/auth/reset-password/route.ts` | **New** — generates Firebase reset link, sends via Brevo |
| `src/app/api/change-user-email/route.ts` | **New** — Super Admin email change, routes verification by domain |
| `src/app/login/page.tsx` | **Updated** — route reset email by domain |
| `src/app/register/page.tsx` | **Updated** — import `isCustomDomainEmail` from shared utility |
| `src/app/api/invite-staff/route.ts` | **Updated** — replace Resend with Brevo fetch |
| `src/app/super-admin/page.tsx` | **Updated** — add email change UI to user rows |

---

## What Does NOT Change

- `/api/auth/send-verification` — already correct, no changes needed
- `/api/auth/verify` — no changes needed  
- `register/page.tsx` routing logic — already correct, just imports move to shared utility
- Firebase Auth itself — still the source of truth for all auth state
- Firestore rules — no changes needed
- Brevo templates / API key — already configured, already authenticated

---

## Environment Variables (no new ones needed)

All required variables already exist in `.env.local`:

| Variable | Used by |
|---|---|
| `BREVO_API_KEY` | All Brevo sends |
| `BREVO_FROM_EMAIL` | All Brevo sends |
| `BREVO_FROM_NAME` | All Brevo sends |
| `NEXT_PUBLIC_SITE_URL` | Reset link base URL |
