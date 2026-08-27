# Feature Backlog

Tracks all planned features from user feedback. Each item has a status, scope notes, and a checklist of concrete implementation tasks.

**Statuses:** `planned` · `in-progress` · `done` · `exists` (feature already exists, no work needed)

---

## 1. Custom Form Slugs / Short Links
**Status:** `done`  
**Priority:** High

**Context:**  
Form URLs are currently raw UUIDs — e.g. `/feedback/550e8400-e29b-41d4-a716-446655440000`. A readable URL like `/feedback/hr-forms` also solves the "clickable label" request — sharing `feedback.inan.com.ng/feedback/hr-forms` reads naturally without needing to rename the link separately.

**Implementation tasks:**
- [x] Add optional `slug?: string` field to `FeedbackForm` interface in `src/types/index.ts`
- [x] In `FeedbackFormBuilder` Basics step: add a "Custom Link" input that auto-populates by slugifying the form title but remains editable
- [x] Show a live URL preview beneath the input (e.g. `yourdomain.com/feedback/hr-forms`)
- [x] Add a slug uniqueness check against Firestore before the form is saved — query `feedback-forms` where `slug == value` scoped to the tenant (`isSlugTaken` in `src/lib/firestore.ts`)
- [x] Mirror the same input in `FeedbackFormEditor` so existing forms can have a slug added or changed
- [x] Update `src/app/feedback/[formId]/FeedbackPageClient.tsx` to resolve by slug when the path segment is not a UUID — UUID check uses regex, slug path calls `getFormBySlug(slug, tenantId)`
- [x] Add a Firestore composite index on `(tenantId, slug)` in `firestore.indexes.json`
- [x] Display the custom URL (not the UUID URL) on the QR success screen when a slug is set
- [x] Sanitise slug input: lowercase, replace spaces with hyphens, strip non-alphanumeric chars, max 80 chars

---

## 2. Enter Key Consistency in the Form Builder
**Status:** `done`  
**Priority:** Medium

**Context:**  
Pressing Enter in form builder inputs has inconsistent behaviour. All key areas have been addressed.

**Implementation tasks:**
- [x] In the question body `<Input>`: Enter moves focus to the first option input if multiChoice, or prevents accidental form submit for rating/text questions
- [x] In multiChoice option inputs: Enter on a non-last option moves focus to the next option; Enter on the last option adds a new option and focuses it
- [x] In the Sections modal "Add Section" name input: Enter triggers the Add Section action
- [x] In the Sections modal section name/description inline edit inputs: Enter blurs/confirms
- [x] Settings page inputs (locations, notification emails) handle Enter correctly via `onKeyDown`

---

## 3 & 4. Rich Text Descriptions (Bold, Italic, Line Breaks, Links)
**Status:** `done`  
**Priority:** High

**Context:**  
Form and section descriptions now support rich text via TipTap. Question text stays plain.

**Library:** TipTap (`@tiptap/react` + `@tiptap/starter-kit` + `@tiptap/extension-link`) — headless, React-native, well-maintained.

**Implementation tasks:**
- [x] Install dependencies: `@tiptap/react@2.11.7`, `@tiptap/starter-kit@2.11.7`, `@tiptap/extension-link@2.11.7`
- [x] Install `dompurify@3.2.6` and `@types/dompurify@3.0.5` for sanitising stored HTML before rendering
- [x] Create `src/components/RichTextEditor.tsx` — a reusable TipTap wrapper with a toolbar (Bold, Italic, Bullet List, Link, Hard Break). Accepts `value: string` (HTML) and `onChange: (html: string) => void`. Supports `compact`, `label`, `disabled`, `maxLength` (plain-text character count) props
- [x] Replace the form description `<Input>` in `FeedbackFormBuilder` Basics step with `<RichTextEditor>`
- [x] Replace the form description `<Input>` in `FeedbackFormEditor` Basics step with `<RichTextEditor>`
- [x] Replace section description fields in `SectionsModal` (both builder and editor) with `<RichTextEditor compact>`
- [x] Update `FeedbackForm.tsx` (public renderer): replace `<p>{form.description}</p>` with `<SafeHtml>` using DOMPurify on the client before rendering
- [x] Update `FeedbackForm.tsx`: same treatment for section descriptions
- [x] Update `PreviewPanel` in `FeedbackFormBuilder`: render description HTML via DOMPurify rather than plain text
- [x] Add CSS for `.rte-content` placeholder, prose reset (lists, links, bold, italic) in `globals.css`

---

## 5. Notification Emails to Non-Registered Addresses
**Status:** `done`  
**Priority:** Medium

**Context:**  
Fully implemented. In Settings → Notifications, owners can add any number of org-wide alert email addresses. Staff members can add their own personal alert emails. Both lists are merged and deduplicated before each negative-feedback alert is sent via Brevo.

**Implementation tasks:**
- [x] Rename owner Notifications section title to **"Alert Recipients"** and update its description text in `src/app/dashboard/settings/page.tsx`
- [x] Rename staff Notifications section title similarly

---

## 6. Settings Page Restructure
**Status:** `done`  
**Priority:** Medium

**Context:**  
Settings is now a tabbed layout replacing the previous flat single-scroll page. Tabs improve discoverability and provide room for future settings without the page becoming unwieldy.

### 6a. Tabbed Layout
**Implementation tasks:**
- [x] Replace the flat scroll in `src/app/dashboard/settings/page.tsx` with a tab-strip layout. Tabs:
  - **Account** — Profile, Change Password
  - **Organisation** — Branding, Locations, Response Sharing (owner only)
  - **Notifications** — Alert Recipients (org-wide for owners, personal for staff)
  - **Advanced** — SEO & Open Graph (owner only)
  - **Team** — Team Management (owner only)
  - **Danger Zone** — Delete All (owner only)
- [x] Persist the active tab in the URL query param (`/dashboard/settings?tab=notifications`) so deep-linking works and the page doesn't reset on refresh
- [x] Keep role-gating logic identical — staff only sees Account and Notifications tabs

### 6b. Improve Notifications Section Discoverability
*(Covered in item 5 above)*

---

## Bug Fix: Optional Questions Block Form Submission
**Status:** `done`  
**Priority:** Critical

**Context:**  
Zod schema in `src/components/FeedbackForm.tsx` now correctly handles all optional question types.

**Implementation tasks:**
- [x] For optional `text` questions: uses `z.string().max(256)` with no `min(1)` so empty string passes
- [x] For optional single-answer `multiChoice` questions (including those with `__others__`): allow empty string, `undefined`, or bare `__others__` sentinel — all pass when `required: false`
- [x] For optional `multiChoice` with `multiSelect: true`: uses `z.array(z.string()).optional()` so empty array and undefined both pass
- [x] For optional `rating` questions: uses `z.number().min(1).max(5).optional()` so undefined passes
- [x] Required-question enforcement is unaffected — required questions still block submission when unanswered
- [x] Step-by-step mode: `trigger(question.id)` on "Next" respects the optional/required distinction

---

## Implementation Order (completed)

1. ~~**Bug fix** — Optional question blocks form submission~~ ✓
2. ~~**Item 2** — Enter key fixes~~ ✓
3. ~~**Item 5** — Rename Notifications label~~ ✓
4. ~~**Item 1** — Custom slugs~~ ✓
5. ~~**Items 3 & 4** — Rich text editor~~ ✓
6. ~~**Item 6a** — Settings tab restructure~~ ✓
