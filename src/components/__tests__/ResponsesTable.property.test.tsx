// Feature: feedback-form-refactor, Property 13: Table search filters rows

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import React from 'react';
import { render, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock firebase to avoid SDK initialisation
vi.mock('../../lib/firebase', () => ({ db: {}, auth: {} }));

import ResponsesTable from '../ResponsesTable';
import type { FeedbackForm, FeedbackResponse } from '../../types';

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** Generate a safe string that won't cause regex issues and is printable */
const safeStringArb = fc.string({ minLength: 1, maxLength: 20 }).filter(
  (s) => s.trim().length > 0
);

const formArb: fc.Arbitrary<FeedbackForm> = fc.record({
  id: fc.uuid(),
  title: safeStringArb,
  location: fc.constantFrom('Qaras Hotels: House 3', 'Qaras Hotels: Bluxton'),
  questions: fc.array(
    fc.record({
      id: fc.uuid(),
      type: fc.constantFrom('rating' as const, 'text' as const, 'multiChoice' as const),
      question: safeStringArb,
      required: fc.boolean(),
    }),
    { minLength: 0, maxLength: 3 }
  ),
  createdAt: fc.date(),
  isActive: fc.boolean(),
});

const responseArb = (formId: string, location: string): fc.Arbitrary<FeedbackResponse> =>
  fc.record({
    id: fc.uuid(),
    formId: fc.constant(formId),
    location: fc.constant(location),
    responses: fc.dictionary(
      fc.uuid(),
      fc.oneof(
        fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim().length > 0),
        fc.integer({ min: 1, max: 5 }).map(String)
      )
    ),
    submittedAt: fc.date(),
  });

// ---------------------------------------------------------------------------
// Helper: get all visible cell text values from the rendered table
// ---------------------------------------------------------------------------
function getVisibleCellValues(container: HTMLElement): string[] {
  const cells = container.querySelectorAll('tbody td');
  return Array.from(cells).map((cell) => cell.textContent ?? '');
}

// ---------------------------------------------------------------------------
// Property 13: Table search filters rows
// **Validates: Requirements 10.5**
// ---------------------------------------------------------------------------

describe('Property 13: Table search filters rows', () => {
  it('every visible row contains the search string in at least one column value (case-insensitive)', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate 1-5 forms
        fc.array(formArb, { minLength: 1, maxLength: 5 }),
        async (forms) => {
          // Generate responses tied to the generated forms
          const responseArrayArbs = forms.map((form) =>
            fc.array(responseArb(form.id, form.location), { minLength: 0, maxLength: 3 })
          );

          // We need to sample responses synchronously — use fc.sample inside the property
          const allResponseArrays = responseArrayArbs.map((arb) => fc.sample(arb, 1)[0]);
          const responses: FeedbackResponse[] = allResponseArrays.flat();

          if (responses.length === 0) return; // nothing to test

          // Pick a search string that is a substring of one of the form titles (guaranteed match)
          const firstFormTitle = forms[0].title;
          // Use first 3 chars of the title as search string (case-insensitive match guaranteed)
          const searchString = firstFormTitle.slice(0, Math.max(1, Math.floor(firstFormTitle.length / 2)));

          const { container, unmount } = render(
            <ResponsesTable responses={responses} forms={forms} onExport={() => {}} />
          );

          try {
            const searchInput = container.querySelector('input[aria-label="Search responses"]') as HTMLInputElement;
            expect(searchInput).not.toBeNull();

            await act(async () => {
              fireEvent.change(searchInput, { target: { value: searchString } });
            });

            const rows = container.querySelectorAll('tbody tr');

            // If there are visible rows (not the "no results" row), each must contain the search string
            for (const row of Array.from(rows)) {
              const cells = row.querySelectorAll('td');
              if (cells.length === 1 && cells[0].getAttribute('colspan')) {
                // This is the "No responses found" empty state row — skip
                continue;
              }

              const cellTexts = Array.from(cells).map((c) => (c.textContent ?? '').toLowerCase());
              const searchLower = searchString.toLowerCase();
              const rowContainsSearch = cellTexts.some((text) => text.includes(searchLower));

              expect(rowContainsSearch).toBe(true);
            }
          } finally {
            unmount();
          }
        }
      ),
      { numRuns: 100 }
    );
  }, 60000);

  it('shows no rows when search string matches nothing', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(formArb, { minLength: 1, maxLength: 3 }),
        async (forms) => {
          const responseArrayArbs = forms.map((form) =>
            fc.array(responseArb(form.id, form.location), { minLength: 1, maxLength: 2 })
          );
          const allResponseArrays = responseArrayArbs.map((arb) => fc.sample(arb, 1)[0]);
          const responses: FeedbackResponse[] = allResponseArrays.flat();

          if (responses.length === 0) return;

          // Use a search string that is extremely unlikely to match anything
          const noMatchSearch = '\x00\x01\x02';

          const { container, unmount } = render(
            <ResponsesTable responses={responses} forms={forms} onExport={() => {}} />
          );

          try {
            const searchInput = container.querySelector('input[aria-label="Search responses"]') as HTMLInputElement;

            await act(async () => {
              fireEvent.change(searchInput, { target: { value: noMatchSearch } });
            });

            const rows = container.querySelectorAll('tbody tr');
            // Should either be 0 rows or only the empty-state row
            for (const row of Array.from(rows)) {
              const cells = row.querySelectorAll('td');
              if (cells.length === 1 && cells[0].getAttribute('colspan')) {
                // empty state row — acceptable
                continue;
              }
              // If a data row is visible, it must contain the search string
              const cellTexts = Array.from(cells).map((c) => (c.textContent ?? '').toLowerCase());
              const rowContainsSearch = cellTexts.some((text) => text.includes(noMatchSearch.toLowerCase()));
              expect(rowContainsSearch).toBe(true);
            }
          } finally {
            unmount();
          }
        }
      ),
      { numRuns: 50 }
    );
  }, 30000);
});
