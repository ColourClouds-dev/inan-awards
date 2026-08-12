# Password Change Security Notification — Requirements, Design & Tasks

---

## 1. Requirements

### 1.1 Functional Requirements

**FR-1:** When a user successfully changes their password from the Profile page
(`/dashboard/profile`), a security notification email must be sent to the email
address associated with their account.

**FR-2:** When a user successfully changes their password from the Settings page
(`/dashboard/settings`), the same security notification email must be sent.

**FR-3:** The email must clearly communicate:
- That a password change occurred on their account
- The approximate time it happened
- A direct call-to-action to reset their password immediately if they did not
  initiate the change

**FR-4:** The email must include a "Reset Password" button that links directly
to the login page (`/login`), where the user can trigger a password reset.

**FR-5:** Sending this email must use the same Brevo routing already established
in the system — all domains (both custom and standard) route through Brevo,
since this is a security notification, not an auth action.

**FR-6:** Failure to send the notification email must never block the password
change from succeeding, and must never display an error to the user. The
password change and the email notification are independent operations.

**FR-7:** The notification must not be sent if the password change itself fails.
It is only triggered on confirmed success.

---

### 1.2 Non-Functional Requirements

**NFR-1:** The API endpoint must be protected against abuse — it should require
the caller to be an authenticated Firebase user (bearer token check) so it
cannot be triggered anonymously to spam users.

**NFR-2:** The endpoint must have `export const dynamic = 'force-dynamic'` to
prevent Next.js build-time static analysis failures on Vercel.

**NFR-3:** Email delivery failure must be logged server-side (`console.error`)
for observability without surfacing to the user.

**NFR-4:** The email must match the existing visual style used by
`/api/auth/send-verification` — purple header, white card body, consistent
footer.

---

### 1.3 Out of Scope

- Sending a notification when a Super Admin changes a user's email address
  (that is covered separately in `design-email-routing.md`)
- Locking the account or forcing re-login after a password change
- SMS or push notifications
- Logging the password change event to Firestore

---

## 2. Design

### 2.1 Email Content

**Subject:** `Security Alert — Your password was changed`

**Body:**
```
Your password for your INAN Feedback account was recently changed.

Time: [timestamp of the change, e.g. "15 Jul 2026, 14:32 WAT"]

If you made this change, no further action is needed.

If you did NOT make this change, your account may be compromised.
Please reset your password immediately using the button below.

[ Reset My Password ]  ← links to /login

If you are unable to access your account, contact your administrator.
```

The timestamp is generated server-side at the moment the API is called,
formatted as a human-readable local string.

---

### 2.2 Email Routing

Unlike verification and password reset emails, this notification does not need
a domain split. Brevo handles delivery for all domains:

| Domain type | Sender | Notes |
|---|---|---|
| Custom (`@inan.com.ng` etc.) | Brevo | Already authenticated |
| Standard (Gmail, Yahoo etc.) | Brevo | Security notifications don't use Firebase |

There is no Firebase equivalent for a security notification email, so Brevo is
used universally.

---

### 2.3 New API Route

**Path:** `POST /api/auth/password-changed`

**Authentication:** Bearer token — must be a valid, verified Firebase user.
The token is decoded server-side using Firebase Admin to confirm the caller is
authenticated before sending. This prevents unauthenticated abuse.

**Request body:**
```json
{ "email": "user@example.com" }
```

**Validation:**
- `email` must be present and non-empty
- `BREVO_API_KEY` must be configured
- Bearer token must decode to a valid Firebase UID

**Success response:** `{ "success": true }` — HTTP 200

**Error responses:**
- `401` — missing or invalid token
- `400` — missing email
- `500` — Brevo send failure or misconfiguration (logged, not surfaced to client)

**Behaviour on Brevo failure:** Returns HTTP 500 but the calling client ignores
this response (fire-and-forget pattern — see Section 2.4).

---

### 2.4 Client Integration Pattern

The notification call is **fire-and-forget** on the client side. This means:

```ts
// After await updatePassword(user, newPassword) succeeds:
const token = await user.getIdToken();
fetch('/api/auth/password-changed', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  },
  body: JSON.stringify({ email: user.email }),
}).catch(() => {
  // Silently ignored — email failure must not affect UX
});
// No await — password change success toast shows immediately
```

The `await` on the success toast / UI update happens before the fetch, so the
user sees confirmation of their password change without waiting for the email
to dispatch.

---

### 2.5 Where the Call Is Added

There are two password change handlers in the codebase:

**Location 1 — `src/app/dashboard/profile/page.tsx`**

Function: `handlePasswordSave`

After this line succeeds:
```ts
await updatePassword(user, newPassword);
```
Add the fire-and-forget notification call before clearing the form fields.

**Location 2 — `src/app/dashboard/settings/page.tsx`**

Function: `handleProfileSave`

After this line succeeds:
```ts
await updatePassword(user, newPassword);
```
Add the fire-and-forget notification call before the success toast.

---

### 2.6 Email Template (Visual Structure)

Matches the existing design used in `send-verification/route.ts`:

```
┌─────────────────────────────────┐
│  [Purple header — INAN Feedback]│
├─────────────────────────────────┤
│  Security Alert                 │
│                                 │
│  Your password was changed on   │
│  your INAN Feedback account.    │
│                                 │
│  Time: [timestamp]              │
│                                 │
│  If you did this, no action     │
│  needed. If not, reset your     │
│  password immediately.          │
│                                 │
│  [ Reset My Password ] (button) │
│                                 │
│  Or copy: [login URL]           │
├─────────────────────────────────┤
│  © 2026 Inan Management Ltd     │
└─────────────────────────────────┘
```

---

## 3. Tasks

