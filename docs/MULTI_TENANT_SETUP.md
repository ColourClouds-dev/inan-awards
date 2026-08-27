# Multi-Tenant SaaS Setup Guide

This document summarises the 14-step multi-tenant overhaul and lists every action you must take before the updated app will run correctly.

---

## What Was Built

The app has been converted from a single-tenant system (Inan only) into a multi-tenant SaaS platform. Multiple companies can now register, each with their own isolated data, feature set, and form limits — all running on one codebase and one Firebase project.

---

## Summary of the 14 Steps

| # | What Changed | Files Affected |
|---|---|---|
| 1 | **Cloudinary image uploads** — replaced Firebase Storage with Cloudinary signed uploads across all image upload fields | `ImageUpload.tsx`, `api/cloudinary/sign`, `api/cloudinary/delete`, `firebase.ts` |
| 2 | **Tenant types** — added `Tenant` and `TenantFeatures` TypeScript interfaces | `types/index.ts` |
| 3 | **Tenant Firestore helpers** — functions to get, save, update tenants and increment form counts | `lib/tenantFirestore.ts` |
| 4 | **Middleware** — reads the `Host` header on every request and injects `x-tenant-id` and `x-tenant-domain` headers | `src/middleware.ts` |
| 5 | **Tenant context** — React context that fetches the current tenant config and makes it available to all components | `contexts/TenantContext.tsx`, `api/tenant/current` |
| 6 | **Scoped Firestore queries** — every read/write now filters by `tenantId` so companies never see each other's data | `lib/firestore.ts`, `lib/nominationsFirestore.ts`, `lib/employeesFirestore.ts` |
| 7 | **Per-tenant settings** — settings moved from `settings/{key}` to `tenant-settings/{tenantId}/config/{key}` | `settings/page.tsx`, `feedback/[formId]/page.tsx`, `layout.tsx`, `firebaseAdmin.ts` |
| 8 | **Removed Inan hardcoding** — email domain, fallback locations, notification emails, and sender address are now all configurable per tenant | `NominationsVotingForm.tsx`, `FeedbackFormBuilder.tsx`, `notify-negative/route.ts` |
| 9 | **Feature flags** — dashboard sections (Nominations, Employee Records, SEO) are shown/hidden based on the tenant's plan | `DashboardLayout.tsx`, `settings/page.tsx`, `polls/page.tsx` |
| 10 | **Form limit gate** — admins see a warning and cannot create new forms once they hit their plan's limit | `FeedbackFormBuilder.tsx`, `NominationsFormBuilder.tsx` |
| 11 | **Super admin panel** — protected page at `/super-admin` to register tenants, toggle status, and adjust limits | `app/super-admin/page.tsx`, `scripts/set-super-admin.js` |
| 12 | **Self-registration** — companies can sign up at `/register` and get a trial account automatically | `app/register/page.tsx` |
| 13 | **"Powered by Inan Management Ltd" badge** — shown on all public-facing pages, hidden for tenants on plans with `hidePoweredBy: true` | `FeedbackForm.tsx`, `NominationsVotingForm.tsx`, `register/page.tsx` |
| 14 | **Inan data migration script** — adds `tenantId: "inan"` to all existing Firestore documents and migrates settings to the new per-tenant path | `scripts/migrate-to-tenant.js` |

---

## Immediate Actions Required

Complete these steps **in order** before running the app.

---

### Step A — Install Cloudinary

```bash
npm install cloudinary
```

---

### Step B — Add environment variables to `.env.local`

Open `.env.local` and add the following. Get your Cloudinary credentials from [cloudinary.com/console](https://cloudinary.com/console).

```env
# Cloudinary — image uploads
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

Your existing Firebase and Resend variables stay as they are.

---

### Step C — Add Firebase Admin credentials (if not already set)

The migration script and server-side API routes require these. Get them from Firebase Console → Project Settings → Service Accounts → Generate new private key.

```env
FIREBASE_ADMIN_PROJECT_ID=your-project-id
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_KEY_HERE\n-----END PRIVATE KEY-----\n"
```

---

### Step D — Install dotenv and run the data migration script

The migration script needs `dotenv` to read your `.env.local` credentials. Install it first:

```bash
npm install --save-dev dotenv
```

Then run the migration. This script does three things:
1. Creates the `tenants/inan` document in Firestore with Inan's full config
2. Adds `tenantId: "inan"` to every existing document in all collections
3. Copies `settings/locations`, `settings/notifications`, `settings/seo` → `tenant-settings/inan/config/...`

```bash
node scripts/migrate-to-tenant.js
```

> **Run this only once.** It is safe to re-run (it skips documents that already have `tenantId` set), but there is no need to run it more than once.

---

### Step E — Set yourself as super admin

Replace the email below with your actual admin account email.

```bash
node scripts/set-super-admin.js admin@inan.com.ng
```

After running this, **sign out and sign back in** to your dashboard so Firebase Auth picks up the new custom claim. You will then be able to access `/super-admin`.

---

### Step F — Deploy updated Firestore security rules

The rules have been updated in `firestore.rules` to enforce tenant isolation. Every collection now checks that the authenticated user belongs to the same tenant as the document they are trying to access.

Deploy them:

```bash
firebase deploy --only firestore:rules
```

> If you don't have the Firebase CLI installed: `npm install -g firebase-tools` then `firebase login`.

---

### Step G — Add your domain to Vercel

For Inan's live deployment, add `feedback.inan.com.ng` (or whatever domain you want Inan to use) as a custom domain in your Vercel project settings. The middleware uses the `Host` header to identify the tenant, so the domain must match what is stored in `tenants/inan.domain`.

---

### Step H — Verify the app runs

```bash
npm run dev
```

Check the following:
- [ ] Dashboard loads at `localhost:3000` and shows Inan's data
- [ ] `/super-admin` is accessible after signing in with your super admin account
- [ ] `/register` loads and allows a test company to sign up
- [ ] Image upload works (requires Cloudinary credentials to be set)
- [ ] Nominations and feedback forms still work as before

---

## How to Onboard a New Company

1. They visit `/register` and fill in their company name, email, password, and domain
2. A trial account is created automatically (5 form limit, basic features)
3. You log in to `/super-admin`, find their tenant, and:
   - Set their domain (must match what they point their DNS to)
   - Activate their account (change status from `trial` to `active`)
   - Set their plan and form limits
   - Toggle features on (Nominations, Employee Records, SEO Settings, etc.)
4. They point their DNS to your Vercel deployment
5. You add their domain in Vercel's custom domains panel

---

## Cloudinary Folder Structure

Images are organised per tenant:

```
{tenantId}/banners/          ← nominations form banners
{tenantId}/og-images/        ← SEO OG images
{tenantId}/forms/og-images/  ← per-form OG images
{tenantId}/seo/              ← global site OG image
```

---

## Scripts Reference

| Script | Purpose | Usage |
|---|---|---|
| `scripts/migrate-to-tenant.js` | One-time migration of existing data to multi-tenant structure | `node scripts/migrate-to-tenant.js` |
| `scripts/set-super-admin.js` | Grant super admin access to a Firebase Auth user | `node scripts/set-super-admin.js email@domain.com` |
