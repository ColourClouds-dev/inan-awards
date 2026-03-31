# Implementation Plan: Feedback Form Refactor

## Overview

Refactor the existing Next.js 14 + Firebase feedback system into a fully static export. Work proceeds foundation-first: dependencies → config → types → data layer → auth → UI components → wiring → rules → tests.

## Tasks

- [x] 1. Install missing dependencies
  - Run `npm install react-hook-form @hookform/resolvers zod @tanstack/react-table xlsx`
  - Run `npm install --save-dev @types/xlsx fast-check vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom`
  - Verify all packages appear in `package.json`
  - _Requirements: 5.8, 10.3, 11.2_

- [x] 2. Configure static export
  - [x] 2.1 Update `next.config.mjs` for static export
    - Add `output: 'export'` and `images: { unoptimized: true }`
    - Remove the `webpack` override for `undici` (not needed in static export)
    - Keep the `env` block forwarding all six `NEXT_PUBLIC_FIREBASE_*` vars
    - _Requirements: 6.1_

  - [x] 2.2 Create `vercel.json` at project root
    - Set `buildCommand: "next build"`, `outputDirectory: "out"`, `framework: "nextjs"`
    - _Requirements: 6.2_

  - [x] 2.3 Create `.env.local.example` at project root
    - List all six `NEXT_PUBLIC_FIREBASE_*` variables with placeholder values
    - Add inline comment explaining each variable
    - _Requirements: 6.5_

- [x] 3. Align TypeScript types
  - [x] 3.1 Update `src/types/index.ts` to confirm interface alignment
    - Verify `FeedbackQuestion`, `FeedbackForm`, and `FeedbackResponse` match the Firestore schema exactly as specified in the design
    - Ensure `FeedbackForm.location` is typed as `string` (not a union — the constraint is enforced in the UI)
    - Remove any drift from the existing interfaces; keep unrelated interfaces (`Employee`, `Nomination`, etc.) unchanged
    - _Requirements: 3.1, 3.2, 3.3_

