# 06 — Reference

**Part of:** [INAN Feedback Technical Manual](./TECHNICAL_MANUAL.md)

---

## Table of Contents

1. [API Routes](#1-api-routes)
2. [Component Library](#2-component-library)
3. [Custom Hooks](#3-custom-hooks)
4. [Utility Libraries](#4-utility-libraries)
5. [TypeScript Types](#5-typescript-types)
6. [Known Constraints & Limits](#6-known-constraints--limits)

---

## 1. API Routes

All routes are under `src/app/api/`. Routes that require no authentication rely on the middleware-injected `x-tenant-id` header for tenant scoping. Routes that require a super admin validate the Firebase ID token passed as a `Bearer` token in the `Authorization` header.

| Route | Method | Auth required | Description |
|---|---|---|---|
| `/api/tenant/current` | GET | None | Resolves the current tenant from the incoming domain or impersonation cookie. Returns the full tenant document if found. |
| `/api/add-tenant-user` | POST | None (trusts middleware header) | Creates a `tenant-admins` document and sets the `tenantId` custom claim for a newly registered user on an existing tenant. |
| `/api/register-tenant` | POST | None | Creates a new `tenants` document, a `tenant-admins` document, sets the `tenantId` claim, and sends a registration confirmation email. |
| `/api/verify-recaptcha` | POST | None | Accepts a reCAPTCHA v3 token, verifies it with Google's API, and returns success/failure. Used before feedback submissions and password changes. |
| `/api/cloudinary/sign` | POST | None | Returns a signed upload payload (`signature`, `timestamp`, `cloudName`, `apiKey`, `folder`) for direct browser-to-Cloudinary uploads. The `CLOUDINARY_API_SECRET` is never sent to the client. |
| `/api/cloudinary/delete` | POST | None | Accepts a Cloudinary image URL, extracts the `public_id`, and calls `cloudinary.uploader.destroy()` to delete the image. |
| `/api/welcome-email` | POST | None | Sends the one-time welcome email via Resend. Checks `tenant-admins/{uid}.welcomeSent` before sending — fires exactly once per user lifetime. Sets `welcomeSent: true` after sending. |
| `/api/notify-negative` | POST | None | Sends a negative feedback alert email to all addresses in `tenant-settings/{tenantId}/config/notifications`. Triggered when a response has a negative sentiment tag or any custom tag. |
| `/api/impersonate` | POST | Super admin Bearer token | Sets the `sa-impersonate` HttpOnly cookie to the requested `tenantId`. Validates the `superAdmin` claim before setting. |
| `/api/impersonate` | DELETE | Super admin Bearer token | Clears the `sa-impersonate` cookie, ending the impersonation session. |
| `/api/import-employees` | POST | Firebase ID token | Accepts bulk employee data and writes it to the `employees` collection scoped to the authenticated user's tenant. |

---

## 2. Component Library

All reusable components are in `src/components/`. Each entry below includes a one-line description and notes on any non-obvious behaviour.

| Component | Description |
|---|---|
| `AuthGuard` | Wraps all dashboard routes. Subscribes to `onAuthStateChanged` — redirects to `/login` if no user, shows `EmailVerification` if user is not email-verified, renders children if verified. |
| `BrandProvider` | Reads `tenant.branding.primaryColor` from `TenantContext` and sets the `--brand` CSS custom property on `<html>`. Defaults to `#7C3AED`. Renders nothing visible. |
| `Button` | Standard button with loading state (`isLoading` / `loadingText`), offline guard (blocks click and shows hint when offline), variant support, and `fullWidth` toggle. |
| `CountdownTimer` | Renders a countdown to a target date/time. Used in survey window UI. Accepts a target timestamp and formats remaining time as days, hours, minutes, seconds. |
| `CreateAccountModal` | Registration modal shown from the login page. Handles Firebase user creation, `POST /api/add-tenant-user`, email verification send, and sign-out. Cleans up orphaned Auth accounts if the API call fails. |
| `DashboardHeader` | Top navigation bar. Shows the organisation name/logo, the logged-in user's name and avatar, and the mobile menu trigger. Displays impersonation warning banner when `isImpersonating` is true. |
| `DashboardLayout` | Full dashboard shell: sidebar + header + main content area. Also triggers the one-time welcome email on first verified login by calling `POST /api/welcome-email`. |
| `EmailVerification` | Screen shown when a user is logged in but has not verified their email. Displays instructions and a link back to the login page. Rendered by `AuthGuard`. |
| `FeedbackFilterBar` | Filter controls specific to the responses and analytics pages. Manages form selector, tag type filter, date range, and text search for feedback data. Separate from the generic `FilterSortBar`. |
| `FeedbackForm` | Public form renderer. Handles both all-at-once and step-by-step display modes, all four question types, the "Others" free-text option, duplicate detection, reCAPTCHA, tag computation, and the thank-you screen. |
| `FeedbackFormBuilder` | 3-step form creation wizard (Details → Questions → Logic Tags → QR success screen). Manages draft persistence in `sessionStorage`. |
| `FeedbackFormEditor` | Edit-in-place modal wrapping the same 3-step UI as `FeedbackFormBuilder`, pre-populated with existing form data. Calls `updateForm()` instead of `saveForm()`. |
| `FeedbackFormsList` | Filterable list of all tenant forms with view, edit, toggle, and delete actions per form card. |
| `FilterSortBar` | Generic reusable filter bar with text search, status pills, date range picker, and sort field/direction selector. Uses a staged-filter pattern — filter state is only applied when the user confirms or on a short debounce. |
| `FormAnalyticsPanel` | Renders the Recharts `LineChart` for the analytics page. Handles bucket filling (continuous x-axis), line-per-tag-label rendering, and summary count pills. |
| `ImageUpload` | Cloudinary signed upload component with image preview, remove button, file type validation (JPEG/PNG/WebP), and 5 MB size limit. Calls `POST /api/cloudinary/sign` before upload and `POST /api/cloudinary/delete` on remove. |
| `Input` | Styled text input and `<select>` wrapper with consistent border, focus ring, and label layout. |
| `Modal` | Reusable dialog component. Supports `size` (`sm` / `md` / `lg`), optional footer (`hideFooter`), confirm/cancel callbacks, and a custom title. |
| `OfflineBanner` | Floating pill that slides down from the top of the screen when offline (pulsing red dot) and shows a "Back online" state for 2.5 seconds on reconnection. Mounted globally in `src/app/layout.tsx`. |
| `RecaptchaProvider` | Wraps `GoogleReCaptchaProvider` from `react-google-recaptcha-v3`. Mounted in both the root layout and the dashboard layout so reCAPTCHA is available on public and authenticated pages. |
| `ResponsesTable` | Responses data table built on **TanStack Table v8**. Supports column sorting and row expansion (click a row to see full question/answer detail and visitor metadata). |
| `Sidebar` | Collapsible navigation sidebar. Shows navigation links, the current organisation name, and a logout button. Collapses to icon-only mode on smaller screens. |
| `Skeleton` | Set of loading-state placeholder components. Variants for stat cards, table rows, form cards, and chart areas. Used on all data-fetching dashboard pages while `useWithTimeout` resolves. |
| `Toast` | Notification toast system. Renders in the bottom-right corner, auto-dismisses after 3 seconds, supports `success` / `error` / `info` types, and can be manually dismissed. |

---

## 3. Custom Hooks

All hooks are in `src/hooks/`.

| Hook | Returns | Description |
|---|---|---|
| `useNetworkStatus` | `{ isOnline, justReconnected }` | Subscribes to `window` `online`/`offline` events. `justReconnected` is `true` for 2.5 seconds after the connection returns. Used by `OfflineBanner` and `Button`. |
| `useToast` | `{ toasts, showToast, dismissToast }` | Manages an array of active toast messages. `showToast(message, type)` adds a toast; `dismissToast(id)` removes it. Toasts auto-dismiss after 3 seconds. |
| `useWithTimeout` | `(asyncFn, timeoutMs?) => Promise` | Wraps an async function with a deadline (default: 10 000 ms). If the wrapped call does not resolve before the deadline, the promise rejects with a timeout error. Used on all data-fetching dashboard pages. |
| `useFeedbackFilters` | Filter state object + setters | Manages shared filter and date range state between the responses and analytics pages. Includes date range presets (today, last 7 days, last 30 days, custom). |

---

## 4. Utility Libraries

All utilities are in `src/lib/`.

| File | Description |
|---|---|
| `firebase.ts` | Initialises the Firebase client SDK (`auth`, `db`). Called once at startup; subsequent imports use the cached instance. |
| `firebaseAdmin.ts` | Initialises the Firebase Admin SDK using `FIREBASE_ADMIN_*` environment variables. Exports `getAdminDb()` and `getAdminAuth()`. Only runs server-side. |
| `firestore.ts` | Core Firestore CRUD helpers: `saveForm`, `updateForm`, `deleteForm`, `getAllForms`, `getAllResponses`, `submitFeedback`, `getFormById`, `hasIpSubmittedForm`, `incrementFormCount`. All queries include `tenantId` filtering. |
| `tenantFirestore.ts` | Tenant-specific operations: `getAllTenants`, `saveTenant`, `updateTenant`, `getTenantByDomain`. Used by `TenantContext`, the super-admin page, and API routes. |
| `employeesFirestore.ts` | Employee CRUD: `getAllEmployees`, `addEmployee`, `updateEmployee`, `deleteEmployee`, `getEmployeeById`. All operations scoped to `tenantId`. |
| `tagEngine.ts` | Pure functions for computing response tags. See [04-features.md § Auto-Tagging](./04-features.md#6-auto-tagging) for threshold values. Exports: `computeTimeTag`, `computeSentimentTag`, `computeCompletionTag`, `computeCustomTags`, `computeAllTags`, `isNegativeResponse`, `hasCustomTags`. |
| `sanitize.ts` | Input sanitization utilities: `sanitizeText(input)` strips HTML and dangerous characters; `sanitizeEmail(input)` normalises and validates email format; `sanitizeAndLimit(input, maxLen)` sanitizes and trims to a character limit. |
| `exportToExcel.ts` | Builds and triggers an `.xlsx` download using SheetJS. `exportToExcel(responses, forms)` flattens response data into rows and writes the file. |
| `visitorInfo.ts` | Calls `ipapi.co` to resolve a visitor's city, region, country, and ISP from their IP address. Called client-side when the public feedback form loads. Non-blocking — failure is silently ignored. |

---

## 5. TypeScript Types

All shared types are in `src/types/index.ts`.

| Type / Interface | Description |
|---|---|
| `Tenant` | Full organisation document shape, including `branding`, `features`, `plan`, `status`, and the `nominationFormLimit`/`nominationFormCount` fields (reserved for future use) |
| `TenantFeatures` | Feature flag object: `feedbackForms`, `employeeRecords`, `seoSettings`, `hidePoweredBy` |
| `FeedbackForm` | Feedback form document shape |
| `FeedbackQuestion` | Individual question shape within a form |
| `FeedbackResponse` | Response submission document shape, including visitor metadata and tags |
| `ResponseTag` | Single tag: `label`, `type`, `color` |
| `CustomTagRule` | Auto-tag rule with multi-condition `conditions` array and legacy `condition` fallback |
| `SeoSettings` | SEO config document shape |
| `SurveySettings` | Survey window config: `startDate`, `endDate`, `isActive`, `bannerImageUrl` |
| `LocationSettings` | `{ locations: string[] }` |
| `NotificationSettings` | `{ emails: string[] }` |
| `Employee` | Employee record shape |
| `User` | Legacy stub — not actively used in the current codebase |
| `Category` | Legacy stub — not actively used in the current codebase |

---

## 6. Known Constraints & Limits

| Constraint | Value | Configurable |
|---|---|---|
| Maximum feedback forms per tenant | Stored in `tenant.formLimit` (default: 5) | Yes — editable by super admin in `/super-admin` |
| Form title max length | 100 characters | No |
| Form description max length | 500 characters | No |
| Question text max length | 200 characters | No |
| Multiple choice option text max length | 100 characters | No |
| Text response answer max length | 256 characters | No |
| Location name max length | 80 characters | No |
| Profile display name max length | 50 characters | No |
| SEO description length (UI indicator) | 160 characters shown in UI | No (storage allows up to 300 chars) |
| Image upload max size | 5 MB | No |
| Allowed image types | JPEG, PNG, WebP | No |
| Dashboard request timeout | 10 seconds | Code-level — `useWithTimeout` default |
| Welcome email fires | Once per user lifetime | Enforced by `welcomeSent` flag on `tenant-admins` document |
| reCAPTCHA verification | On every feedback submission and password change | No |
| One response per device per form | Enforced via localStorage flag + Firestore IP check | No |
| Firebase ID token expiry | 1 hour (auto-refreshed by client SDK) | Firebase platform setting |
| Custom claims propagation delay after script change | Up to 1 hour, or sign out and back in | Firebase platform behaviour |
