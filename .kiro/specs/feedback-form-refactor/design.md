# Design Document: Feedback Form Refactor

## Overview

This refactor cleans up the architecture of the hotel guest feedback system in the Inan Awards application. The goal is to produce a fully static Next.js 14 export that runs entirely client-side, communicates directly with Firebase (Auth + Firestore) from the browser, and introduces three new capabilities: `AuthGuard` for route protection, `ResponsesTable` (TanStack Table) for sortable/searchable response viewing, and Excel export via SheetJS.

No server-side runtime is used. All data flows through the Firebase JS SDK directly from the browser.

## Architecture

```
Browser
  │
  ├── /login                  → LoginPage (Firebase Auth)
  │
  ├── /dashboard/*            → AuthGuard → DashboardLayout → page content
  │     ├── /dashboard        → Overview stats
  │     ├── /dashboard/feedback → FeedbackFormBuilder + ResponsesTable + Excel export
  │     └── /dashboard/results → (existing awards results, unchanged)
  │
  └── /feedback/[formId]      → PublicFeedbackForm (unauthenticated)
                                  └── fetches form → renders questions → submits response
```

### Static Export Constraints

- `next.config.js` sets `output: 'export'` and `images: { unoptimized: true }`
- Every component that uses Firebase SDK, React hooks, or browser APIs carries `'use client'`
- Dynamic route `/feedback/[formId]` resolves `formId` from `useParams()` at runtime (no `generateStaticParams`)
- No `getServerSideProps`, `getStaticProps`, or API routes exist anywhere in the project
- Deployed to Vercel via `vercel.json` pointing at the `out/` directory

### Data Flow

```
Firebase Firestore (cloud)
        │
        │  Firebase JS SDK (browser bundle)
        │
  ┌─────┴──────────────────────────────────┐
  │  /lib/firestore.ts  (data layer)        │
  │   submitFeedback()                      │
  │   getAllResponses()                      │
  │   getAllForms()                          │
  │   deactivateForm()                      │
  └─────┬──────────────────────────────────┘
        │
  React components (all 'use client')
```

## Components and Interfaces

### File Structure

```
src/
├── app/
│   ├── dashboard/
│   │   ├── feedback/page.tsx     MODIFY  — add ResponsesTable, Excel export, AuthGuard
│   │   ├── layout.tsx            MODIFY  — wrap with AuthGuard
│   │   ├── page.tsx              KEEP    — overview stats
│   │   └── results/page.tsx      KEEP    — awards results
│   ├── feedback/
│   │   └── [formId]/page.tsx     MODIFY  — use useParams(), react-hook-form + zod
│   ├── login/page.tsx            MODIFY  — minor cleanup, loading state
│   └── layout.tsx                KEEP
├── components/
│   ├── AuthGuard.tsx             CREATE  — onAuthStateChanged, redirect to /login
│   ├── ResponsesTable.tsx        CREATE  — TanStack Table v8, sort + global filter
│   ├── FeedbackForm.tsx          MODIFY  — react-hook-form + zod validation
│   ├── FeedbackFormBuilder.tsx   MODIFY  — minor cleanup, use lib/firestore.ts
│   ├── DashboardLayout.tsx       KEEP
│   ├── Button.tsx                KEEP
│   └── Input.tsx                 KEEP
├── lib/
│   ├── firebase.ts               MODIFY  — fix authDomain, validate env vars
│   ├── firestore.ts              CREATE  — data access functions
│   └── exportToExcel.ts          CREATE  — SheetJS xlsx export
└── types/
    └── index.ts                  MODIFY  — align interfaces with Firestore schema
```

### AuthGuard

```tsx
// src/components/AuthGuard.tsx
'use client';
interface AuthGuardProps { children: React.ReactNode }
```

Subscribes to `onAuthStateChanged`. Renders a loading spinner while auth state resolves. Redirects to `/login` when user is `null`. Renders `children` when user is authenticated.

