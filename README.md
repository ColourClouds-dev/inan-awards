# INAN Feedback

A multi-tenant web application for creating and distributing public feedback forms, running employee polls, collecting responses, and analysing results — all from a centralised dashboard.

Built for **Inan Management Ltd** and deployed as a SaaS platform. Each organisation accesses the system through its own subdomain. Guests submit feedback through public-facing form pages with no account required.

---

## Core Features

- Create custom feedback forms with rating, text, and multiple-choice questions
- Share forms via links and QR codes
- Collect public responses — no login required
- Auto-tag every response by sentiment, time taken, completion, and custom rules
- View and filter all responses in an expandable dashboard table with Excel, CSV, and PDF export
- Analyse response trends with per-form analytics panel (sentiment distribution, completion rate, custom tag counts, negative response list)
- Get automatic email alerts when negative or flagged feedback arrives — routed to org-wide and staff personal inboxes
- Run **opinion polls** and **Staff of the Month nomination polls** with real-time vote results
- Manage employees — import from Excel/CSV, use as poll nominees
- Invite and manage team members with role-based access (Admin / Staff)
- Manage branding, locations, notification settings, SEO, and employee records
- Support multiple organisations (tenants) on a single codebase
- Offline resilience — network loss detection, animated banner, and request timeout handling throughout

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS |
| Animation | Framer Motion |
| Auth & Database | Firebase Authentication + Cloud Firestore |
| Image Storage | Cloudinary |
| Email | Brevo (SMTP REST API) |
| Bot Protection | Google reCAPTCHA v3 |
| Charts | Recharts |
| Table | TanStack Table v8 |
| Rich Text | Tiptap |
| Export | xlsx (Excel), custom CSV / PDF builders |
| Package Manager | npm |

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

Key variables:

```
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=
FIREBASE_ADMIN_PRIVATE_KEY=
CLOUDINARY_API_SECRET=
BREVO_API_KEY=
BREVO_FROM_EMAIL=
RECAPTCHA_SECRET_KEY=
```

See `env.local.example` for the full list and the `Setup and Configuration` doc for where to find each value.

### 3. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## How It Works

### Guest (public)

Guests visit `/feedback/[formId]` (or a custom slug URL) to fill out a form — no account required. The system:

- Validates submission with reCAPTCHA v3
- Blocks duplicate submissions by visitor IP
- Collects visitor metadata (city, region, country, ISP)
- Measures time spent
- Auto-computes response tags (sentiment, completion, time, custom rules)
- Triggers a negative feedback alert email if sentiment is negative
- Optionally displays a share-your-response button after submission

Guests also visit `/poll/[pollId]` to vote in opinion polls or Staff of the Month nominations.

### Organisation admin (Owner)

Authenticated owners access `/dashboard` to:

- **Build forms** — 3-step wizard (details → questions → tag rules), with live preview, QR code, draft auto-save, custom URL slug, and section grouping
- **Build polls** — 2-step wizard (opinion or staff nomination), with share link after creation
- **View responses** — filterable, sortable, expandable table with Excel/CSV/PDF export
- **View analytics** — per-form sentiment breakdown, completion rates, and custom tag counts
- **Manage team** — invite staff by email, change roles (Admin/Staff), remove members
- **Manage employees** — import from Excel/CSV, view and delete employee records
- **Configure settings** — branding (logo, brand color), locations, notification emails, SEO/OG metadata, response sharing toggle, danger zone

### Staff

Authenticated staff see a scoped view — only their own forms, polls, and responses. They can manage their account, set personal notification email addresses, and access locations.

### Super admin

Platform-level administrators access `/super-admin` to manage all organisations — create tenants, set plans and limits, toggle feature flags, manage users across tenants, and impersonate any organisation's dashboard for support.

### Multi-tenancy

Each organisation is a tenant identified by a slug (e.g. `inan`). The Next.js middleware resolves the tenant from the incoming domain and injects it as a request header. All Firestore queries and security rules are scoped to `tenantId`. Tenant plans (trial / basic / pro) and form limits are enforced at form creation time.

### Email Verification Flow

Registration routing splits automatically based on the user's email domain:

