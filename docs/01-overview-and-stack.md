# 01 — Product Overview & Technology Stack

**Part of:** [INAN Feedback Technical Manual](./TECHNICAL_MANUAL.md)

---

## Table of Contents

1. [Business Overview](#1-business-overview)
2. [The Three User Types](#2-the-three-user-types)
3. [Core Capabilities](#3-core-capabilities)
4. [Technology Stack](#4-technology-stack)
5. [Third-Party Services](#5-third-party-services)

---

## 1. Business Overview

### What is INAN Feedback?

INAN Feedback is a web-based platform that lets organisations collect, manage, and analyse feedback from their customers or guests — without those customers needing an account or app.

An organisation creates forms, shares them via a link or QR code, and guests fill them in on any device. The organisation's team then views all responses in a private dashboard, sees trends over time, and gets automatic email alerts when negative feedback comes in.

The platform is built for **Inan Management Ltd** and operates as a multi-organisation (multi-tenant) SaaS product. This means a single deployment of the platform serves multiple organisations simultaneously, with each organisation's data fully separated from the others.

### Why was it built this way?

- **No app download required** — guests submit feedback directly in their browser
- **No guest account required** — reduces friction, increases submission rates
- **One platform, many organisations** — Inan Management can onboard new clients without redeploying the system
- **Real-time analysis** — the dashboard updates as responses come in, with no manual exports needed
- **Automatic alerts** — staff are notified immediately when a customer leaves negative feedback, enabling a faster response

---

## 2. The Three User Types

The platform has three distinct types of users, each with different levels of access.

### Guest (Public)

A guest is any person who visits the public feedback form link — typically a customer, hotel guest, or event attendee. Guests:

- Do not need an account
- Fill in the form and submit
- Cannot see any other responses or any part of the dashboard
- Are limited to one submission per form per device

### Organisation Admin (Tenant Admin)

An organisation admin is a staff member who logs into the dashboard. They manage everything for their organisation. Admins:

- Create and manage feedback forms
- View and export all responses their organisation has collected
- Analyse response trends over time
- Configure their organisation's branding, locations, and notification settings
- Manage employee records (if the feature is enabled for their plan)

Each admin belongs to exactly one organisation. They cannot see data from any other organisation.

### Super Admin

A super admin is a platform-level administrator from Inan Management Ltd. Super admins:

- Can view and manage all organisations on the platform
- Create new organisations (tenants)
- Set plans, form limits, and feature flags per organisation
- Impersonate any organisation's dashboard to troubleshoot issues
- Activate or deactivate organisations

Super admin access is granted via a server-side script and is not self-serviceable.

---

## 3. Core Capabilities

| Capability | Description |
|---|---|
| **Feedback Forms** | Create custom forms with rating, text, and multiple-choice questions |
| **QR Code Sharing** | Every form gets a QR code that can be downloaded and printed |
| **Public Submission** | Guests submit via a browser link, no login needed |
| **Auto-Tagging** | Each response is automatically labelled by sentiment, time taken, completion, and custom rules |
| **Response Dashboard** | View, filter, search, and export all responses |
| **Analytics** | Line charts showing tag trends over time, by day, week, or month |
| **Negative Alerts** | Automatic email notifications when negative or flagged feedback arrives |
| **Branding** | Each organisation can set its logo, brand colour, and email display name |
| **Locations** | Forms are assigned to specific branches or locations |
| **SEO & Open Graph** | Custom page titles, descriptions, and social share images per organisation |
| **Employee Records** | Import and manage staff records (plan-dependent feature) |
| **Multi-Tenancy** | Multiple organisations on one platform, fully data-isolated |
| **Offline Resilience** | The app detects network loss and protects users from data loss |

---

## 4. Technology Stack

> **For developers.** This section lists every library and tool the platform is built on.

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| Framework | Next.js (App Router) | 14.x | Full-stack React framework, handles routing, server components, and API routes |
| Language | TypeScript | 5.x | Type-safe JavaScript across the entire codebase |
| UI Library | React | 18.x | Component-based UI rendering |
| Styling | Tailwind CSS | 3.x | Utility-first CSS; brand colour injected via CSS custom property `--brand` |
| Animation | Framer Motion | 12.x | Page transitions and micro-animations |
| Forms | React Hook Form + Zod | 7.x / 4.x | Form state management and schema validation |
| Charts | Recharts | 2.x | Line charts on the analytics page |
| Table | TanStack Table | 8.x | Responses table with sorting and row expansion |
| Auth | Firebase Authentication | 10.x | User sign-up, sign-in, email verification, password reset, JWT tokens |
| Database | Cloud Firestore | 10.x | Primary NoSQL database for all application data |
| Admin SDK | Firebase Admin | 13.x | Server-side auth token validation and custom claims management |
| Image Storage | Cloudinary | 2.x | All uploaded images (logos, banners, profile photos) |
| Email | Resend | 6.x | All transactional emails sent from `noreply@inan.com.ng` |
| Bot Protection | Google reCAPTCHA v3 | — | Invisible bot detection on form submissions and password changes |
| QR Codes | qrcode.react | 4.x | QR code generation and download |
| Excel Export | xlsx (SheetJS) | 0.18.x | `.xlsx` export of response data |
| UUID Generation | uuid | 11.x | Unique IDs for forms and responses |
| Testing | Vitest + Testing Library | 4.x / 16.x | Unit and component testing |
| Package Manager | npm | — | Dependency management |
| Runtime | Node.js | 22.x | Server-side JavaScript runtime |

---

## 5. Third-Party Services

> **For developers.** This section explains how each external service is used and how it is integrated.

### 5.1 Firebase (Google)

**What it does:** Provides authentication and the database.

- **Firebase Authentication** issues JWT tokens when users sign in. Those tokens carry custom claims (`tenantId`, `superAdmin`) that tell the application which organisation a user belongs to and whether they have elevated privileges.
- **Cloud Firestore** is the NoSQL database where all data lives — organisations, forms, responses, settings, and employees.
- **Firebase Admin SDK** runs on the server side only (in Next.js API routes). It sets and reads custom claims on user tokens, and performs privileged database operations that client-side code is not permitted to do.

### 5.2 Cloudinary

**What it does:** Stores and delivers all uploaded images.

Organisation logos, form banner images, profile photos, and SEO Open Graph images are all stored on Cloudinary. Uploads use a signed-request flow: the server signs the upload parameters, and the browser uploads directly to Cloudinary. The API secret is never sent to the browser.

Cloudinary folders per organisation:
- `{tenantId}/branding` — logos
- `{tenantId}/profiles` — profile photos
- `inan/forms/og-images` — form banner images
- `inan/seo` — default Open Graph image

### 5.3 Resend

**What it does:** Sends all transactional emails from `noreply@inan.com.ng`.

Four email types are sent:
1. Registration confirmation — after a new organisation signs up
2. Email verification prompt — triggered by Firebase Authentication directly
3. Welcome email — sent once on a user's first verified dashboard login
4. Negative feedback alert — sent to configured recipients when a negative or flagged response arrives

### 5.4 Google reCAPTCHA v3

**What it does:** Invisible bot protection.

A score token is generated silently in the browser when the user submits a feedback form or changes their password. That token is verified server-side via `/api/verify-recaptcha`. Submissions that score below Google's threshold are rejected before any data is written to the database.

### 5.5 ipapi.co

**What it does:** Resolves visitor location metadata.

When a guest loads the public feedback form, the application calls `ipapi.co` to resolve the visitor's approximate city, region, country, and ISP from their IP address. This data is stored alongside the response for filtering in the dashboard. The service is called client-side at page load, not at submission time.

### 5.6 Vercel

**What it does:** Hosts and serves the Next.js application.

The platform is deployed on Vercel. Environment variables are managed per deployment environment (development, production) in the Vercel dashboard. Vercel handles SSL, CDN distribution, and serverless function execution for API routes.
