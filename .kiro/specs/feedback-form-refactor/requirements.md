# Requirements Document

## Introduction

This spec covers the refactor of the feedback form system in the Inan Awards application. The system allows hotel managers to dynamically create feedback forms with configurable questions, and guests to submit responses via a public URL. The refactor aims to clean up the architecture, align TypeScript types with Firestore data structures, and ensure the public form rendering is robust and maintainable.

## Glossary

- **FeedbackForm**: A Firestore document stored in the `feedback-forms` collection representing a manager-created form with dynamic questions.
- **FeedbackQuestion**: A single question within a FeedbackForm, with a type of `rating`, `text`, or `multiChoice`.
- **FeedbackResponse**: A Firestore document stored in `feedback-responses` representing a guest's submission for a specific form.
- **FeedbackFormBuilder**: The manager dashboard component used to create and configure FeedbackForms.
- **PublicFeedbackForm**: The public-facing component rendered at `/feedback/[formId]` that guests use to submit responses.
- **Manager**: An authenticated user with access to the dashboard who creates and manages feedback forms.
- **Guest**: An unauthenticated user who accesses the public form URL to submit feedback.
- **Firestore**: The Firebase cloud database used to persist forms and responses.
- **AuthGuard**: A client-side React component at `/components/AuthGuard.tsx` that checks Firebase auth state and redirects unauthenticated users to `/login`.
- **ResponsesTable**: A TanStack Table component at `/components/ResponsesTable.tsx` that displays all FeedbackResponse records from Firestore.
- **StaticExport**: The Next.js `output: 'export'` build mode producing a fully static site with no server-side runtime.

## Requirements

### Requirement 1: Form Creation by Manager

**User Story:** As a manager, I want to create a feedback form with a title, location, and dynamic questions, so that I can collect structured feedback from guests at a specific property.

#### Acceptance Criteria

1. WHEN a manager submits the FeedbackFormBuilder with a valid title, location, and at least one question, THE FeedbackFormBuilder SHALL save a FeedbackForm document to the `feedback-forms` Firestore collection.
2. THE FeedbackForm SHALL include the fields: `id` (UUID), `title` (string), `location` (string), `questions` (array of FeedbackQuestion), `createdAt` (timestamp), and `isActive` (boolean, defaulting to `true`).
3. WHEN a FeedbackForm is saved successfully, THE FeedbackFormBuilder SHALL display a QR code and shareable URL pointing to `/feedback/[formId]`.
4. IF the title, location, or questions array is empty, THEN THE FeedbackFormBuilder SHALL disable the form submission action.
5. THE FeedbackFormBuilder SHALL support exactly two location values: `'Qaras Hotels: House 3'` and `'Qaras Hotels: Bluxton'`.

### Requirement 2: Dynamic Question Configuration

**User Story:** As a manager, I want to add questions of different types to a form, so that I can collect varied kinds of feedback from guests.

#### Acceptance Criteria

1. THE FeedbackFormBuilder SHALL support three question types: `rating`, `text`, and `multiChoice`.
2. WHEN a manager adds a `multiChoice` question, THE FeedbackFormBuilder SHALL allow the manager to define one or more option strings for that question.
3. WHEN a manager adds any question, THE FeedbackFormBuilder SHALL assign a unique `id` (UUID) to that question.
4. THE FeedbackFormBuilder SHALL allow the manager to mark each question as `required` or optional via a checkbox.
5. THE FeedbackFormBuilder SHALL allow the manager to reorder questions using up and down controls.
6. THE FeedbackFormBuilder SHALL allow the manager to remove any question from the form before saving.

### Requirement 3: TypeScript Types

**User Story:** As a developer, I want accurate TypeScript types for all feedback data structures, so that the codebase is type-safe and consistent with the Firestore schema.

#### Acceptance Criteria

1. THE codebase SHALL define a `FeedbackQuestion` interface with fields: `id: string`, `type: 'rating' | 'text' | 'multiChoice'`, `question: string`, `options?: string[]`, and `required: boolean`.
2. THE codebase SHALL define a `FeedbackForm` interface with fields: `id: string`, `title: string`, `location: string`, `questions: FeedbackQuestion[]`, `createdAt: Date | Timestamp`, and `isActive: boolean`.
3. THE codebase SHALL define a `FeedbackResponse` interface with fields: `id: string`, `formId: string`, `location: string`, `responses: { [questionId: string]: string | number }`, and `submittedAt: Date | Timestamp`.
4. WHEN a `FeedbackResponse` is constructed, THE PublicFeedbackForm SHALL populate the `responses` map using each `FeedbackQuestion`'s `id` as the key and the guest's answer as the value.

