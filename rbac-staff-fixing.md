# Prompt for Kiro — Fix Staff-Role RBAC Leak on Feedback Form Visibility

## Context

Repo: https://github.com/ibidiuntold/inan-feedback/tree/main
Stack: Next.js 14 (App Router), TypeScript, Firebase Auth + Cloud Firestore, Tailwind.

Existing tenant isolation (documented) works like this:
- `middleware.ts` resolves `tenantId` from domain and injects `x-tenant-id`.
- `AuthGuard` (client component) waits on `onAuthStateChanged`, redirects if unauthenticated, blocks if unverified.
- `TenantContext` waits on `user.getIdTokenResult()`, reads `claims.tenantId`, then loads `tenants/{tenantId}`.
- Firestore rules enforce `request.auth.token.tenantId == resource.data.tenantId` on `feedback-forms` and `feedback-responses`.

We are now adding a **Staff role layer inside a tenant**: not every authenticated tenant user should see every form. A user relegated to a "Staff" role should only ever see feedback forms **they personally created** — not the full tenant-wide form list that Supervisors and Admins see. Supervisors have the same visibility as Admins (full tenant-wide list, no restriction) — only Staff is restricted.

## The Bug

On initial page load, users with the Staff role briefly see (or the client briefly fetches) feedback forms they did **not** create, before the role/ownership scoping check finishes resolving. This is the same "flash of unauthorized content" class of bug that affects `TenantContext`'s claim resolution today, except here it's a second, unscoped role check layered on top, and it isn't happening early enough.

## Step 0 — Before changing anything, confirm the real schema (do not assume)

I don't have direct access to this private repo, so the plan below is based on the documented architecture only. Before writing any code, read and report back on:

1. **`firestore.rules`** — the current rules for `feedback-forms` and `feedback-responses`. Confirm exactly what's enforced today (I believe it's only `tenantId` matching, per the docs, but verify).
2. **`tenant-admins/{uid}` schema** and any Firebase custom claims currently set (`tenantId`, `superAdmin`) — confirm whether a `role` field already exists anywhere, or whether this is being introduced fresh. If fresh, propose where it should live (Firestore field vs. custom claim) and flag the tradeoff: custom claims can take up to an hour to propagate after a change (this is a documented constraint in this codebase already), which matters if a user's role changes at runtime — a Firestore-field-based role check (read via `get()` in the rule) avoids that staleness but costs an extra document read per rule evaluation.
3. **`feedback-forms/{formId}` schema** — confirm there is genuinely no `createdBy`/`ownerId`/`createdByUid` field today (the documented schema doesn't have one). If none exists, this fix requires adding one.
4. **Wherever `saveForm()` writes** a new form — confirm it does not currently capture `request.auth.uid`.

Report what you find before proceeding to the fix below, and flag anywhere reality differs from this plan so we can adjust before you write code.

## Root Cause To Investigate

1. Wherever the Staff role is currently read is likely being resolved **after** `getAllForms(tenantId)` fires, so the full tenant list renders (or is fetched) first and is filtered/hidden afterward on the client — not restricted at query time or enforced by a rule.
2. There is currently **no Firestore Security Rule** restricting `feedback-forms` reads to forms a Staff user created — only the existing `tenantId` match. Even if the UI is fixed, a Staff user's client SDK could still directly read another form document in the same tenant, because the rule permits any authenticated user with a matching `tenantId` claim to read.

## Required Fix (three layers — do not do only one)

### 1. Schema — add ownership to `feedback-forms`

- Add a `createdBy` field (Firebase Auth `uid` of the creator) to the `feedback-forms` document shape, set once at creation time inside `saveForm()`, alongside the existing `tenantId` stamp. Never updated after creation (same immutability convention as `tenantId`).
- Write a one-time backfill script for existing forms with no `createdBy`, following the same pattern as `scripts/migrate-to-tenant.js`. Decide with me what existing forms without a known creator should default to — likely visible only to Admins/Supervisors, not claimed by any Staff user, until manually reassigned.

### 2. Data layer — Firestore Security Rules (primary fix, do this after Step 0 confirms the rule syntax/paths)

- Update `firestore.rules` so `feedback-forms` reads are deny-by-default and require:
  - `request.auth.token.tenantId == resource.data.tenantId` (existing, unchanged), **and**
  - if the requesting user's role is `staff`: additionally `resource.data.createdBy == request.auth.uid`.
  - Admins and Supervisors keep the existing unrestricted tenant-wide read — no ownership check for them.
- Apply the same ownership check to `feedback-responses` reads if Staff can view responses tied to their own forms (confirm with me whether Staff can see responses at all, or only manage their own forms).
- Add/update Firestore emulator tests asserting a Staff user cannot read a `feedback-forms` document they didn't create, even via a direct `getDoc()` call that bypasses the app's own query filter.

### 3. Query layer — scope the fetch itself, not just the render

- Update whichever function currently powers `getAllForms(tenantId)` so that for a Staff-role caller, the Firestore query itself includes `where('createdBy', '==', uid)` — do not fetch the full tenant list and filter client-side.

### 4. UI layer — eliminate the flash-of-unauthorized-content window

- Extend the existing `AuthGuard` / `TenantContext` resolution pattern (don't invent a parallel mechanism) so the user's `role` resolves as part of the same gate that currently blocks rendering until `tenantId` is known. Nothing under the forms list/dashboard route should render real form data until role + tenantId have both resolved — show the existing `Skeleton` component during that window, consistent with the current `useWithTimeout` loading pattern.
- Confirm this applies to every entry point that lists or links to forms — the main Forms List, Dashboard Overview quick-action links, and any `?formId=`-based deep link into Responses/Analytics — not just the primary Forms List page.

## Constraints

- Do not weaken the existing `tenantId` isolation — only add the ownership restriction on top, and only for Staff.
- Keep the fix consistent with the existing claims/document pattern already used for `tenantId` and `superAdmin` — don't introduce a second, inconsistent auth mechanism unless Step 0 shows there's a good reason to.
- Preserve Super Admin impersonation behavior — an impersonating Super Admin should see what an Admin/Supervisor sees for that tenant, unrestricted by Staff-ownership scoping.

## Deliverables

1. Findings from Step 0 (what the schema and rules actually look like today), before any code changes.
2. A short written plan of exactly which files/rules you intend to touch, based on those findings.
3. Updated `firestore.rules` with the ownership-scoped Staff rule.
4. The `createdBy` field added to `feedback-forms`, `saveForm()` updated to set it, and a backfill script for existing forms.
5. Updated query function(s) (e.g. in `src/lib/firestore.ts`) to filter at query time for Staff role.
6. Updated `AuthGuard`/`TenantContext` (or a new lightweight hook, if cleaner — flag it if you introduce one rather than extending the existing pattern) so role resolves before any form data renders.
7. Emulator/unit tests proving a Staff user cannot read or list a form they didn't create, both through the app's UI and through a direct Firestore call.
8. A one-paragraph summary of what changed and why, plus any follow-up items, for the Change Log in the Staff Documentation Manual.