### ResponsesTable

```tsx
// src/components/ResponsesTable.tsx
'use client';
interface ResponsesTableProps {
  responses: FeedbackResponse[];
  forms: FeedbackForm[];
  onExport: () => void;
}
```

Uses `@tanstack/react-table` v8 with `useReactTable`. Columns: Form Title (looked up from `forms`), Location, Submitted At, and one column per unique question ID found across all responses. Supports `getSortedRowModel` and `getFilteredRowModel` with a global filter input above the table.

### FeedbackForm (updated)

```tsx
// src/components/FeedbackForm.tsx
'use client';
interface FeedbackFormProps { form: FeedbackForm }
```

Replaces manual `useState` validation with `react-hook-form` + `zod`. The zod schema is built dynamically from `form.questions` at render time, marking required questions as non-optional. Calls `submitFeedback()` from `lib/firestore.ts` on submit.

### FeedbackFormBuilder (updated)

```tsx
// src/components/FeedbackFormBuilder.tsx
'use client';
interface FeedbackFormBuilderProps {
  onSave: (form: FeedbackForm) => Promise<void>;
}
```

Minimal changes: calls `getAllForms()` on mount to refresh the list after save. No structural changes to the multi-step UI.

## Data Models

```typescript
// src/types/index.ts

export interface FeedbackQuestion {
  id: string;                              // UUID
  type: 'rating' | 'text' | 'multiChoice';
  question: string;
  options?: string[];                      // only for multiChoice
  required: boolean;
}

export interface FeedbackForm {
  id: string;                              // UUID, used as Firestore doc ID
  title: string;
  location: string;                        // 'Qaras Hotels: House 3' | 'Qaras Hotels: Bluxton'
  questions: FeedbackQuestion[];
  createdAt: Date | Timestamp;
  isActive: boolean;
}

export interface FeedbackResponse {
  id: string;                              // UUID
  formId: string;                          // references FeedbackForm.id
  location: string;                        // copied from FeedbackForm.location at submit time
  responses: { [questionId: string]: string | number };
  submittedAt: Date | Timestamp;
}
```

These interfaces already exist in `src/types/index.ts` and match the Firestore schema. The refactor confirms they are correct and removes any drift.

## Firestore Data Layer

All Firestore access is centralised in `src/lib/firestore.ts`. Components import these functions instead of calling the Firestore SDK directly.

```typescript
// src/lib/firestore.ts
'use client';

import { db } from './firebase';
import { collection, doc, getDocs, getDoc, addDoc, setDoc, updateDoc, orderBy, query } from 'firebase/firestore';
import type { FeedbackForm, FeedbackResponse } from '../types';

/** Write a new FeedbackResponse to feedback-responses */
export async function submitFeedback(response: FeedbackResponse): Promise<void>

/** Fetch all FeedbackResponse documents ordered by submittedAt desc */
export async function getAllResponses(): Promise<FeedbackResponse[]>

/** Fetch all FeedbackForm documents ordered by createdAt desc */
export async function getAllForms(): Promise<FeedbackForm[]>

/** Fetch a single FeedbackForm by ID */
export async function getFormById(formId: string): Promise<FeedbackForm | null>

/** Set isActive: false on a FeedbackForm */
export async function deactivateForm(formId: string): Promise<void>

/** Save a new FeedbackForm (uses form.id as the Firestore doc ID) */
export async function saveForm(form: FeedbackForm): Promise<void>
```

## Authentication Flow

```
User visits /dashboard/*
        │
        ▼
AuthGuard mounts → subscribes to onAuthStateChanged
        │
   ┌────┴────┐
   │ loading │  → renders spinner
   └────┬────┘
        │ resolved
   ┌────┴────────────┐
   │ user === null   │  → router.push('/login')
   └────┬────────────┘
        │ user !== null
        ▼
   renders children (dashboard content)
```

