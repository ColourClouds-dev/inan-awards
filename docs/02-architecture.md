# 02 — Architecture

**Part of:** [INAN Feedback Technical Manual](./TECHNICAL_MANUAL.md)

---

## Table of Contents

1. [Business Overview](#1-business-overview)
2. [System Diagram](#2-system-diagram)
3. [Request Lifecycle](#3-request-lifecycle)
4. [Multi-Tenancy Model](#4-multi-tenancy-model)
5. [Branding System](#5-branding-system)
6. [Super Admin Impersonation](#6-super-admin-impersonation)

---

## 1. Business Overview

### How the platform is structured

INAN Feedback is split into three layers that work together:

**The browser** — everything users see and interact with. The form a guest fills in, the dashboard an admin uses, the charts, the settings page — all of this runs in the user's browser.

**The server** — a set of background endpoints that handle sensitive tasks the browser is not trusted to do on its own. This includes things like verifying bot-detection tokens, signing image uploads, sending emails, and managing user accounts.

**Firebase** — Google's cloud platform that stores all the data and manages user identities. When a user logs in, Firebase confirms who they are. When a form is submitted, Firebase stores the response. The application reads and writes to Firebase constantly.

### How multiple organisations are kept separate

Each organisation on the platform is called a "tenant". Every piece of data — every form, every response, every setting — is labelled with the organisation it belongs to. The platform's security rules ensure that an admin from Organisation A can never see Organisation B's data, even accidentally. This isolation happens at two levels: in the application code (every database query filters by organisation) and in the database security rules (Firebase enforces the same filter at the storage level).

---

## 2. System Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                       BROWSER (Client)                        │
│                                                               │
│  React Components  ←→  Firebase Client SDK (Auth/Firestore)  │
│                    ←→  Cloudinary Direct Upload               │
│                    ←→  Google reCAPTCHA v3                    │
│                    ←→  ipapi.co (visitor geo lookup)          │
└────────────────────────────┬─────────────────────────────────┘
                             │  HTTP / Next.js API Routes
┌────────────────────────────▼─────────────────────────────────┐
│                      NEXT.JS SERVER                           │
│                                                               │
│  Middleware (tenant resolution, header injection)             │
│  API Routes  ←→  Firebase Admin SDK                          │
│              ←→  Cloudinary Server SDK                        │
│              ←→  Resend Email API                             │
└────────────────────────────┬─────────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────────┐
│                     FIREBASE PLATFORM                         │
│                                                               │
│  Firebase Auth   ←→  Custom Claims (tenantId, superAdmin)    │
│  Cloud Firestore ←→  Security Rules (tenant-scoped access)   │
└──────────────────────────────────────────────────────────────┘
```

---

## 3. Request Lifecycle

> **For developers.** This section traces the exact path a request takes from browser to data and back.

### 3.1 Dashboard page load

```
User visits /dashboard
      │
      ▼
Next.js Middleware (src/middleware.ts)
  → Reads the host header from the incoming request
  → Strips any www. prefix
  → Checks the DOMAIN_TO_TENANT static map
      Mapped domains: feedback.inan.com.ng → 'inan'
                      inan.inanfeedback.com  → 'inan'
  → If a super admin impersonation cookie is present, it overrides the map
  → Falls back to 'inan' for localhost (TenantContext handles per-user resolution)
  → Injects three headers on every request:
      x-tenant-id       — resolved tenant slug
      x-tenant-domain   — incoming domain (stripped of www)
      x-impersonating   — 'true' / 'false'
      │
      ▼
AuthGuard (client component)
  → Subscribes to Firebase onAuthStateChanged
  → No user present → redirect to /login
  → User present, emailVerified === false
      → auth.signOut()
      → Show "Verify your email first" screen with link back to /login
  → User present and verified → render dashboard children
      │
      ▼
TenantContext (client component, mounted in root layout)
  → Calls GET /api/tenant/current to check for active impersonation
  → If impersonating → use impersonated tenant, mark isImpersonating = true
  → If not impersonating:
      → Wait for onAuthStateChanged to fire
      → Call user.getIdTokenResult() to read token claims
      → If claims.tenantId exists → load tenants/{tenantId} from Firestore
      → If no claim → fall back to GET /api/tenant/current (domain-based)
      │
      ▼
BrandProvider (client component, mounted in root layout)
  → Reads tenant.branding.primaryColor from TenantContext
  → If valid 6-digit hex → sets CSS custom property --brand on <html>
  → Defaults to #7C3AED (Inan purple) if no branding is configured
  → All .btn-brand, .text-brand, .border-brand utility classes pick this up
      │
      ▼
DashboardLayout → Page Component
  → Fetches Firestore data scoped to tenantId
  → Renders UI with tenant branding applied
```

### 3.2 Public feedback form load

```
Guest visits /feedback/[formId]
      │
      ▼
Middleware → injects x-tenant-id header (same as above)
      │
      ▼
FeedbackPageClient (client component)
  → GET /api/tenant/current → applies tenant branding to the page
  → getFormById(formId) from Firestore
      → Form not found → show error state
      → Form inactive (isActive === false) → show "no longer active" state
      → Form active → continue
  → Visitor geo lookup via ipapi.co (fire-and-forget, non-blocking)
  → Duplicate check:
      1. localStorage.getItem('submitted_{formId}') — instant, no network call
      2. If no localStorage flag → Firestore hasIpSubmittedForm() check
      → Duplicate found → show "already submitted" screen
  → Render form
```

### 3.3 Form submission

```
Guest clicks Submit
      │
      ▼
  → isOnline check — abort with error message if offline
  → executeRecaptcha('feedback_submit') → POST /api/verify-recaptcha
      → Score below threshold → reject
  → Compute timeSpentSeconds (page load timestamp to now)
  → computeAllTags(responses, form, timeSpentSeconds)
      → time tag, sentiment tag, completion tag, custom tag rules
  → submitFeedback() → write to feedback-responses/{uuid} in Firestore
  → If response has Negative sentiment tag OR any custom tag:
      → POST /api/notify-negative (fire-and-forget, non-blocking)
  → localStorage.setItem('submitted_{formId}', '1')
  → Show animated "Thank You" screen
```

---

## 4. Multi-Tenancy Model

> **For developers.** This section explains the full tenant resolution chain and data isolation strategy.

### 4.1 Tenant resolution chain

Every request goes through this resolution priority:

```
1. Impersonation cookie (sa-impersonate) — set by super admin, overrides everything
2. DOMAIN_TO_TENANT static map in middleware.ts — production domain mapping
3. Firebase token claim (claims.tenantId) — used by TenantContext for logged-in users
4. GET /api/tenant/current — domain-based fallback for public pages and unauthenticated users
5. Default 'inan' — last resort fallback
```

### 4.2 Tenant data isolation

Data isolation is enforced at two independent levels:

**Application layer** — every Firestore query in `src/lib/firestore.ts`, `tenantFirestore.ts`, and `employeesFirestore.ts` includes `where('tenantId', '==', tenantId)`. No query fetches cross-tenant data.

**Database layer** — Firestore security rules in `firestore.rules` enforce the same constraint server-side. A user whose token claim is `tenantId: 'acme'` cannot read a document where `tenantId == 'inan'`, even if they construct a direct document path. This means even a compromised client cannot read another tenant's data.

### 4.3 The `tenantId` field

Every document in every collection carries a `tenantId` field. This is the organisation's slug (e.g. `"inan"`). It is:
- Set at creation time and never updated
- Used in every read query as a filter
- Enforced by Firestore rules on every write and read

### 4.4 Localhost development

`localhost` is intentionally excluded from the `DOMAIN_TO_TENANT` static map. On localhost, `TenantContext` resolves the tenant from the logged-in user's Firebase token claim. This allows multiple tenants to be tested locally with different user accounts without conflicting domain mappings.

---

## 5. Branding System

> **For developers.**

Each organisation can configure a brand colour and logo. The `BrandProvider` component reads `tenant.branding.primaryColor` from `TenantContext` and injects it as the CSS custom property `--brand` on the `<html>` element. The value must be a valid 6-digit hex colour (e.g. `#E53E3E`). If no valid colour is configured, it defaults to `#7C3AED`.

All buttons, highlights, and interactive elements that should reflect the tenant's brand use Tailwind utility classes that reference `--brand`:
- `.btn-brand` — filled button
- `.text-brand` — text colour
- `.border-brand` — border colour

This means a single Firestore field change updates the entire app's colour scheme in real time on next page load.

The root `layout.tsx` also uses tenant branding data to generate per-tenant SEO metadata server-side — including the `<title>` tag template, Open Graph image, meta description, and favicon (set to the tenant's logo URL if available).

---

## 6. Super Admin Impersonation

> **For developers.**

Super admins can view any tenant's dashboard as if they were logged in as that tenant. This is used for troubleshooting and support without needing the tenant's credentials.

**Starting impersonation:**
```
Super admin clicks "View as tenant" on /super-admin
  → GET user.getIdToken() from Firebase Auth
  → POST /api/impersonate { tenantId } with Bearer token header
      → Server validates token, confirms superAdmin claim
      → Sets HttpOnly cookie: sa-impersonate={tenantId}
  → window.location.href = '/dashboard' (hard reload)
  → Middleware reads cookie → overrides x-tenant-id with impersonated tenantId
  → TenantContext detects isImpersonating = true
  → Yellow "Impersonating {name}" banner displayed across the dashboard
```

**Ending impersonation:**
```
Super admin clicks "Stop Impersonating"
  → DELETE /api/impersonate
      → Clears sa-impersonate cookie
  → Hard reload → returns to super admin's own session
```

The impersonation cookie is HttpOnly and cannot be read or set by client-side JavaScript.