### Requirement 4: Form Management in Dashboard

**User Story:** As a manager, I want to view and manage existing feedback forms from the dashboard, so that I can track which forms are active and access their results.

#### Acceptance Criteria

1. WHEN a manager navigates to the feedback dashboard page, THE Dashboard SHALL fetch and display all FeedbackForms from the `feedback-forms` Firestore collection.
2. THE Dashboard SHALL display each form's `title`, `location`, `createdAt`, and `isActive` status.
3. WHEN a manager deactivates a form, THE Dashboard SHALL update the form's `isActive` field to `false` in Firestore.
4. IF a Firestore read fails, THEN THE Dashboard SHALL display a descriptive error message to the manager.

### Requirement 5: Public Feedback Form

**User Story:** As a guest, I want to access a feedback form via a URL and submit my responses, so that I can provide feedback about my experience at a hotel property.

#### Acceptance Criteria

1. WHEN a guest navigates to `/feedback/[formId]`, THE PublicFeedbackForm SHALL fetch the corresponding FeedbackForm document from the `feedback-forms` Firestore collection using the `formId` URL parameter.
2. IF the FeedbackForm document does not exist, THEN THE PublicFeedbackForm SHALL display a "Form not found" error message.
3. IF the FeedbackForm's `isActive` field is `false`, THEN THE PublicFeedbackForm SHALL display a "This form is no longer active" message and SHALL NOT render the question form.
4. WHEN a FeedbackForm is loaded successfully, THE PublicFeedbackForm SHALL render the form's `title` and `location`, followed by each question in the order defined in the `questions` array.
5. WHEN rendering a question with `type: 'rating'`, THE PublicFeedbackForm SHALL display five circular buttons numbered 1 through 5, with "Poor" and "Excellent" labels at each end.
6. WHEN rendering a question with `type: 'text'`, THE PublicFeedbackForm SHALL display a text input field.
7. WHEN rendering a question with `type: 'multiChoice'`, THE PublicFeedbackForm SHALL display a radio button for each string in the question's `options` array.
8. WHEN a guest submits the form, THE PublicFeedbackForm SHALL validate that all questions marked `required: true` have a response.
9. IF a required question has no response at submission time, THEN THE PublicFeedbackForm SHALL display a validation error and SHALL NOT submit the form.
10. WHEN all required questions are answered and the guest submits, THE PublicFeedbackForm SHALL write a FeedbackResponse document to the `feedback-responses` Firestore collection with: `id`, `formId`, `location` (from the form), `responses` (a map of `questionId` to answer value), and `submittedAt`.
11. WHEN a FeedbackResponse is submitted successfully, THE PublicFeedbackForm SHALL display a thank-you confirmation message.
12. IF the Firestore write fails, THEN THE PublicFeedbackForm SHALL display an error message and SHALL allow the guest to retry submission.

### Requirement 6: Static Export & Deployment Configuration

**User Story:** As a developer, I want the app configured for fully static export, so that it deploys to Vercel without any server-side runtime.

#### Acceptance Criteria

1. THE App SHALL set `output: 'export'` and `images: { unoptimized: true }` in `next.config.js`.
2. THE App SHALL include a `vercel.json` at the project root with `buildCommand: "next build"`, `outputDirectory: "out"`, and `framework: "nextjs"`.
3. THE App SHALL contain no `getServerSideProps`, `getStaticProps`, or API route files.
4. WHEN a component uses Firebase SDK, React hooks, or browser APIs, THE App SHALL be marked with the `'use client'` directive.
5. THE App SHALL include a `.env.local.example` file listing all six `NEXT_PUBLIC_FIREBASE_*` variables with placeholder values and inline comments.

### Requirement 7: Firebase Initialisation

**User Story:** As a developer, I want Firebase initialised from environment variables only, so that no credentials are hardcoded in source control.