Login page (`/login`):
1. `onAuthStateChanged` fires on mount — if already authenticated, redirect to `/dashboard`
2. Manager submits email + password → `signInWithEmailAndPassword`
3. On success → `router.push('/dashboard')`
4. On failure → map Firebase error code to human-readable message, display inline

Sign-out (in `DashboardLayout`):
- Calls `signOut(auth)` → `router.push('/login')`

## Public Form Flow

```
Guest visits /feedback/[formId]
        │
        ▼
useParams() → formId
        │
        ▼
getFormById(formId)
        │
   ┌────┴──────────────────┐
   │ not found / inactive  │  → error message, no form rendered
   └────┬──────────────────┘
        │ found + active
        ▼
render title, location, questions (in order)
        │
        ▼
Guest fills in answers
        │
        ▼
react-hook-form + zod validates required fields
        │
   ┌────┴──────────────┐
   │ validation fails  │  → inline error per field, no submit
   └────┬──────────────┘
        │ valid
        ▼
submitFeedback({ id, formId, location, responses, submittedAt })
        │
   ┌────┴──────────────┐
   │ Firestore error   │  → error banner, retry allowed
   └────┬──────────────┘
        │ success
        ▼
thank-you confirmation screen
```

The zod schema is built dynamically:

```typescript
const schemaShape = form.questions.reduce((acc, q) => {
  const base = q.type === 'rating'
    ? z.number().min(1).max(5)
    : z.string().min(1);
  acc[q.id] = q.required ? base : base.optional();
  return acc;
}, {} as Record<string, z.ZodTypeAny>);
const schema = z.object(schemaShape);
```

## Dashboard Flow

```
Manager navigates to /dashboard/feedback
        │
        ▼
AuthGuard (in layout) confirms auth
        │
        ▼
Page mounts → Promise.all([getAllForms(), getAllResponses()])
        │
        ▼
ResponsesTable renders with TanStack Table
  - global filter input
  - sortable column headers
  - "Export to Excel" button
        │
        ▼ (on export click)
exportToExcel(responses, forms) → triggers browser download
```

### Excel Export

```typescript
// src/lib/exportToExcel.ts
import * as XLSX from 'xlsx';

export function exportToExcel(responses: FeedbackResponse[], forms: FeedbackForm[]): void {
  // flatten responses to rows, look up form title
  // create worksheet, workbook
  // filename: feedback-responses-YYYY-MM-DD.xlsx
  // XLSX.writeFile triggers browser download
}
```

## Static Export Configuration

### next.config.js

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  reactStrictMode: true,
  images: { unoptimized: true },
  env: {
    NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  },
};
export default nextConfig;
```

Note: `next.config.mjs` is renamed to `next.config.js` (or kept as `.mjs` — both work with `"type": "module"` in package.json). The `webpack` override for `undici` is removed since static export does not use Node.js server bundling.

### vercel.json

```json
{
  "buildCommand": "next build",
  "outputDirectory": "out",
  "framework": "nextjs"
}
```

### .env.local.example

```bash
# Firebase project configuration — copy to .env.local and fill in values
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key-here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
```

## Firestore Security Rules Design

The rules enforce two access patterns:
1. Public guests can submit responses (unauthenticated `create`)
2. Only authenticated managers can read, update, or delete any data

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isAuthenticated() {
      return request.auth != null;
    }

    function isAdmin() {
      return isAuthenticated() &&
        exists(/databases/$(database)/documents/users/$(request.auth.uid)) &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }

    // Feedback forms: anyone can read active forms; only admins can write
    match /feedback-forms/{formId} {
      allow read: if resource.data.isActive == true || isAdmin();
      allow create, update, delete: if isAdmin();
    }

    // Feedback responses:
    // allow create: if true  — public feedback submission requires no auth
    // read/update/delete restricted to authenticated sessions only
    match /feedback-responses/{responseId} {
      allow create: if true;
      allow read, update, delete: if isAuthenticated();
    }

    // User profiles
    match /users/{userId} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
    }
  }
}
```