### Task 1 — Create the API route
**File:** `src/app/api/auth/password-changed/route.ts` (new file)
- [ ] Add `export const dynamic = 'force-dynamic'`
- [ ] Read `BREVO_API_KEY`, `BREVO_FROM_EMAIL`, `BREVO_FROM_NAME` from env
- [ ] Verify bearer token using Firebase Admin `auth.verifyIdToken()`
- [ ] Validate `email` field from request body
- [ ] Build HTML email matching existing template style
- [ ] Include server-generated timestamp in the email body
- [ ] Include "Reset My Password" button linking to `${NEXT_PUBLIC_SITE_URL}/login`
- [ ] Send via Brevo `POST https://api.brevo.com/v3/smtp/email`
- [ ] Return `{ success: true }` on success
- [ ] Log Brevo errors with `console.error`, return 500 on failure
- [ ] Return 401 if token is missing or invalid
- [ ] Return 400 if email is missing

### Task 2 — Update `profile/page.tsx`
**File:** `src/app/dashboard/profile/page.tsx`
- [ ] After `await updatePassword(user, newPassword)` in `handlePasswordSave`,
  add fire-and-forget call to `POST /api/auth/password-changed`
- [ ] Pass bearer token via `user.getIdToken()`
- [ ] Attach `.catch(() => {})` to silence any network failures
- [ ] Confirm the success toast and form field clearing are unaffected

### Task 3 — Update `settings/page.tsx`
**File:** `src/app/dashboard/settings/page.tsx`
- [ ] After `await updatePassword(user, newPassword)` in `handleProfileSave`,
  add fire-and-forget call to `POST /api/auth/password-changed`
- [ ] Pass bearer token via `user.getIdToken()`
- [ ] Attach `.catch(() => {})` to silence any network failures
- [ ] Confirm the success toast and profile saving state are unaffected

### Task 4 — Verification
- [ ] Change password on `/dashboard/profile` — confirm email arrives
- [ ] Change password on `/dashboard/settings` — confirm email arrives
- [ ] Confirm email contains correct timestamp and working Reset button
- [ ] Confirm password change still works if Brevo is temporarily down
  (simulate by temporarily using a bad API key — change should still succeed)
- [ ] Check Vercel function logs confirm no build errors on the new route
- [ ] Check Brevo transactional logs show the send event

---

## 5. First-Login Stale Claims Bug

### 5.1 Problem Description

When a user creates an account and logs in for the first time, the dashboard
renders without their tenant details (name, role, branding) and requires a
manual page refresh to load correctly.

### 5.2 Root Cause

The issue is a **Firebase custom claims propagation delay**. The sequence is:

1. User registers → `/api/add-tenant-user` runs server-side and writes
   `tenantId` and `role` as custom claims on the user's Firebase Auth token
   using the Admin SDK.
2. User verifies email → redirected to `/dashboard`.
3. `TenantContext` mounts and calls `user.getIdTokenResult(true)` — the `true`
   flag forces a token refresh.
4. Despite the forced refresh, Firebase's auth servers have not yet propagated
   the newly written custom claims back to the client. The claims come back
   empty (`claimTenantId === undefined`).
5. `TenantContext` falls through to the domain-based fallback resolver, which
   returns no role, so the dashboard renders with blank tenant data.
6. On manual refresh, enough time has passed for the claims to propagate,
   so `getIdTokenResult(true)` now returns the correct values.

This is a known Firebase limitation — custom claims set server-side via Admin
SDK can take several seconds to appear on the client, even with force-refresh.

### 5.3 Solution

Add a **single retry with a short delay** inside `TenantContext` for the case
where `claimTenantId` comes back empty for an authenticated user.

The logic:
1. Call `getIdTokenResult(true)` as normal.
2. If `claimTenantId` is undefined and the user is authenticated, wait
   **1500ms** then call `getIdTokenResult(true)` a second time.
3. If claims are present on the retry, proceed normally.
4. If still empty after the retry, fall through to the existing domain-based
   fallback as before.

This is contained entirely within `TenantContext` — no changes to any page or
API route are needed.

**Why 1500ms:** Firebase claim propagation typically completes within 1–2
seconds of the Admin SDK write. 1500ms is enough to cover the gap in the vast
majority of cases without noticeably delaying the dashboard load for users
whose claims are already fresh (which is most users on subsequent logins).

**Why only one retry:** The retry only fires when `claimTenantId` is missing
for an authenticated user — a condition that is only true during the
propagation window. After the first login, subsequent visits will always have
valid claims and will never hit the retry path.

### 5.4 Task

**Task 5 — Fix stale claims on first login**

**File:** `src/contexts/TenantContext.tsx`

- [ ] After the first `getIdTokenResult(true)` call, check if `claimTenantId`
  is undefined while `user` is authenticated
- [ ] If so, wait 1500ms using `await new Promise(r => setTimeout(r, 1500))`
- [ ] Call `getIdTokenResult(true)` a second time and re-read
  `claimTenantId` and `claimRole` from the result
- [ ] Proceed with the same existing logic from that point forward
- [ ] Confirm the retry only runs once and does not create an infinite loop
- [ ] Verify on a fresh account that the dashboard loads correctly on first
  login without a manual refresh
- [ ] Verify that returning users (claims already valid) are unaffected and
  see no loading delay

---

## 4. Files Changed — Summary

| File | Action |
|---|---|
| `src/app/api/auth/password-changed/route.ts` | **New** |
| `src/app/dashboard/profile/page.tsx` | **Updated** — fire-and-forget after password change |
| `src/app/dashboard/settings/page.tsx` | **Updated** — fire-and-forget after password change |
| `src/contexts/TenantContext.tsx` | **Updated** — retry logic for stale claims on first login |

No new environment variables required. No Firestore changes. No routing rule
changes. No UI changes beyond the existing success toast.
