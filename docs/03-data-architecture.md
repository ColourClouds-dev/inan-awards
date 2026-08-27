# 03 — Data Architecture

**Part of:** [INAN Feedback Technical Manual](./TECHNICAL_MANUAL.md)

---

## Table of Contents

1. [Business Overview](#1-business-overview)
2. [Collections at a Glance](#2-collections-at-a-glance)
3. [Collection Schemas](#3-collection-schemas)
4. [Security Rules](#4-security-rules)

---

## 1. Business Overview

### Where is data stored?

All application data is stored in **Cloud Firestore**, Google's NoSQL cloud database. There is no traditional SQL database. Data is organised into "collections" — think of each collection as a table, and each document inside it as a row.

### How is each organisation's data kept separate?

Every document in every collection carries a `tenantId` field — a short identifier for the organisation it belongs to (for example, `"inan"`). All queries filter by this field, and the database's own security rules enforce it independently. An admin from one organisation cannot access another's data even if they knew the exact document address.

### What data is stored?

| Collection | What it holds |
|---|---|
| `tenants` | One document per organisation — configuration, plan, branding, limits |
| `tenant-admins` | One document per user — maps a user to their organisation and role |
| `tenant-settings` | Per-organisation configuration sub-documents (locations, notifications, SEO) |
| `feedback-forms` | One document per feedback form |
| `feedback-responses` | One document per submitted response |
| `employees` | One document per employee record |
| `polls` | One document per employee poll or staff nomination |
| `poll-responses` | One document per poll submission (captures all answers in one response) |
| `poll-votes` | One document per individual question-level vote (used for results aggregation) |

---

## 2. Collections at a Glance

```
tenants/
  {tenantId}                    ← one per organisation

tenant-admins/
  {uid}                         ← one per user account

tenant-settings/
  {tenantId}/
    config/
      locations                 ← list of branch/location names
      notifications             ← alert email addresses
      seo                       ← SEO and Open Graph settings
      survey                    ← survey window settings (start/end date, banner)

feedback-forms/
  {formId}                      ← UUID, one per form

feedback-responses/
  {responseId}                  ← auto-generated ID, one per submission

employees/
  {employeeId}                  ← one per employee record

polls/
  {pollId}                      ← auto-generated ID, one per poll

poll-responses/
  {responseId}                  ← auto-generated ID, one per poll submission

poll-votes/
  {voteId}                      ← auto-generated ID, one per question-level vote
```

---

## 3. Collection Schemas

> **For developers.** Field tables below use `?` to mark optional fields.

### 3.1 `tenants/{tenantId}`

Stores the full configuration for one organisation.

| Field | Type | Description |
|---|---|---|
| `id` | string | Organisation slug, e.g. `"inan"`. Used as the document ID and in all queries. |
| `name` | string | Display name, e.g. `"Inan Hotels"` |
| `domain` | string | Primary domain, e.g. `"feedback.inan.com.ng"` |
| `emailDomain` | string? | Email domain used for validation, e.g. `"inan.com.ng"` |
| `plan` | string | `"trial"` / `"basic"` / `"pro"` |
| `status` | string | `"active"` / `"inactive"` / `"trial"` |
| `formLimit` | number | Maximum feedback forms allowed (set by super admin) |
| `formCount` | number | Current number of forms created (auto-incremented) |
| `nominationFormLimit` | number? | Maximum nomination forms allowed (reserved for future use) |
| `nominationFormCount` | number? | Current nomination form count (reserved for future use) |
| `features` | object | Feature flags — see below |
| `branding` | object? | `{ primaryColor?, logoUrl?, emailDisplayName? }` |
| `createdAt` | Timestamp | Creation date |

**Feature flags (`features` object):**

| Flag | Default | What it controls |
|---|---|---|
| `feedbackForms` | `true` | Whether feedback form creation is enabled |
| `employeeRecords` | `false` | Whether the Employees section appears in Settings |
| `seoSettings` | `false` | Whether the SEO & Open Graph tab appears in Settings |
| `hidePoweredBy` | `false` | Whether the "Powered by Inan" footer badge is hidden |

---

### 3.2 `tenant-admins/{uid}`

Maps a Firebase Auth user UID to an organisation. Created automatically at registration or staff invitation.

| Field | Type | Description |
|---|---|---|
| `uid` | string | Firebase Auth UID — matches the document ID |
| `tenantId` | string | The organisation this user belongs to |
| `email` | string | User's email address |
| `role` | string | `"owner"` (displayed as "Admin" in the UI) or `"staff"` |
| `createdAt` | Timestamp | When the mapping was created |
| `welcomeSent` | boolean? | `true` once the one-time welcome email has been sent |
| `photoUrl` | string? | Cloudinary URL for the user's profile photo |
| `formCount` | number? | Number of forms this user has created (tracked per-user for staff limits) |
| `formLimit` | number? | Per-user form limit override — if set, takes precedence over the tenant-level `formLimit` |
| `invitedBy` | string? | UID of the owner who sent this user's invitation |
| `notificationEmails` | string[]? | Personal email addresses for negative feedback alerts (staff only — overrides org-level notification list for forms this user created) |
| `repairedAt` | Timestamp? | Set by repair scripts if the record was backfilled |

---

### 3.3 `tenant-settings/{tenantId}/config/{key}`

Sub-collection of per-organisation configuration. Each key is a separate document.

#### `locations`

| Field | Type | Description |
|---|---|---|
| `locations` | string[] | List of branch or location names available when creating forms |

#### `notifications`

| Field | Type | Description |
|---|---|---|
| `emails` | string[] | Email addresses that receive negative feedback alert emails |

#### `seo`

| Field | Type | Description |
|---|---|---|
| `siteUrl` | string | Canonical site URL used in metadata |
| `siteName` | string | Organisation name used in `<title>` and OG tags |
| `defaultDescription` | string | Default meta description (up to 300 chars in storage; UI shows 160-char indicator) |
| `ogImageUrl` | string? | Cloudinary URL for the default Open Graph image |

#### `survey`

| Field | Type | Description |
|---|---|---|
| `startDate` | Timestamp | When the survey window opens |
| `endDate` | Timestamp | When the survey window closes |
| `isActive` | boolean | Whether the survey is currently active |
| `bannerImageUrl` | string? | Optional banner image shown during the survey window |

---

### 3.4 `feedback-forms/{formId}`

One document per feedback form. The document ID is a UUID generated at creation time.

| Field | Type | Description |
|---|---|---|
| `id` | string | UUID — matches the document ID |
| `tenantId` | string | Owner organisation |
| `createdBy` | string? | Firebase Auth UID of the user who created the form. Set once at creation, never updated. Used to scope Staff users to their own forms. |
| `title` | string | Form title (max 100 chars) |
| `description` | string? | Optional rich-text description shown above questions (max 500 chars; stored as HTML from the RichTextEditor) |
| `location` | string | Branch or location name selected from tenant locations |
| `slug` | string? | Optional human-readable URL alias (e.g. `"guest-survey"`). Unique per tenant. Enables `/feedback/guest-survey` in place of `/feedback/{uuid}`. |
| `questions` | array | Array of `FeedbackQuestion` objects (see below) |
| `sections` | array? | Array of `FormSection` objects for grouping questions (see below) |
| `isActive` | boolean | `true` = form accepts submissions; `false` = form is closed |
| `stepByStep` | boolean? | If `true`, questions are shown one at a time instead of all at once |
| `collectName` | boolean? | If `true`, an optional name field is shown at the top of the form |
| `ogImageUrl` | string? | Cloudinary URL for the form's banner image (shown at top of public form and as social share image) |
| `customTagRules` | array? | Array of `CustomTagRule` objects for automatic response tagging |
| `createdAt` | Timestamp | Creation date |

**`FeedbackQuestion` object:**

| Field | Type | Description |
|---|---|---|
| `id` | string | UUID |
| `type` | string | `"rating"` / `"text"` / `"multiChoice"` |
| `question` | string | Question text (max 200 chars) |
| `required` | boolean | Whether an answer is required before submission |
| `options` | string[]? | Answer options for `multiChoice` questions |
| `multiSelect` | boolean? | `true` = checkboxes (multiple answers); `false` / omitted = radio (single answer) |
| `minSelections` | number? | Minimum number of selections when `multiSelect` is `true` |
| `sectionId` | string? | UUID of the `FormSection` this question belongs to (optional grouping) |

**`FormSection` object:**

| Field | Type | Description |
|---|---|---|
| `id` | string | UUID |
| `name` | string | Section heading shown above the grouped questions |
| `description` | string? | Optional rich-text description shown below the section heading |

**`CustomTagRule` object:**

| Field | Type | Description |
|---|---|---|
| `id` | string | UUID |
| `label` | string | Tag label displayed on the response |
| `color` | string | `"green"` / `"yellow"` / `"red"` / `"blue"` / `"gray"` |
| `conditions` | array? | Multi-condition array (AND logic) — preferred format |
| `condition` | object | Single condition — kept for backward compatibility with older rules |

Each condition in `conditions` (or the single `condition` object) has:

| Field | Type | Values |
|---|---|---|
| `questionId` | string | UUID of the question being evaluated |
| `operator` | string | `"contains"` / `"equals"` / `"less_than"` / `"greater_than"` |
| `value` | string | Value to compare against |

> **Note:** When evaluating a rule, the code checks `conditions` first. If `conditions` is present and non-empty, it is used. Otherwise it falls back to the legacy `condition` field. All conditions in `conditions` must match (AND logic) for the tag to be applied.

---

### 3.5 `feedback-responses/{responseId}`

One document per form submission. Document ID is auto-generated by Firestore.

| Field | Type | Description |
|---|---|---|
| `id` | string | UUID set by the client at submission time |
| `formId` | string | UUID of the parent form |
| `tenantId` | string | Owner organisation |
| `location` | string | Location copied from the form at submission time |
| `responses` | object | `{ [questionId]: string \| number }` — one entry per answered question |
| `submittedAt` | Timestamp | Submission time |
| `timeSpentSeconds` | number? | Seconds from page load to submit |
| `tags` | array? | Auto-computed `ResponseTag` objects (see below) |
| `visitorIp` | string? | Visitor's IP address |
| `visitorCity` | string? | Resolved city (from ipapi.co) |
| `visitorRegion` | string? | Resolved region |
| `visitorCountry` | string? | Resolved country |
| `visitorIsp` | string? | Resolved ISP |
| `visitorAccessedAt` | string? | ISO timestamp of when the guest first loaded the form |

**`ResponseTag` object:**

| Field | Type | Values |
|---|---|---|
| `label` | string | Tag display text |
| `type` | string | `"time"` / `"sentiment"` / `"completion"` / `"custom"` |
| `color` | string | `"green"` / `"yellow"` / `"red"` / `"blue"` / `"gray"` |

---

### 3.6 `employees/{employeeId}`

Employee records managed from the Settings page. Document ID is generated at creation.

| Field | Type | Description |
|---|---|---|
| `#` | number | Row display number |
| `Id` | number | Internal numeric ID |
| `Employee ID` | number \| string | HR system employee identifier |
| `Employee` | string | Full name |
| `Email` | string | Work email address |
| `Reporting To` | string | Manager's name |
| `Joining Date` | string | ISO date string |
| `Status` | string | `"Active"` / `"Inactive"` |
| `Role` | string? | Job title or role |
| `Employment Type` | string? | e.g. `"Full-time"`, `"Contract"` |
| `tenantId` | string | Owner organisation |

---

### 3.7 `polls/{pollId}`

One document per employee poll or staff nomination. Auto-generated Firestore ID.

| Field | Type | Description |
|---|---|---|
| `id` | string | Matches the Firestore document ID |
| `tenantId` | string | Owner organisation |
| `createdBy` | string | Firebase Auth UID of the creator |
| `title` | string | Poll title |
| `description` | string? | Optional description shown on the voting page |
| `type` | string | `"opinion"` — standard multi-question poll; `"staff_nomination"` — Staff of the Month voting |
| `questions` | array | Array of `PollQuestion` objects (see below) |
| `nominees` | string[]? | Array of Employee IDs eligible for nomination (`staff_nomination` type only) |
| `isActive` | boolean | `true` = poll is accepting votes |
| `allowMultipleVotes` | boolean? | Whether a voter can vote more than once |
| `showResults` | string | `"after_voting"` / `"always"` / `"never"` — controls when results are visible |
| `endDate` | Timestamp? | Optional poll closing date |
| `slug` | string? | Optional human-readable URL alias |
| `createdAt` | Timestamp | Creation date |

**`PollQuestion` object:**

| Field | Type | Description |
|---|---|---|
| `id` | string | UUID |
| `question` | string | Question text |
| `type` | string | `"single_choice"` / `"multiple_choice"` |
| `options` | string[] | Answer options |
| `maxSelections` | number? | Maximum selections for `multiple_choice` questions |
| `required` | boolean | Whether the question must be answered |

---

### 3.8 `poll-responses/{responseId}`

One document per voter submission. Captures all answers for one voter across all questions in the poll.

| Field | Type | Description |
|---|---|---|
| `pollId` | string | UUID of the parent poll |
| `tenantId` | string | Owner organisation |
| `voterUid` | string | Firebase Auth UID of the voter |
| `employeeId` | string? | Employee ID of the voter if they authenticated as an employee |
| `responses` | object | `{ [questionId]: string \| string[] }` — one entry per answered question |
| `submittedAt` | Timestamp | Submission time |

---

### 3.9 `poll-votes/{voteId}`

One document per question-level vote. Used for results aggregation — each `PollQuestion` answer is stored as a separate document for easy counting.

| Field | Type | Description |
|---|---|---|
| `pollId` | string | UUID of the parent poll |
| `questionId` | string | UUID of the question answered |
| `optionId` | string | The answer option selected (option text or nominee Employee ID) |
| `tenantId` | string | Owner organisation |
| `voterUid` | string | Firebase Auth UID of the voter |
| `employeeId` | string? | Employee ID of the voter if known |
| `submittedAt` | Timestamp | Submission time |

---

## 4. Security Rules

> **For developers.** Rules are defined in `firestore.rules`.

### 4.1 Key principles

1. **Tenant isolation** — every collection enforces `request.auth.token.tenantId == resource.data.tenantId` on reads and writes.
2. **Public form access** — `feedback-forms` documents where `isActive == true` can be read by anyone, including unauthenticated users (guests accessing the public form URL).
3. **Public form submission** — `feedback-responses` allows `create` by anyone (unauthenticated). This is intentional — guests do not log in to submit.
4. **Super admin bypass** — `request.auth.token.superAdmin == true` bypasses tenant checks across all collections.

### 4.2 Collection-level summary

| Collection | Public read | Public write | Authenticated read | Authenticated write |
|---|---|---|---|---|
| `tenants` | No | No | Own tenant only | Super admin only |
| `tenant-admins` | No | No | Own document or same-tenant owner | Own document or super admin |
| `tenant-settings` | No | No | Matching tenantId claim | Owner or super admin |
| `feedback-forms` | Active forms only | No | Owner: all in tenant; Staff: own forms only | Matching tenantId claim (Staff must set `createdBy` to own UID) |
| `feedback-responses` | `get` by ID (shareable links) | Create only | Own tenant members | Owner or super admin (update/delete) |
| `employees` | Yes (read: `if true`) | No | Any authenticated | Matching tenantId claim |
| `polls` | Active polls only | No | Owner: all in tenant; Staff: own polls only | Matching tenantId claim |
| `poll-responses` | No | Tenant members only | Owner, super admin, or own voter UID | — |
| `poll-votes` | No | Tenant members only | Authenticated with any tenantId claim | — |