Key design decision: `allow create: if true` on `feedback-responses` is intentional — guests submit feedback without logging in. All other operations require `request.auth != null` to prevent anonymous reads of guest data.

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Form save produces a complete document

*For any* valid FeedbackForm (non-empty title, valid location, at least one question), calling `saveForm()` should result in a Firestore document that contains all required fields: `id`, `title`, `location`, `questions`, `createdAt`, and `isActive: true`.

**Validates: Requirements 1.1, 1.2**

### Property 2: Submission disabled when fields are empty

*For any* combination of empty title, empty location, or empty questions array in the FeedbackFormBuilder, the submit action should be disabled (button disabled or form submission prevented).

**Validates: Requirements 1.4**

### Property 3: Question IDs are unique within a form

*For any* sequence of questions added to the FeedbackFormBuilder, all question `id` values should be distinct (no two questions share the same UUID).

**Validates: Requirements 2.3**

### Property 4: Question reorder is correct

*For any* list of questions and any valid reorder operation (move up / move down), the resulting list should contain the same questions with the target question shifted by exactly one position in the specified direction.

**Validates: Requirements 2.5**

### Property 5: Question removal is complete

*For any* question in the form's question list, after removing it the question should no longer appear in the list, and all other questions should remain unchanged.

**Validates: Requirements 2.6**

### Property 6: Response map keys match question IDs

*For any* FeedbackForm with any set of questions, when a guest submits a FeedbackResponse, the keys of the `responses` map should exactly equal the set of `id` values from the form's `questions` array (for answered questions).

**Validates: Requirements 3.4**

### Property 7: Inactive form blocks rendering

*For any* FeedbackForm where `isActive` is `false`, the PublicFeedbackForm should display the inactive message and should not render any question inputs.

**Validates: Requirements 5.3**

### Property 8: Form renders all questions in order

*For any* FeedbackForm with N questions, the PublicFeedbackForm should render exactly N question blocks in the same order as the `questions` array, each using the correct UI for its `type` (`rating` → 5 buttons, `text` → input, `multiChoice` → radio buttons).

**Validates: Requirements 5.4, 5.5, 5.6, 5.7**

### Property 9: Required field validation prevents submission

*For any* FeedbackForm where at least one question has `required: true`, attempting to submit without answering that question should fail validation, display an error, and not call `submitFeedback`.

**Validates: Requirements 5.8, 5.9**

### Property 10: Successful submission writes correct Firestore document

*For any* valid form submission (all required fields answered), the FeedbackResponse written to Firestore should have: `formId` matching the form's `id`, `location` matching the form's `location`, `responses` keys matching the answered question IDs, and a `submittedAt` timestamp.

**Validates: Requirements 5.10**

### Property 11: Auth error codes map to human-readable messages

*For any* Firebase Auth error code returned by `signInWithEmailAndPassword`, the login page should display a non-empty, human-readable error string (not the raw error code).

**Validates: Requirements 8.3**

### Property 12: Missing Firebase env var throws descriptive error

*For any* one of the six `NEXT_PUBLIC_FIREBASE_*` environment variables, if that variable is absent at Firebase initialisation time, the app should throw an error whose message identifies the missing variable name.

**Validates: Requirements 7.3**

### Property 13: Table search filters rows

*For any* search string entered in the global filter input, only rows whose column values contain that string (case-insensitive) should be visible in the ResponsesTable.

**Validates: Requirements 10.5**

### Property 14: Export filename includes current date

*For any* invocation of `exportToExcel`, the generated filename should match the pattern `feedback-responses-YYYY-MM-DD.xlsx` where the date portion equals the current local date at the time of export.

**Validates: Requirements 11.3**

### Property 15: Deactivate form sets isActive to false

*For any* FeedbackForm with `isActive: true`, calling `deactivateForm(formId)` should result in the Firestore document having `isActive: false`, with all other fields unchanged.

**Validates: Requirements 4.3**