- **Standard consumer domains** (Gmail, Yahoo, Hotmail, etc.): Native Firebase client-side `sendEmailVerification`.
- **Custom corporate domains**: Secure custom flow — generates a single-use token (12-hour TTL, 60-second rate limit), stores it in `users/{uid}/verification_tokens/{tokenId}`, and sends a styled email via Brevo. Verified at `/verify-email?token=...&uid=...`.

---

## Feature Details

### Feedback Form Builder

- **3-step wizard:** Basics → Questions → Tag Rules
- **Question types:** Rating (1–5 stars), Text (open-ended), Multiple Choice (radio or checkbox with optional minimum selections and an "Others" option)
- **Sections:** Group questions under named sections with rich-text descriptions; sections can be reordered
- **Step-by-step mode:** Presents one question per screen with animated transitions on the public form
- **Name collection:** Optional respondent name field
- **Custom URL slug:** Human-readable alias (e.g. `/feedback/hr-survey`) with real-time uniqueness validation
- **OG image:** Upload a cover image shown when the form URL is shared on social media
- **Live preview panel:** Slides in from the right (desktop) or up from the bottom (mobile) while building
- **Draft auto-save:** Progress is persisted to `sessionStorage` so refreshing the page doesn't lose work
- **QR code:** Generated after save; displayed inline in the builder
- **Form limit enforcement:** Blocked at save if the tenant has reached its plan limit
- **Custom tag rules:** Multi-condition AND-logic rules that assign a coloured badge when specific question responses match defined operators (contains, equals, less_than, greater_than)

### Poll System

- **Poll types:** Opinion Poll (custom questions) and Staff Nomination (Staff of the Month with employees as nominees)
- **Opinion poll questions:** Single-choice (radio) or multiple-choice (checkbox), with dynamic options
- **Staff nomination:** Employee selector picks nominees from the tenant's employee list; validates they exist in Firestore before saving
- **Settings:** Allow multiple votes toggle, show-results control (after voting / always / never), optional end date
- **Public voting page** (`/poll/[pollId]`): Unauthenticated voting; results displayed immediately based on show-results setting
- **Post-create share modal:** Copy-link button with poll URL
- **Poll list:** Search, status filter (all / active / completed), activate/deactivate toggle per card

### Response Tagging Engine

Every submitted response is automatically tagged:

| Tag type | Logic |
|---|---|
| **Sentiment** | Average of all rating answers — Positive (≥4), Neutral (2.5–4), Negative (<2.5) |
| **Time** | Fast (<1 min), Normal (1–5 min), Slow (>5 min) |
| **Completion** | Complete (all required answered) or Partial (X/Y) |
| **Custom** | Rule-based: all defined conditions must match (AND logic) |

### Notification & Email System

All transactional emails are sent via Brevo. Sender name is tenant-branded.

| Email | When it fires |
|---|---|
| Account confirmation | Organisation registers |
| Staff invitation | Owner invites a team member (7-day expiry link) |
| Welcome email | First verified login (once only, guarded server-side) |
| Email verification | Account creation or manual resend |
| Negative feedback alert | Negative-sentiment response submitted — sent to org-wide list + form owner's personal notification addresses, deduplicated |
| Password changed notification | User changes their password |
| Password reset | Forgot password request |

**Notification routing:**
- Org-wide recipients are configured by owners under Settings → Notifications.
- Staff members can add personal notification emails under their own Settings → Notifications tab; these receive alerts only for their own forms.

### Employee Management

- Import employees from Excel (`.xlsx`) or CSV files via `EmployeeManagementSection`
- Imports are processed in Firestore batches of 400 for reliability
- Employees are scoped per tenant and can be viewed and deleted individually
- Employees are available as nominees in Staff of the Month nomination polls via the `EmployeeSelector` component
- A downloadable sample CSV template is available at `/sample-employees-template.csv`

### Team Management

- Owners can invite staff by email — invitation tokens expire after 7 days
- Team member list shows role badge, join date, form count, and welcome-sent status
- Role can be changed inline (Admin ↔ Staff) — updates Firebase custom claims and Firestore atomically
- Members can be removed (deletes from Firebase Auth and Firestore)

