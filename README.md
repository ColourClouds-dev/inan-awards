# INAN Feedback

A multi-tenant web application for creating and distributing public feedback forms, collecting responses, and analysing results — all from a centralised dashboard.

Built for **Inan Management Ltd** and deployed as a SaaS platform. Each organisation accesses the system through its own subdomain. Guests submit feedback through public-facing form pages with no account required.

---

## Core Features

- Create custom feedback forms with rating, text, and multiple-choice questions
- Share forms via links and QR codes
- Collect public responses (no login required)
- Auto-tag every response by sentiment, time taken, and completion
- View and filter all responses in an expandable dashboard table with Excel export
- Analyse response trends with tag-based line charts (daily, weekly, monthly)
- Get automatic email alerts when negative or flagged feedback arrives
- Manage branding, locations, notifications, SEO settings, and employee records
- Support multiple organisations (tenants) on a single codebase
- Offline resilience — network loss detection and request timeout handling throughout

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS |
| Auth & Database | Firebase Authentication + Cloud Firestore |
| Image Storage | Cloudinary |
| Email | Resend |
| Bot Protection | Google reCAPTCHA v3 |
| Charts | Recharts |
| Table | TanStack Table v8 |
| Package Manager | npm |
| Runtime | Node.js 22 |

---

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy the example file and fill in your values:

```bash
cp env.local.example .env.local
```

Key variables you need:

```
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=
FIREBASE_ADMIN_PRIVATE_KEY=
CLOUDINARY_API_SECRET=
RESEND_API_KEY=
RECAPTCHA_SECRET_KEY=
```

See `env.local.example` for the full list and `docs/05-setup-and-configuration.md` for where to find each value.

### 3. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## How It Works

### Guest (public)
Guests visit `/feedback/[formId]` to fill out a form — no account needed. Responses are automatically tagged by sentiment, time taken, and completion, then saved to Firestore. One submission per device per form is enforced via localStorage and IP check.

### Organisation admin
Authenticated admins access `/dashboard` to:
- **Build forms** — 3-step wizard (details → questions → logic tags)
- **View responses** — filterable, expandable table with Excel export
- **Analyse trends** — line chart bucketed by day, week, or month per tag label
- **Configure settings** — branding, locations, notification emails, SEO, and employee records

### Super admin
Platform-level administrators access `/super-admin` to manage all organisations — create tenants, set plans and limits, toggle feature flags, and impersonate any organisation's dashboard for support.

### Multi-tenancy
Each organisation is a tenant identified by a slug (e.g. `inan`). The Next.js middleware resolves the tenant from the incoming domain and injects it as a request header. All Firestore queries and security rules are scoped to `tenantId`.

---

## Project Structure

```
src/
├── app/
│   ├── api/              # Server-side API routes
│   ├── dashboard/        # Protected dashboard pages
│   ├── feedback/[formId] # Public feedback form
│   ├── login/            # Login + forgot password
│   ├── register/         # New tenant registration
│   └── super-admin/      # Platform-level admin panel
├── components/           # Reusable UI components
├── contexts/             # TenantContext
├── hooks/                # useNetworkStatus, useToast, useWithTimeout, useFeedbackFilters
├── lib/                  # Firebase, Firestore helpers, tag engine, sanitize, export
├── types/                # Shared TypeScript interfaces
└── middleware.ts         # Domain-to-tenant resolution
scripts/                  # Admin and maintenance scripts
firestore.rules           # Firestore security rules
```

---

## Scripts

Utility scripts for admin tasks live in `scripts/`. Run them with Node from the project root:

```bash
node scripts/set-super-admin.js <email>                        # Grant super admin access
node scripts/backfill-tenant-claims.js                         # Stamp tenantId claims on all users
node scripts/repair-missing-tenant-claims.js <tenantId>        # Fix missing claims for a tenant
node scripts/fix-single-user.js <uid> <tenantId>               # Fix a single user
node scripts/seed-tenant-admins.js                             # Seed initial admin mappings
node scripts/migrate-to-tenant.js                              # Backfill tenantId on legacy data
```

---

## Quality Policy

This project follows a defined quality policy covering data handling, service standards, and operational guidelines. See [`privacy-policy.pdf`](./privacy-policy.pdf) for the full document.

---

## Contact

For questions, support, or data enquiries, reach out at [colourclouds042@gmail.com](mailto:colourclouds042@gmail.com).

---

## Documentation

The `docs/` folder contains the full technical manual, split into focused sections:

| Document | What it covers |
|---|---|
| [Technical Manual](./docs/TECHNICAL_MANUAL.md) | Index and quick links |
| [Overview and Stack](./docs/01-overview-and-stack.md) | Product overview, user types, tech stack, third-party services |
| [Architecture](./docs/02-architecture.md) | System diagram, request lifecycle, multi-tenancy, branding system, impersonation |
| [Data Architecture](./docs/03-data-architecture.md) | Firestore collections, field schemas, security rules |
| [Features](./docs/04-features.md) | Every feature — what it does, how to use it, how it is built |
| [Setup and Configuration](./docs/05-setup-and-configuration.md) | Environment variables, Firebase setup, deployment, tenant onboarding, scripts |
| [Reference](./docs/06-reference.md) | API routes, component library, hooks, utility libs, known limits |
