# 05 — Setup & Configuration

**Part of:** [INAN Feedback Technical Manual](./TECHNICAL_MANUAL.md)

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Local Development Setup](#2-local-development-setup)
3. [Environment Variables](#3-environment-variables)
4. [Firebase Project Setup](#4-firebase-project-setup)
5. [Cloudinary Setup](#5-cloudinary-setup)
6. [Brevo Setup](#6-brevo-setup)
7. [Deploying to Vercel](#7-deploying-to-vercel)
8. [Tenant Onboarding](#8-tenant-onboarding)
9. [Admin Scripts Reference](#9-admin-scripts-reference)

---

## 1. Prerequisites

Before setting up the project, make sure the following are installed on your machine:

- **Node.js** 22.x or later — [nodejs.org](https://nodejs.org)
- **npm** — included with Node.js
- **Git**

You will also need accounts on:
- [Firebase](https://console.firebase.google.com) (Google account required)
- [Cloudinary](https://cloudinary.com)
- [Brevo](https://brevo.com)
- [Google reCAPTCHA](https://www.google.com/recaptcha/admin) (for bot protection)
- [Vercel](https://vercel.com) (for deployment)

---

## 2. Local Development Setup

```bash
# 1. Clone the repository
git clone <repository-url>
cd inan-awards

# 2. Install dependencies
npm install

# 3. Create your local environment file
cp env.local.example .env.local

# 4. Fill in the values in .env.local (see § Environment Variables below)

# 5. Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

> **Dev database requirement.** The app's fallback tenant ID is `"inan"`. On localhost, this means a document with ID `inan` must exist in the `tenants` Firestore collection of your dev project. If it doesn't exist, account creation will return a `"Tenant not found."` error. Create the document manually in the Firebase Console (Firestore → tenants → Add document, ID: `inan`) with at minimum: `name`, `domain`, `plan`, `status`, `formLimit`, and `formCount` fields. This is a dev-only requirement — production resolves tenants by domain.

**Other available commands:**

```bash
npm run build        # Build for production
npm run start        # Start production build locally
npm run lint         # Run ESLint
npm run test         # Run tests (Vitest)
npm run test -- --run  # Run tests once without watch mode
```

---

## 3. Environment Variables

All environment variables must be set in `.env.local` for local development. In production, they are configured in the Vercel project dashboard. See `env.local.example` in the project root for the full template.

### Client-side variables (`NEXT_PUBLIC_*`)

These are bundled into the browser JavaScript. Do not put secrets here.

| Variable | Description | Where to find it |
|---|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase project API key | Firebase Console → Project Settings → General |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase auth domain | Firebase Console → Project Settings → General |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase project ID | Firebase Console → Project Settings → General |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Firebase storage bucket | Firebase Console → Project Settings → General |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging sender ID | Firebase Console → Project Settings → General |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase app ID | Firebase Console → Project Settings → General |
| `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` | Google reCAPTCHA v3 site key | Google reCAPTCHA Admin Console |
| `NEXT_PUBLIC_SITE_URL` | Canonical site URL (e.g. `https://feedback.inan.com.ng`) | Your deployment URL |

### Server-side variables (secrets)

These are never sent to the browser. Keep them out of version control.

| Variable | Description | Where to find it |
|---|---|---|
| `FIREBASE_ADMIN_PROJECT_ID` | Firebase project ID (same as public) | Firebase Console → Project Settings → General |
| `FIREBASE_ADMIN_CLIENT_EMAIL` | Service account email | Firebase Console → Project Settings → Service Accounts → Generate new key |
| `FIREBASE_ADMIN_PRIVATE_KEY` | Service account private key | Same JSON file as above — use the `private_key` field, keep `\n` escape sequences |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name | Cloudinary Dashboard → Settings |
| `CLOUDINARY_API_KEY` | Cloudinary API key | Cloudinary Dashboard → Settings → Access Keys |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret | Cloudinary Dashboard → Settings → Access Keys |
| `BREVO_API_KEY` | Brevo SMTP API key | Brevo Dashboard → SMTP & API |
| `BREVO_FROM_EMAIL` | Verified sender email address | Brevo Dashboard → Senders |
| `BREVO_FROM_NAME` | Sender display name | Custom name (e.g. "INAN Feedback") |
| `RECAPTCHA_SECRET_KEY` | Google reCAPTCHA v3 secret key | Google reCAPTCHA Admin Console |

> **Important:** The `FIREBASE_ADMIN_PRIVATE_KEY` value must be wrapped in double quotes in `.env.local` because it contains newline characters. Example:
> ```
> FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n"
> ```

---

## 4. Firebase Project Setup

### 4.1 Create the project

1. Go to [Firebase Console](https://console.firebase.google.com) and create a new project
2. Enable Google Analytics if desired (not required)

### 4.2 Enable Authentication

1. In the Firebase Console, go to **Authentication → Sign-in method**
2. Enable **Email/Password**

### 4.3 Set up email verification domain (recommended)

To reduce spam classification of verification emails:
1. Go to **Authentication → Templates**
2. Click the pencil icon on "Email address verification"
3. Customise the sender domain to `inan.com.ng` (requires DNS configuration)

### 4.4 Create Firestore database

1. Go to **Firestore Database** and click "Create database"
2. Choose **Production mode** (the app's own security rules will control access)
3. Select a region close to your users (e.g. `europe-west1` or `us-central1`)

### 4.5 Deploy Firestore security rules and indexes

From the project root, with the [Firebase CLI](https://firebase.google.com/docs/cli) installed:

```bash
npm install -g firebase-tools
firebase login
firebase use --add   # select your project

firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
```

> **Important — indexes must be deployed.** Several features depend on composite Firestore indexes defined in `firestore.indexes.json`. If indexes are not deployed, the following queries will silently return empty results or throw an error in production:
>
> | Index | Used by |
> |---|---|
> | `feedback-forms (tenantId ASC, slug ASC)` | `isSlugTaken()` — slug uniqueness check in form builder |
> | `feedback-forms (tenantId ASC, slug ASC, isActive ASC)` | Reserved for future server-side slug queries |
> | `feedback-forms (tenantId ASC, createdBy ASC)` | `getAllForms()` with `createdBy` filter — **Staff role forms page** |
> | `polls (tenantId ASC, createdAt DESC)` | `getAllPolls()` — polls list page |
> | `polls (tenantId ASC, createdBy ASC, createdAt DESC)` | `getAllPolls()` with staff filter — polls scoped to creator |
> | `poll-responses (tenantId ASC, pollId ASC, submittedAt DESC)` | Poll response queries |
>
> Run `firebase deploy --only firestore:indexes` after every change to `firestore.indexes.json`.

### 4.6 Generate a service account key

1. Go to **Project Settings → Service Accounts**
2. Click "Generate new private key"
3. Download the JSON file — copy `project_id`, `client_email`, and `private_key` into your `.env.local`

### 4.7 Deploy security rules for this project

The Firestore rules file is `firestore.rules`. Deploy it whenever rules are updated:

```bash
firebase deploy --only firestore:rules
```

---

## 5. Cloudinary Setup

1. Log in to [Cloudinary](https://cloudinary.com) and go to the Dashboard
2. Note your **Cloud Name**, **API Key**, and **API Secret** — add them to `.env.local`
3. No additional configuration is required. Folders are created automatically on first upload.

**Folder conventions used by the app:**

| Folder path | Contents |
|---|---|
| `{tenantId}/branding` | Organisation logos |
| `{tenantId}/profiles` | User profile photos |
| `inan/forms/og-images` | Form banner images |
| `inan/seo` | Default SEO Open Graph image |

---

## 6. Brevo Setup

1. Log in to [Brevo](https://brevo.com) and go to **SMTP & API**
2. Create a SMTP/API key and add it to `.env.local` as `BREVO_API_KEY`
3. Configure your verified sending email and display name in `.env.local` as `BREVO_FROM_EMAIL` and `BREVO_FROM_NAME`
4. Authenticate your sending domain in **Brevo → Settings → Senders & IP → Domains**:
   - Add `inan.com.ng` as the sending domain
   - Brevo will generate two DNS records — an SPF record and a DKIM record
   - Pass both to whoever manages the `inan.com.ng` DNS (they need to merge the SPF into any existing SPF record and add the DKIM as a new TXT record)
   - Once DNS propagates, click **Verify** in Brevo — both SPF and DKIM should show green
5. Set `BREVO_FROM_EMAIL` to `noreply@inan.com.ng` (not a Gmail or personal address — Brevo cannot send on behalf of Gmail addresses)

> **Important — two SPF records is invalid.** If `inan.com.ng` already has SPF records (e.g. for one.com and Zoho), do not add a second one. All includes must be merged into a single TXT record:
> ```
> v=spf1 include:_custspf.one.com include:sender.zohobooks.com include:spf.brevo.com ~all
> ```

> **DMARC note.** Until SPF and DKIM are verified, emails to `@inan.com.ng` recipients will be rejected with `550 5.7.1 DMARC policy violation`. Emails to Gmail, Yahoo, and other standard domains are unaffected — those use Firebase's built-in email delivery.

All transactional emails are sent via Brevo HTTP API (`POST https://api.brevo.com/v3/smtp/email`). No SMTP credentials or nodemailer are used.

---

## 7. Deploying to Vercel

1. Push the repository to GitHub (or GitLab / Bitbucket)
2. Go to [Vercel](https://vercel.com) and click "Add New Project"
3. Import the repository
4. Under **Environment Variables**, add all the variables listed in [§ 3 Environment Variables](#3-environment-variables)
5. Click **Deploy**

Vercel automatically detects Next.js and configures the build command (`next build`) and output directory.

**Custom domain setup:**
1. In Vercel → Project → Settings → Domains, add your domain (e.g. `feedback.inan.com.ng`)
2. Follow Vercel's DNS configuration instructions
3. Ensure the domain matches an entry in `DOMAIN_TO_TENANT` in `src/middleware.ts`:
   ```typescript
   const DOMAIN_TO_TENANT: Record<string, string> = {
     'feedback.inan.com.ng': 'inan',
     'feedback.yourclient.com': 'yourclient',  // add new tenants here
   };
   ```

---

## 8. Tenant Onboarding

This section covers the steps to bring a new organisation onto the platform.

### Option A — Self-service (new organisation registers themselves)

1. Share the `/register` URL with the organisation
2. They fill in their company name, name, email, and password
3. Their organisation and first admin account are created automatically
4. Verify the registration landed correctly in the Firebase Console (check `tenants` collection and `tenant-admins`)
5. Log into `/super-admin` to update their plan, limits, and feature flags

### Option B — Super admin creates the tenant manually

1. Log into `/super-admin`
2. Click "+ Add Tenant"
3. Fill in:
   - **Tenant ID** — a unique slug (lowercase, hyphens, no spaces), e.g. `acme-corp`
   - **Display name** — e.g. `Acme Corp`
   - **Domain** — the domain the organisation will use, e.g. `feedback.acme.com`
   - **Plan** — `trial` / `basic` / `pro`
   - **Form limit** — maximum number of feedback forms (default: 5)
   - **Feature flags** — toggle on any features for their plan
4. Click "Create Tenant"
5. Add the domain mapping to `src/middleware.ts` → `DOMAIN_TO_TENANT` and redeploy
6. The organisation can now register via the `/register` page on their subdomain, or you can run `node scripts/setup-admin.js` for initial user creation

### Option C — Script-based setup

For programmatic setup during migration or bulk onboarding, see [§ 9 Admin Scripts](#9-admin-scripts-reference).

---

## 9. Admin Scripts Reference

All scripts are in the `scripts/` directory. They use ES module syntax and load environment variables from `.env.local` via `dotenv`. Run them from the project root.

> **Prerequisites:** The scripts require Node.js 22+ and a valid `.env.local` with Firebase Admin credentials.

---

### `set-super-admin.js`

**Purpose:** Grants super admin access to a Firebase Auth user.

```bash
node scripts/set-super-admin.js <email>
```

Sets the `superAdmin: true` custom claim on the user account with the given email. This must be run before a user can access `/super-admin`. It is not self-serviceable — only someone with server access can run this script.

---

### `backfill-tenant-claims.js`

**Purpose:** Stamps `tenantId` claims on all users that are missing them.

```bash
node scripts/backfill-tenant-claims.js
```

Iterates all documents in `tenant-admins`, reads the `tenantId` field, and calls `setCustomUserClaims` for the corresponding Firebase Auth user. Safe to run multiple times — skips users that already have the correct claim.

Use this after a migration or if a batch of users was created without claims being set.

---

### `repair-missing-tenant-claims.js`

**Purpose:** Two-pass repair for a specific tenant.

```bash
node scripts/repair-missing-tenant-claims.js <tenantId>
```

- **Pass 1** — Finds users with a `tenant-admins` doc matching `<tenantId>` but no `tenantId` claim, and sets the claim
- **Pass 2** — Finds Firebase Auth users with no `tenant-admins` doc and no claim, and assigns them to `<tenantId>`

Use this when a specific tenant's users are reporting login issues related to missing tenant context.

---

### `fix-single-user.js`

**Purpose:** Fixes one specific user.

```bash
node scripts/fix-single-user.js <uid> <tenantId>
```

Updates the `tenant-admins/{uid}` document and sets the `tenantId` custom claim. Used for targeted one-off repairs when a single user has a known issue.

---

### `seed-tenant-admins.js`

**Purpose:** Seeds initial tenant admin mappings from a predefined list.

```bash
node scripts/seed-tenant-admins.js
```

Used during initial project setup to bulk-create `tenant-admins` documents. Edit the script to define the list of users before running.

---

### `migrate-to-tenant.js`

**Purpose:** Adds `tenantId` to legacy documents that predate multi-tenancy.

```bash
node scripts/migrate-to-tenant.js
```

Iterates `feedback-forms` and `feedback-responses` documents that have no `tenantId` field and stamps them with the default tenant. Run once during the initial multi-tenancy migration. Should not be needed on new deployments.

---

### `setup-admin.js`

**Purpose:** General admin setup for initial deployment.

```bash
node scripts/setup-admin.js
```

Used during first-time setup to bootstrap an admin user. Review the script before running to confirm the target user details are correct.

---

### `backfill-form-created-by.js`

**Purpose:** Stamps a `createdBy` field onto legacy `feedback-forms` documents that were created before the Staff RBAC system was introduced.

```bash
# Dry run — shows which forms would be updated (safe, no writes)
node scripts/backfill-form-created-by.js

# Confirm and apply
CONFIRM_BACKFILL=yes node scripts/backfill-form-created-by.js
```

Iterates all `feedback-forms` documents that have no `createdBy` field. For each one, it looks up the tenant owner from `tenant-admins` and assigns the form to them. Forms where no owner is found are assigned to the sentinel value `"system"`, which makes them visible only to Admins/Owners and not to any Staff user.

Run this once when deploying the Staff RBAC feature to an existing tenant that already has forms.

---

### `validate-rbac-implementation.js`

**Purpose:** Diagnostic script that checks the current state of RBAC implementation across the database.

```bash
node scripts/validate-rbac-implementation.js
```

Reports:
- Total forms and how many are missing the `createdBy` field
- Breakdown of forms by creator UID
- Role distribution across all users in `tenant-admins`
- Per-tenant user counts (owners vs staff)

Use this before and after running `backfill-form-created-by.js` to confirm the data is in the expected state.