- [x] 4. Fix Firebase initialisation in `src/lib/firebase.ts`
  - Replace the hardcoded `authDomain: 'localhost'` with `process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
  - Update the env-var validation loop to throw `Error('Missing Firebase config: <varName>')` identifying the specific missing variable
  - Remove `console.log` statements; keep `console.error` for failure paths
  - Export `auth`, `db` (keep `storage` export if used elsewhere)
  - _Requirements: 7.1, 7.2, 7.3_

  - [x] 4.1 Write property test for missing env var error (Property 12)
    - **Property 12: Missing Firebase env var throws descriptive error**
    - For each of the six `NEXT_PUBLIC_FIREBASE_*` variable names, simulate its absence and assert the thrown error message contains that variable name
    - **Validates: Requirements 7.3**

- [x] 5. Create Firestore data layer at `src/lib/firestore.ts`
  - Create the file with `'use client'` directive
  - Implement `submitFeedback(response: FeedbackResponse): Promise<void>` — writes to `feedback-responses` collection
  - Implement `getAllResponses(): Promise<FeedbackResponse[]>` — fetches all docs ordered by `submittedAt` desc
  - Implement `getAllForms(): Promise<FeedbackForm[]>` — fetches all docs ordered by `createdAt` desc
  - Implement `getFormById(formId: string): Promise<FeedbackForm | null>` — fetches single doc, returns null if missing
  - Implement `deactivateForm(formId: string): Promise<void>` — sets `isActive: false` via `updateDoc`
  - Implement `saveForm(form: FeedbackForm): Promise<void>` — uses `setDoc` with `form.id` as the document ID
  - _Requirements: 1.1, 4.1, 4.3, 5.1, 5.10_

  - [x] 5.1 Write property test for form save completeness (Property 1)
    - **Property 1: Form save produces a complete document**
    - Generate arbitrary valid `FeedbackForm` objects; call `saveForm()` with a mocked Firestore; assert the written doc contains all required fields (`id`, `title`, `location`, `questions`, `createdAt`, `isActive: true`)
    - **Validates: Requirements 1.1, 1.2**

  - [x] 5.2 Write property test for deactivate sets isActive false (Property 15)
    - **Property 15: Deactivate form sets isActive to false**
    - Generate arbitrary forms with `isActive: true`; call `deactivateForm()`; assert the Firestore `updateDoc` was called with `{ isActive: false }` and no other field changes
    - **Validates: Requirements 4.3**

- [x] 6. Create `src/components/AuthGuard.tsx`
  - Create the file with `'use client'` directive
  - Subscribe to `onAuthStateChanged` in a `useEffect`; unsubscribe on unmount
  - While auth state is resolving (`loading` state), render a centered spinner
  - When user is `null`, call `router.push('/login')` and render nothing
  - When user is authenticated, render `children`
  - Accept `{ children: React.ReactNode }` as props
  - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [x] 7. Update login page at `src/app/login/page.tsx`
  - Replace the `EmailVerification` branch: if user is authenticated but email unverified, still redirect to `/dashboard` (or keep existing behaviour — confirm with design; the design shows a simple redirect on auth)
  - Ensure `onAuthStateChanged` redirects already-authenticated users to `/dashboard`
  - Map all Firebase error codes to human-readable messages (existing `getErrorMessage` is correct — verify completeness)
  - Show loading spinner while `isCheckingAuth` is true
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [x] 7.1 Write property test for auth error code mapping (Property 11)
    - **Property 11: Auth error codes map to human-readable messages**
    - For each known Firebase Auth error code (`auth/invalid-email`, `auth/user-disabled`, `auth/user-not-found`, `auth/wrong-password`, `auth/too-many-requests`), assert `getErrorMessage` returns a non-empty string that is not the raw error code
    - **Validates: Requirements 8.3**

- [x] 8. Update dashboard layout at `src/app/dashboard/layout.tsx`
  - Import `AuthGuard` from `../../components/AuthGuard`
  - Wrap the existing layout content with `<AuthGuard>...</AuthGuard>`
  - Ensure the `DashboardLayout` component (sidebar + header) remains inside the guard
  - _Requirements: 9.5_

- [x] 9. Update `src/components/FeedbackForm.tsx` with react-hook-form + zod
  - Add `'use client'` directive (already present — verify)
  - Build the zod schema dynamically from `form.questions` at render time:
    - `rating` questions: `z.number().min(1).max(5)`
    - `text` questions: `z.string().min(1)`
    - `multiChoice` questions: `z.string().min(1)`
    - Mark as `.optional()` when `question.required === false`
  - Replace manual `useState` validation with `useForm` + `zodResolver`
  - Use `register` / `Controller` for each question type (rating buttons need `Controller`)
  - Display per-field validation errors inline below each question
  - On valid submit, call `submitFeedback()` from `lib/firestore.ts` instead of direct `addDoc`
  - Keep the thank-you screen and error banner behaviour unchanged
  - _Requirements: 5.8, 5.9, 5.10, 5.11, 5.12_

  - [x] 9.1 Write property test for required field validation (Property 9)
    - **Property 9: Required field validation prevents submission**
    - Generate forms with at least one `required: true` question; simulate submit without answering it; assert `submitFeedback` is not called and an error is shown
    - **Validates: Requirements 5.8, 5.9**

  - [x] 9.2 Write property test for response map keys (Property 6)
    - **Property 6: Response map keys match question IDs**
    - Generate arbitrary forms and valid answer sets; assert the `responses` object passed to `submitFeedback` has keys that are a subset of the form's question IDs
    - **Validates: Requirements 3.4**

  - [x] 9.3 Write property test for inactive form blocks rendering (Property 7)
    - **Property 7: Inactive form blocks rendering**
    - Generate forms with `isActive: false`; render `FeedbackForm`; assert no question inputs are rendered and the inactive message is shown
    - **Validates: Requirements 5.3**

  - [x] 9.4 Write property test for questions rendered in order (Property 8)
    - **Property 8: Form renders all questions in order**
    - Generate forms with 1–10 questions of mixed types; render `FeedbackForm`; assert exactly N question blocks appear in the same order, each with the correct UI for its type
    - **Validates: Requirements 5.4, 5.5, 5.6, 5.7**

- [x] 10. Create `src/components/ResponsesTable.tsx`
  - Create the file with `'use client'` directive
  - Accept props: `responses: FeedbackResponse[]`, `forms: FeedbackForm[]`, `onExport: () => void`
  - Define columns: Form Title (look up from `forms` by `formId`), Location, Submitted At, and dynamic answer columns (one per unique question ID across all responses)
  - Use `useReactTable` with `getCoreRowModel`, `getSortedRowModel`, `getFilteredRowModel`
  - Render a global filter `<input>` above the table; wire it to `setGlobalFilter`
  - Render sortable column headers (toggle asc/desc on click, show sort indicator)
  - Render an "Export to Excel" button that calls `onExport`
  - Style with Tailwind CSS; ensure responsive layout
  - _Requirements: 10.1, 10.3, 10.4, 10.5, 10.8_

  - [x] 10.1 Write property test for table search filtering (Property 13)
    - **Property 13: Table search filters rows**
    - Generate arbitrary arrays of responses and a search string; assert that after applying the global filter, every visible row contains the search string in at least one column value (case-insensitive)
    - **Validates: Requirements 10.5**

- [x] 11. Create `src/lib/exportToExcel.ts`
  - Import `* as XLSX from 'xlsx'`
  - Implement `exportToExcel(responses: FeedbackResponse[], forms: FeedbackForm[]): void`
  - Flatten each response to a row: look up form title from `forms`, include location, submittedAt, and each `questionId: answer` pair as separate columns
  - Generate filename as `feedback-responses-YYYY-MM-DD.xlsx` using the current local date
  - Use `XLSX.utils.json_to_sheet`, `XLSX.utils.book_new`, `XLSX.utils.book_append_sheet`, and `XLSX.writeFile` to trigger the browser download
  - _Requirements: 11.2, 11.3, 11.4_

  - [x] 11.1 Write property test for export filename date (Property 14)
    - **Property 14: Export filename includes current date**
    - Mock `Date` to a known value; call `exportToExcel`; assert the filename passed to `XLSX.writeFile` matches `feedback-responses-YYYY-MM-DD.xlsx` with the correct date
    - **Validates: Requirements 11.3**

- [x] 12. Update `src/app/dashboard/feedback/page.tsx`
  - Add `'use client'` directive
  - On mount, call `Promise.all([getAllForms(), getAllResponses()])` from `lib/firestore.ts`
  - Show a loading spinner while data is fetching; show a descriptive error message on failure
  - Render `<FeedbackFormBuilder onSave={saveForm} />` for creating new forms
  - Render `<ResponsesTable responses={responses} forms={forms} onExport={handleExport} />` below the builder
  - Implement `handleExport` to call `exportToExcel(responses, forms)` from `lib/exportToExcel.ts`
  - After a form is saved via `FeedbackFormBuilder`, refresh the forms list by calling `getAllForms()` again
  - _Requirements: 4.1, 4.2, 4.4, 10.1, 10.2, 11.1_

- [x] 13. Update `src/app/feedback/[formId]/page.tsx`
  - Add `'use client'` directive
  - Replace any `params` prop usage with `useParams()` to get `formId` at runtime (required for static export — no `generateStaticParams`)
  - Call `getFormById(formId)` from `lib/firestore.ts` on mount
  - Show loading spinner while fetching
  - If form is `null`, render "Form not found" message
  - If `form.isActive === false`, render "This form is no longer active" message without rendering the form
  - Otherwise render `<FeedbackForm form={form} />`
  - _Requirements: 5.1, 5.2, 5.3_

- [x] 14. Update `src/components/FeedbackFormBuilder.tsx` to use data layer
  - Replace the direct `addDoc` / Firestore SDK call in `handleSubmit` with `saveForm(form)` from `lib/firestore.ts`
  - After a successful save, call `onSave(form)` to notify the parent page (which will refresh the list)
  - No structural changes to the multi-step UI
  - _Requirements: 1.1, 1.3, 1.4, 1.5_

  - [x] 14.1 Write property test for submit disabled on empty fields (Property 2)
    - **Property 2: Submission disabled when fields are empty**
    - Generate combinations where at least one of title, location, or questions is empty; render `FeedbackFormBuilder`; assert the submit/create button is disabled
    - **Validates: Requirements 1.4**

  - [x] 14.2 Write property test for question ID uniqueness (Property 3)
    - **Property 3: Question IDs are unique within a form**
    - Simulate adding N questions of arbitrary types; assert all resulting question `id` values are distinct
    - **Validates: Requirements 2.3**

  - [x] 14.3 Write property test for question reorder correctness (Property 4)
    - **Property 4: Question reorder is correct**
    - Generate a list of questions and a valid index + direction; call `moveQuestion`; assert the target question shifted by exactly one position and all other questions are unchanged
    - **Validates: Requirements 2.5**

  - [x] 14.4 Write property test for question removal completeness (Property 5)
    - **Property 5: Question removal is complete**
    - Generate a list of questions and an index to remove; call `removeQuestion`; assert the removed question is absent and all others remain unchanged
    - **Validates: Requirements 2.6**

- [x] 15. Update `firestore.rules`
  - Replace the existing rules with the design's updated ruleset
  - Add `isAuthenticated()` helper function (`request.auth != null`)
  - Update `feedback-responses` rule: `allow create: if true`, `allow read, update, delete: if isAuthenticated()`
  - Add inline comment on the `allow create: if true` line explaining public submission intent
  - Keep `feedback-forms` and `users` rules aligned with the design
  - Remove the `nominations` and `settings` blocks only if they are no longer needed; otherwise keep them
  - _Requirements: 12.1, 12.2, 12.3, 12.4_

- [x] 16. Checkpoint — ensure all tests pass
  - Run `npx vitest --run` and confirm all property-based and unit tests pass
  - Run `next build` and confirm the static export completes without errors
  - Verify the `out/` directory is generated
  - Ask the user if any questions arise before proceeding

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Property tests use `fast-check` with a minimum of 100 iterations per property
- All components that use Firebase SDK, React hooks, or browser APIs must carry `'use client'`
- The `next.config.mjs` file can stay as `.mjs` since `package.json` has `"type": "module"`
