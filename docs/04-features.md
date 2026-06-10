# 04 — Features

**Part of:** [INAN Feedback Technical Manual](./TECHNICAL_MANUAL.md)

---

## Table of Contents

1. [Registration & Login](#1-registration--login)
2. [Dashboard Overview](#2-dashboard-overview)
3. [Form Builder](#3-form-builder)
4. [Forms List](#4-forms-list)
5. [Public Feedback Form](#5-public-feedback-form)
6. [Auto-Tagging](#6-auto-tagging)
7. [Responses](#7-responses)
8. [Analytics](#8-analytics)
9. [Settings](#9-settings)
10. [Profile](#10-profile)
11. [Super Admin](#11-super-admin)
12. [Offline Resilience](#12-offline-resilience)

---

## 1. Registration & Login

### Business Overview

New organisations sign up via the `/register` page. This creates their organisation account and their first admin user at the same time. Existing admin users log in at `/login`. A password reset link can be requested from the login page.

New users added to an existing organisation (for example, additional staff members) register via a modal on the login page of their organisation's subdomain — not via the public `/register` page.

All accounts require email verification before the dashboard becomes accessible.

### How to use it

**Registering a new organisation:**
1. Go to `/register`
2. Enter the company name, your name, work email, optional domain, and a password
3. Click "Create Account"
4. Check your email for a verification link and click it
5. Return to `/login` and sign in

**Logging in:**
1. Go to `/login`
2. Enter your email and password and click "Sign In"

**Forgot password:**
1. On the login page, click "Forgot password?"
2. Enter your email and click send
3. Follow the link in the email to set a new password

**Adding a new user to an existing organisation:**
1. The new user visits the organisation's login page (its subdomain)
2. Clicks "Don't have an account? Create one"
3. Fills in their email and password
4. Verifies their email before gaining dashboard access

### Technical Detail

**New organisation registration (`/register`):**
```
createUserWithEmailAndPassword(auth, email, password)
  → updateProfile (sets displayName)
  → slugify(companyName) → tenantId (lowercase, hyphens, no spaces)
  → POST /api/register-tenant
      → Creates tenants/{tenantId} document with default plan and limits
      → Creates tenant-admins/{uid} document
      → Sets tenantId custom claim via Firebase Admin
      → Sends registration confirmation email via Resend (fire-and-forget)
  → sendEmailVerification(user) — Firebase sends the verification email
  → Shows "Check your email" screen with 60-second resend cooldown
```

**Adding a user to an existing tenant (CreateAccountModal):**
```
createUserWithEmailAndPassword(auth, email, password)
  → POST /api/add-tenant-user
      → Server reads x-tenant-id from middleware-injected header
      → Verifies tenant exists in Firestore
      → Creates tenant-admins/{uid} document
      → Sets tenantId custom claim via Firebase Admin
  → sendEmailVerification(user)
  → auth.signOut() — user must verify before accessing dashboard
  → If /api/add-tenant-user fails → user.delete() to avoid orphaned Auth account
```

**AuthGuard** — every page under `/dashboard` is wrapped in `AuthGuard`, which:
- Subscribes to `onAuthStateChanged`
- Redirects to `/login` if no user is present
- If the user exists but `emailVerified === false`: signs them out and shows the `EmailVerification` component (a screen explaining they need to verify first)
- If verified: renders the dashboard

---

## 2. Dashboard Overview

### Business Overview

The dashboard overview is the first page an admin sees after logging in. It shows a snapshot of recent activity for their organisation: how many forms are active, how many total responses have been received in the last 30 days, and the average star rating over that period.

Four quick-action buttons link directly to the main dashboard sections.

### How to use it

After logging in you land here automatically. The four stat cards update in real time. Use the quick-action buttons to jump to creating a form, viewing all forms, browsing responses, or viewing analytics.

### Technical Detail

The page runs two parallel Firestore queries (both scoped to `tenantId`) using `useWithTimeout` (10-second deadline):
- `feedback-forms` — to count active and total forms
- `feedback-responses` — to compute the 30-day response count and average rating

Average rating is computed client-side: filter responses with a `submittedAt` within the last 30 days, extract all numeric values from the `responses` map, average them.

---

## 3. Form Builder

### Business Overview

The form builder is a 3-step wizard that lets an admin create a new feedback form. Forms can contain rating questions (1–5 stars), text questions, and multiple-choice questions. Each form is assigned to a location (a branch or venue the organisation has configured).

Once created, the form gets a unique link and QR code that can be shared with guests. The form can also be configured to show questions one at a time (step-by-step mode) rather than all at once.

### How to use it

**Step 1 — Details:**
1. Go to Dashboard → Feedback
2. Enter a form title (required)
3. Optionally add a description
4. Select the location this form is for
5. Optionally upload a banner image
6. Choose display mode: "All at once" or "One at a time"
7. Click "Next: Add Questions"

**Step 2 — Questions:**
1. Click the "+" button to add a question
2. Choose the question type: Rating, Text Response, or Multiple Choice
3. Type the question text
4. Toggle "Required" if the question must be answered
5. For Multiple Choice: add answer options, choose single or multi-select, and optionally set a minimum number of selections
6. Use the up/down arrows to reorder questions
7. Click "Create Form" to save immediately, or "Logic Tags" to add tagging rules first

**Step 3 — Logic Tags (optional):**
1. Click "Add Tag Rule"
2. Give the tag a name and colour
3. Add one or more conditions (pick a question, an operator, and a value)
4. All conditions must match for the tag to be applied (AND logic)
5. Click "Create Form"

**After saving:**
- A QR code is shown — download it or copy the form link
- Share via WhatsApp, LinkedIn, email, or the native device share menu
- Click "Create Another Form" to start again

### Technical Detail

- Form draft is auto-saved to `sessionStorage` between steps — navigating away does not lose progress
- All text inputs pass through `sanitizeAndLimit()` before saving to Firestore
- `saveForm()` writes to `feedback-forms/{uuid}` and calls `incrementFormCount` on the tenant document
- The form limit (`tenant.formLimit`) is checked before saving — attempting to create a form beyond the limit is blocked
- The `FeedbackFormBuilder` component manages all three steps and the post-save QR screen
- A live preview panel is available on Step 2: slides in from the right on desktop, from the bottom on mobile

---

## 4. Forms List

### Business Overview

The forms list shows all feedback forms the organisation has created. Each form card shows the title, status (active or inactive), location, creation date, and number of responses. From here admins can view, edit, activate, deactivate, or delete any form.

### How to use it

Go to Dashboard → Forms. Use the filter bar to search by title or location, filter by status, set a date range, or sort the list.

**View a form** — click the eye icon to open a detail modal with sharing options (copy link, download QR, share via WhatsApp, LinkedIn, or email).

**Edit a form** — click the pencil icon to open the form editor. The same 3-step interface as the builder opens pre-populated with the existing data.

**Toggle active/inactive** — click the toggle icon to close or reopen a form to new submissions. Guests visiting a deactivated form's link see a "no longer active" message.

**Delete a form** — click the delete icon. A confirmation modal appears before anything is removed.

### Technical Detail

- `getAllForms(tenantId)` and `getAllResponses(tenantId)` run in parallel (both with 10-second timeout via `useWithTimeout`)
- Response counts per form are computed client-side by grouping `feedback-responses` by `formId`
- `FilterSortBar` drives the filter state — text search, status pills, date range, and sort field/direction
- Edit uses `FeedbackFormEditor` (same UI as builder, but calls `updateForm()` / `updateDoc` — does not increment `formCount`)
- Toggle active: `deactivateForm()` / `reactivateForm()` update the `isActive` field only
- Delete: `deleteForm()` removes the `feedback-forms` document (responses are NOT deleted automatically)

---

## 5. Public Feedback Form

### Business Overview

The public feedback form is what guests see when they follow a form link or scan a QR code. It applies the organisation's branding, shows the form's questions, and submits the response. No account or login is required. The form prevents duplicate submissions from the same device.

### How to use it

Guests simply open the link or scan the QR code, answer the questions, and click Submit. A confirmation screen is shown on successful submission.

### Technical Detail

**Question types rendered:**
- **Rating** — 5 numbered circles (1–5). Tapping selects that rating.
- **Text** — multi-line textarea, capped at 256 characters
- **Multiple Choice (single)** — radio buttons; one option can be selected
- **Multiple Choice (multi-select)** — checkboxes; minimum selection count enforced if set
- **"Others" option** — any multiple-choice question can include an "Others" option that, when selected, reveals a text input for a free-text answer

**Display modes:**
- **All at once** — all questions are shown on a single page
- **Step-by-step** — one question per screen with forward/back navigation and a progress indicator

**Duplicate prevention:**
1. Check `localStorage` for `submitted_{formId}` — if present, show the "already submitted" screen immediately with no network call
2. If no localStorage entry → query Firestore `hasIpSubmittedForm()` to check whether the visitor's IP has already submitted

**On submit:**
1. `isOnline` check — rejects immediately if offline
2. reCAPTCHA v3 token generated and verified server-side
3. `timeSpentSeconds` computed from page load time
4. `computeAllTags()` runs to generate all response tags
5. Response written to `feedback-responses`
6. If the response has a negative sentiment tag or any custom tag, `POST /api/notify-negative` is called (non-blocking)
7. `localStorage.setItem('submitted_{formId}', '1')` to prevent future duplicates
8. Animated "Thank You" screen shown

---

## 6. Auto-Tagging

### Business Overview

Every submitted response is automatically labelled with tags. These tags categorise how the guest felt (sentiment), how long it took them to complete the form (time), whether they answered all required questions (completion), and any custom criteria the organisation has defined.

These tags appear on each response in the dashboard and drive the analytics charts.

### How tags are applied

Tags are computed client-side at the moment of submission using `src/lib/tagEngine.ts`. There are four tag types:

**Time tag** — based on `timeSpentSeconds`:
| Time taken | Tag | Colour |
|---|---|---|
| Under 60 seconds | Fast (<1 min) | Green |
| 60 – 300 seconds | Normal (1–5 min) | Blue |
| Over 300 seconds | Slow (>5 min) | Yellow |

**Sentiment tag** — based on the average of all numeric (rating) question answers:
| Average rating | Tag | Colour |
|---|---|---|
| 4.0 or above | Positive | Green |
| 2.5 – 3.99 | Neutral | Yellow |
| Below 2.5 | Negative | Red |
| No rating questions answered | No Rating | Gray |

**Completion tag** — based on required questions answered:
| Result | Tag | Colour |
|---|---|---|
| All required questions answered | Complete | Green |
| Some required questions skipped | Partial (n/total) | Yellow |

**Custom tags** — defined by the organisation on the form:
- Each rule has a label and colour
- Rules use AND logic — all conditions in the rule must match for the tag to be applied
- Operators: `contains`, `equals`, `less_than`, `greater_than`
- If any custom tag matches, `POST /api/notify-negative` is triggered regardless of sentiment

### Technical Detail

```typescript
// Called at submission time
computeAllTags(responses, form, timeSpentSeconds)
  → computeTimeTag(timeSpentSeconds)
  → computeSentimentTag(responses)        // averages all number values in responses map
  → computeCompletionTag(responses, form) // checks form.questions where required === true
  → computeCustomTags(responses, rules)   // evaluates each CustomTagRule

// Notification trigger
isNegativeResponse(tags)  // true if any tag has type='sentiment' and label='Negative'
hasCustomTags(tags)        // true if any tag has type='custom'
// Either condition → POST /api/notify-negative
```

---

## 7. Responses

### Business Overview

The responses page shows every submission the organisation has received in an expandable table. Each row shows which form the response belongs to, when it was submitted, the guest's country and city, the tags assigned, and how long it took. Clicking a row expands it to show the full question-and-answer detail.

Responses can be filtered by form, tag type, date range, and text search. The filtered results can be exported to an Excel file.

### How to use it

Go to Dashboard → Responses.

- **Search** — type in the search bar to filter by form title, country, or city
- **Filter by tag type** — click Sentiment, Time, Completion, or Custom to show only responses with that tag type
- **Filter by form** — use the form selector dropdown
- **Filter by date** — set a date range for the submission date
- **Sort** — click the sort controls to order by date, form name, country, or time spent
- **Expand a row** — click any row to see the full responses for each question, plus visitor IP and ISP in small text
- **Export** — click the Export button to download the current filtered view as an `.xlsx` file (button is disabled when there are no results)

The page pre-filters to a specific form when navigated to from a "View Responses" link elsewhere in the dashboard (via the `?formId=` query parameter).

### Technical Detail

- Uses `ResponsesTable` component built on **TanStack Table v8** for sorting and row expansion
- `getAllForms(tenantId)` and `getAllResponses(tenantId)` run in parallel with a 10-second timeout
- `FeedbackFilterBar` handles the filter state specific to responses (separate from the generic `FilterSortBar`)
- Export calls `exportToExcel(filteredResponses, forms)` from `src/lib/exportToExcel.ts`, which uses SheetJS to build and download an `.xlsx` file
- The `?formId=` query param is read on mount to pre-populate the form filter

---

## 8. Analytics

### Business Overview

The analytics page shows tag trends over time as an interactive line chart. Each line represents a tag label, and the x-axis represents time. This lets an organisation see, for example, whether negative sentiment has been increasing or whether fast response times are trending up at a particular location.

### How to use it

Go to Dashboard → Analytics.

1. Choose a **tag type**: Sentiment, Time, Completion, or Custom
2. Choose a **granularity**: Daily, Weekly, or Monthly
3. Optionally filter by a specific **form**
4. Set a **date range**
5. The chart updates immediately — each line is a unique tag label
6. Summary pills below the chart show the total count for each label in the selected range

The page pre-filters to a specific form when navigated to from a "View Analytics" link (via `?formId=`).

### Technical Detail

- Chart is rendered using **Recharts `LineChart`**
- One line per unique tag label within the selected tag type
- Buckets are keyed by:
  - Daily: `"2026-06-10"`
  - Weekly: `"2026-W23"`
  - Monthly: `"2026-06"`
- `fillBuckets()` ensures the x-axis is continuous — days/weeks/months with zero responses are included as zero values, preventing gaps in lines
- `FormAnalyticsPanel` component handles the chart rendering and summary pills
- `useFeedbackFilters` hook manages shared filter state between analytics and responses pages
- `getAllForms` and `getAllResponses` run with 10-second timeout via `useWithTimeout`

---

## 9. Settings

### Business Overview

The Settings page is where an organisation configures everything about how the platform looks and behaves for their account. Changes here affect all forms and all users within the organisation.

### How to use it

Go to Dashboard → Settings. The page is divided into sections:

**Branding**
- Upload a logo (JPEG, PNG, or WebP, max 5 MB)
- Set a brand colour using the colour picker or by typing a hex code — a preview button shows how it will look
- Set an email display name (shown as the sender name in notification emails)
- Click Save to apply

**Locations**
- Add the branches or locations that forms can be assigned to
- Click the remove button next to any location to delete it
- Click Save to apply
- Location names have a maximum of 80 characters and must be unique

**Notifications**
- Add email addresses that should receive an alert when negative or flagged feedback comes in
- Click Save to apply

**SEO & Open Graph** _(visible only if enabled for the organisation's plan)_
- Set the site URL, site name, default meta description, and default social share image
- These values populate the `<title>` tag, Open Graph tags, and Twitter Card tags across all pages for this organisation
- Click Save to apply

**Employees** _(visible only if enabled for the organisation's plan)_
- Search the employee list by name, email, or role
- Add individual employees using the form
- Edit existing records inline
- Toggle active/inactive status per employee
- Delete an employee with a confirmation prompt
- Import employees in bulk by uploading a `.csv` file with at least `Employee` and `Email` columns

**Danger Zone**
- "Delete All Responses" permanently deletes every response document for this organisation
- A confirmation modal must be accepted before deletion proceeds
- This action is irreversible

### Technical Detail

| Section | Firestore write target |
|---|---|
| Branding | `tenants/{tenantId}` via `updateTenant()` |
| Locations | `tenant-settings/{tenantId}/config/locations` via `setDoc` |
| Notifications | `tenant-settings/{tenantId}/config/notifications` via `setDoc` |
| SEO | `tenant-settings/{tenantId}/config/seo` via `setDoc` |
| Employees (add/edit) | `employees/{employeeId}` |
| Employees (import) | `POST /api/import-employees` (bulk write) |
| Delete All Responses | Batch delete of all `feedback-responses` where `tenantId == tenantId` |

Logo and OG image uploads use the `ImageUpload` component with the Cloudinary signed upload flow (see [02-architecture.md](./02-architecture.md#6-branding-system)).

---

## 10. Profile

### Business Overview

The profile page lets each admin manage their own personal account details: their display name, profile photo, and password.

### How to use it

Go to Dashboard → Profile (click your name or avatar in the top navigation).

- **Profile photo** — click the upload area, select an image, and it saves automatically
- **Display name** — edit the field and click Save
- **Email address** — shown as read-only (cannot be changed)
- **Change password** — enter your current password, then enter and confirm the new password, then click Save. reCAPTCHA verification runs silently before the change is applied.

### Technical Detail

- Profile photo: uploaded to Cloudinary (`{tenantId}/profiles`), then saved to both `Firebase Auth photoURL` and `tenant-admins/{uid}.photoUrl`
- Display name: `updateProfile(auth.currentUser, { displayName })` — max 50 chars, sanitized
- Password change: `reauthenticateWithCredential(user, EmailAuthProvider.credential(email, currentPassword))` → reCAPTCHA verification → `updatePassword(user, newPassword)`

---

## 11. Super Admin

### Business Overview

The Super Admin page (`/super-admin`) is only accessible to Inan Management Ltd staff with super admin privileges. It provides a full view of all organisations on the platform and allows platform-level management without requiring access to any organisation's own credentials.

### How to use it

Navigate to `/super-admin` while logged in as a super admin user.

**Viewing organisations** — all tenants are listed with their name, ID, domain, plan, status, and form counts.

**Adding a new organisation:**
1. Click "+ Add Tenant"
2. Fill in: Tenant ID (a unique slug), display name, domain, optional email domain, plan, form limit, nomination form limit
3. Toggle feature flags as needed
4. Click "Create Tenant"

**Editing an organisation:**
- Click the pencil icon on any tenant card
- Update name, domain, email domain, plan, limits, or feature flags
- Click "Save Changes"

**Activating / deactivating:**
- Click the toggle icon to switch between `active` and `inactive` status

**Impersonating an organisation:**
- Click the eye icon to enter that organisation's dashboard as if you were their admin
- A yellow banner appears at the top of the dashboard confirming impersonation
- Navigate back to `/super-admin` or use the "Stop Impersonating" action to return

### Technical Detail

- Access is protected by a `superAdmin` custom claim check on page load — users without the claim are redirected to `/dashboard`
- `getAllTenants()` reads all documents in the `tenants` collection (permitted only to super admins by Firestore rules)
- Tenant creation: `saveTenant(tenant)` writes to `tenants/{tenantId}` — does not create Firebase Auth users or set claims (those happen at user registration)
- Impersonation: `POST /api/impersonate` sets an HttpOnly cookie — see [02-architecture.md § Super Admin Impersonation](./02-architecture.md#6-super-admin-impersonation) for full flow
- Feature flags are toggled via checkboxes and saved as part of the `features` object on the tenant document

---

## 12. Offline Resilience

### Business Overview

The platform is designed to handle unreliable network connections gracefully. If a user loses internet access while using the dashboard or the public form, they are informed clearly and protected from losing data or submitting incomplete requests.

### What users see

- A dark banner slides down from the top of the screen when internet is lost, showing a pulsing red dot and the message "You're offline"
- When the connection returns, the banner switches to green and shows "Back online" for 2.5 seconds, then disappears
- Any button click while offline is blocked — a "No internet connection" hint fades in below the button
- If the dashboard data takes more than 10 seconds to load, a "Taking longer than expected" message appears with a Retry button
- The public feedback form shows an error message and blocks submission if the guest is offline

### Technical Detail

Four layers work together:

**Layer 1 — `OfflineBanner` component**
- Mounted globally in `src/app/layout.tsx`
- Subscribes to `window` `online`/`offline` events via `useNetworkStatus`
- `useNetworkStatus` also exposes a `justReconnected` flag (true for 2.5 seconds after reconnection)

**Layer 2 — `useWithTimeout` hook**
- Wraps every Firestore fetch on dashboard data pages
- Default deadline: 10 seconds
- On timeout: renders a retry UI instead of an infinite loading skeleton
- Applied to: `dashboard/page.tsx`, `feedback/forms/page.tsx`, `feedback/responses/page.tsx`, `feedback/analytics/page.tsx`

**Layer 3 — `Button` component guard**
- Every `Button` in the app calls `useNetworkStatus` internally
- If offline, the `onClick` handler is intercepted and replaced with a timed hint message
- The actual action is never executed while offline

**Layer 4 — `FeedbackForm` submit guard**
- The `onSubmit` handler in the public form checks `isOnline` as its first step
- If offline, an inline error is shown immediately — no network calls are attempted