#### Acceptance Criteria

1. THE App SHALL initialise Firebase in `/lib/firebase.ts` using only `NEXT_PUBLIC_FIREBASE_*` environment variables (API key, auth domain, project ID, storage bucket, messaging sender ID, app ID).
2. THE App SHALL export `auth` (Firebase Auth instance) and `db` (Firestore instance) from `/lib/firebase.ts`.
3. IF a required `NEXT_PUBLIC_FIREBASE_*` variable is missing at runtime, THEN THE App SHALL throw a descriptive error identifying the missing variable.

### Requirement 8: Authentication — Login Page

**User Story:** As a manager, I want a login page so that I can authenticate with email and password to access the dashboard.

#### Acceptance Criteria

1. THE App SHALL render a centered login form at `/app/login/page.tsx` with email and password fields.
2. WHEN the manager submits valid credentials, THE App SHALL call `signInWithEmailAndPassword` and redirect to `/dashboard`.
3. IF authentication fails, THEN THE App SHALL display a human-readable error message without navigating away.
4. WHEN an already-authenticated manager visits `/login`, THE App SHALL redirect to `/dashboard`.
5. WHILE auth state is resolving on page load, THE App SHALL display a loading indicator.

### Requirement 9: Authentication — AuthGuard

**User Story:** As a manager, I want the dashboard protected by an auth check so that unauthenticated users cannot access feedback data.

#### Acceptance Criteria

1. THE App SHALL include an `AuthGuard` component at `/components/AuthGuard.tsx` that subscribes to `onAuthStateChanged`.
2. WHILE auth state is resolving, THE AuthGuard SHALL render a loading indicator instead of its children.
3. WHEN `onAuthStateChanged` returns a null user, THE AuthGuard SHALL redirect to `/login`.
4. WHEN `onAuthStateChanged` returns an authenticated user, THE AuthGuard SHALL render its children.
5. THE dashboard page SHALL wrap its entire content with the AuthGuard component.

### Requirement 10: Responses Dashboard Table

**User Story:** As a manager, I want to view all submitted feedback responses in a sortable, searchable table so that I can review and analyse guest feedback.

#### Acceptance Criteria

1. THE Dashboard SHALL fetch all FeedbackResponse documents from the `feedback-responses` Firestore collection on mount.
2. WHILE data is loading, THE Dashboard SHALL display a loading spinner or skeleton.
3. THE Dashboard SHALL display responses in a TanStack Table (React Table v8) with columns: Form Title, Location, Question ID / Answer pairs (or a summary), and Submitted At.
4. THE Dashboard SHALL support column sorting when a column header is clicked.
5. THE Dashboard SHALL include a global text search input above the table that filters visible rows across all columns.
6. THE Dashboard SHALL include a header with the application title and a sign-out button.
7. WHEN the manager clicks sign-out, THE Dashboard SHALL call Firebase `signOut` and redirect to `/login`.
8. THE Dashboard SHALL be fully responsive and styled with Tailwind CSS.

### Requirement 11: Export to Excel

**User Story:** As a manager, I want to export all feedback responses to an Excel file so that I can analyse the data offline.

#### Acceptance Criteria

1. THE Dashboard SHALL include an "Export to Excel" button above the responses table.
2. WHEN the manager clicks "Export to Excel", THE Dashboard SHALL use SheetJS (`xlsx`) to generate a `.xlsx` file of all currently displayed rows.
3. THE generated file SHALL have a filename including the current date (e.g. `feedback-responses-YYYY-MM-DD.xlsx`).
4. THE App SHALL trigger a browser download of the generated file automatically.

### Requirement 12: Firestore Security Rules

**User Story:** As a developer, I want Firestore security rules that allow public writes but restrict reads to authenticated users.

#### Acceptance Criteria

1. THE App SHALL include a `firestore.rules` file at the project root.
2. THE `firestore.rules` file SHALL allow `create` on `/responses/{docId}` for all users (`if true`).
3. THE `firestore.rules` file SHALL restrict `read`, `update`, and `delete` on `/responses/{docId}` to authenticated users only (`request.auth != null`).
4. THE `firestore.rules` file SHALL include a comment explaining that `allow create: if true` permits public feedback submission while read/update/delete are restricted to authenticated sessions.