### Branding / White-labeling

- Per-tenant customisation: logo (Cloudinary upload), primary brand color (hex), email display name
- `BrandProvider` injects a `--brand` CSS variable so the brand color applies to buttons, active nav links, and form accents globally
- Sidebar shows the tenant logo when configured
- `hidePoweredBy` feature flag removes the "Powered by" badge from public forms

### Super Admin Console

- Full CRUD on all tenants — create, edit, and deactivate
- Tenant plan (trial / basic / pro), form limit, and feature flags (feedbackForms, seoSettings, hidePoweredBy, allowResponseSharing) are all editable
- Expandable user list per tenant with role badges, join dates, and form counts
- Change any user's role, email, or delete them
- **Tenant impersonation:** "View as" button sets an HTTP-only cookie and redirects to `/dashboard` as that tenant; a yellow banner persists with an Exit button

### Offline / Connectivity

- `OfflineBanner` — a fixed pill at the top-center of the screen
  - Offline: dark pill with a pulsing red dot and "No internet connection" slides down
  - Reconnected: switches to green "Back online" for 2.5 seconds, then slides away
- `useNetworkStatus` hook tracks `isOnline` and `justReconnected` via browser `online`/`offline` events
- `useWithTimeout` hook wraps Firestore calls with a configurable timeout; surfaces a "Taking longer than expected" message with a retry button

### RBAC — Role Summary

| Role | Access |
|---|---|
| **Super Admin** | `/super-admin` + full impersonation of any tenant |
| **Owner (Admin)** | Full dashboard — all forms/responses in the tenant, Settings (all tabs), team and employee management |
| **Staff** | Scoped dashboard — own forms and responses only; limited Settings (Account, Notifications, Locations) |

---

## Pages Reference

### Public

| Route | Description |
|---|---|
| `/` | Landing page with feature highlights and QR demo |
| `/login` | Email + password login |
| `/register` | New organisation registration |
| `/create-account` | Staff account creation via invitation token |
| `/verify-email` | Email verification prompt |
| `/feedback/[formId]` | Public feedback form (also resolves custom slugs) |
| `/poll/[pollId]` | Public poll voting page |
| `/responses/[responseId]` | Shareable response receipt (feature-gated) |

### Dashboard (authenticated)

| Route | Description |
|---|---|
| `/dashboard` | Overview — stat cards (active forms, recent responses, avg rating) and quick actions |
| `/dashboard/feedback/forms` | Form list — status, response count, edit/share/QR/delete |
| `/dashboard/feedback/polls` | Poll list — search, filter, activate/deactivate, delete |
| `/dashboard/feedback/polls/create` | Poll builder wizard |
| `/dashboard/feedback/polls/[pollId]` | Poll detail — vote breakdown and results |
| `/dashboard/feedback/responses` | Responses table with full filter/sort/export |
| `/dashboard/feedback/analytics` | Per-form analytics — sentiment, completion, custom tags, negatives |
| `/dashboard/settings` | Tabbed settings (Account, Organisation, Notifications, Advanced, Team, Employees, Danger Zone) |
| `/super-admin` | Platform super admin console |

---

## Project Structure

```
src/
├── app/
│   ├── api/              # Server-side API routes
│   ├── create-account/   # Staff account creation via invitation
│   ├── dashboard/        # Protected dashboard pages
│   ├── feedback/         # Public feedback form
│   ├── login/            # Login + forgot password
│   ├── poll/             # Public poll voting
│   ├── register/         # New organisation registration
│   ├── responses/        # Shareable response receipts
│   ├── super-admin/      # Platform-level admin console
│   └── verify-email/     # Email verification handler
├── components/           # Reusable UI components
├── contexts/             # TenantContext (multi-tenant + RBAC resolution)
├── hooks/                # useNetworkStatus, useToast, useWithTimeout,
│                         # useFeedbackFilters, usePagination, usePollResults,
│                         # useStableRole
├── lib/                  # Firebase, Firestore helpers, tag engine, sanitize,
│                         # export (Excel/CSV/PDF), visitor info, polls
├── types/                # Shared TypeScript interfaces
└── middleware.ts          # Domain-to-tenant resolution
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