## Error Handling

| Scenario | Component | Behaviour |
|---|---|---|
| Form not found in Firestore | PublicFeedbackForm | "Form not found" message, no form rendered |
| Form is inactive | PublicFeedbackForm | "This form is no longer active" message |
| Firestore write fails on submit | PublicFeedbackForm | Error banner, submit button re-enabled for retry |
| Firestore read fails on dashboard | Dashboard feedback page | Descriptive error message displayed |
| Firebase Auth sign-in fails | LoginPage | Human-readable error mapped from error code |
| Missing env var at init | lib/firebase.ts | Throws `Error('Missing Firebase config: NEXT_PUBLIC_FIREBASE_...')` |
| Auth state null on dashboard | AuthGuard | Redirect to `/login` |

All async operations use try/catch. Errors are surfaced to the user via inline error states — no silent failures.

## Testing Strategy

### Dual Testing Approach

Both unit tests and property-based tests are required. They are complementary:
- Unit tests catch concrete bugs in specific scenarios and integration points
- Property-based tests verify universal correctness across many generated inputs

### Unit Tests (Vitest + React Testing Library)

Focus on:
- Specific rendering examples (login form fields present, AuthGuard redirects, thank-you screen after submit)
- Integration points (firestore.ts functions with mocked Firebase SDK)
- Error condition examples (inactive form, missing form, auth failure, Firestore write failure)
- Configuration checks (vercel.json exists, .env.local.example contains all 6 vars)

### Property-Based Tests (fast-check)

Use `fast-check` for TypeScript. Each property test runs a minimum of 100 iterations.

Each test is tagged with a comment in the format:
`// Feature: feedback-form-refactor, Property N: <property text>`

Property tests to implement:

| Property | Generator inputs | Assertion |
|---|---|---|
| P1: Form save completeness | `fc.record({ title: fc.string({minLength:1}), location: fc.constantFrom(...), questions: fc.array(questionArb, {minLength:1}) })` | saved doc has all required fields |
| P2: Submit disabled on empty fields | `fc.record({ title: fc.option(fc.string()), location: fc.option(fc.string()), questions: fc.option(fc.array(...)) })` with at least one empty | submit is disabled |
| P3: Question ID uniqueness | `fc.array(questionTypeArb, {minLength:2, maxLength:20})` | all IDs distinct after adding N questions |
| P4: Question reorder | `fc.array(questionArb, {minLength:2}), fc.nat()` (index), direction | question at new index is the moved one |
| P5: Question removal | `fc.array(questionArb, {minLength:1}), fc.nat()` (index to remove) | removed question absent, others unchanged |
| P6: Response map keys | `fc.record({ form: formArb, answers: answersArb })` | response.responses keys ⊆ question IDs |
| P7: Inactive form blocks render | `fc.record({ ...formFields, isActive: fc.constant(false) })` | no question inputs rendered |
| P8: Questions rendered in order | `fc.array(questionArb, {minLength:1, maxLength:10})` | rendered order matches array order, correct UI per type |
| P9: Required validation | `fc.record({ form: formWithRequiredArb })` with missing answers | submitFeedback not called, error shown |
| P10: Submission writes correct doc | `fc.record({ form: formArb, answers: validAnswersArb })` | written doc fields match inputs |
| P11: Auth error messages | `fc.constantFrom('auth/invalid-email', 'auth/user-not-found', ...)` | message is non-empty string, not the raw code |
| P12: Missing env var throws | `fc.constantFrom('NEXT_PUBLIC_FIREBASE_API_KEY', ...)` | thrown error message contains the var name |
| P13: Table search filters | `fc.array(responseArb), fc.string()` | visible rows all contain search string |
| P14: Export filename date | `fc.date()` | filename matches `feedback-responses-YYYY-MM-DD.xlsx` |
| P15: Deactivate sets isActive false | `fc.record({ ...formFields, isActive: fc.constant(true) })` | after deactivate, isActive is false |
