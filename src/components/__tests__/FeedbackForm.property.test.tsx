// Feature: feedback-form-refactor, Property 9: Required field validation prevents submission
// Feature: feedback-form-refactor, Property 6: Response map keys match question IDs
// Feature: feedback-form-refactor, Property 7: Inactive form blocks rendering
// Feature: feedback-form-refactor, Property 8: Form renders all questions in order

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import React from 'react';
import { render, fireEvent, waitFor, act, within } from '@testing-library/react';
import '@testing-library/jest-dom';

// Hoist mock so it's available inside vi.mock factories
const { mockSubmitFeedback } = vi.hoisted(() => ({
  mockSubmitFeedback: vi.fn(),
}));

vi.mock('../../lib/firestore', () => ({
  submitFeedback: mockSubmitFeedback,
}));

// Mock firebase to avoid SDK initialisation
vi.mock('../../lib/firebase', () => ({ db: {}, auth: {} }));

import FeedbackForm from '../FeedbackForm';
import type { FeedbackForm as FeedbackFormType, FeedbackQuestion } from '../../types';

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const ratingQuestionArb: fc.Arbitrary<FeedbackQuestion> = fc.record({
  id: fc.uuid(),
  type: fc.constant('rating' as const),
  question: fc.string({ minLength: 1 }),
  required: fc.boolean(),
});

const textQuestionArb: fc.Arbitrary<FeedbackQuestion> = fc.record({
  id: fc.uuid(),
  type: fc.constant('text' as const),
  question: fc.string({ minLength: 1 }),
  required: fc.boolean(),
});

const multiChoiceQuestionArb: fc.Arbitrary<FeedbackQuestion> = fc.record({
  id: fc.uuid(),
  type: fc.constant('multiChoice' as const),
  question: fc.string({ minLength: 1 }),
  options: fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 4 }),
  required: fc.boolean(),
});

const questionArb: fc.Arbitrary<FeedbackQuestion> = fc.oneof(
  ratingQuestionArb,
  textQuestionArb,
  multiChoiceQuestionArb
);

const activeFormArb: fc.Arbitrary<FeedbackFormType> = fc.record({
  id: fc.uuid(),
  title: fc.string({ minLength: 1 }),
  location: fc.constantFrom('Qaras Hotels: House 3', 'Qaras Hotels: Bluxton'),
  questions: fc.array(questionArb, { minLength: 1, maxLength: 5 }),
  createdAt: fc.date(),
  isActive: fc.constant(true),
});

const inactiveFormArb: fc.Arbitrary<FeedbackFormType> = fc.record({
  id: fc.uuid(),
  title: fc.string({ minLength: 1 }),
  location: fc.constantFrom('Qaras Hotels: House 3', 'Qaras Hotels: Bluxton'),
  questions: fc.array(questionArb, { minLength: 1, maxLength: 5 }),
  createdAt: fc.date(),
  isActive: fc.constant(false),
});

/** Form with at least one required question */
const formWithRequiredArb: fc.Arbitrary<FeedbackFormType> = activeFormArb.chain((form) => {
  const requiredIdx = fc.integer({ min: 0, max: form.questions.length - 1 });
  return requiredIdx.map((idx) => ({
    ...form,
    questions: form.questions.map((q, i) =>
      i === idx ? { ...q, required: true } : q
    ),
  }));
});

// ---------------------------------------------------------------------------
// Helper: render into a fresh container and return scoped queries
// ---------------------------------------------------------------------------
function renderInContainer(ui: React.ReactElement) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const result = render(ui, { container });
  const w = within(container);
  return {
    ...result,
    container,
    w,
    cleanup: () => {
      result.unmount();
      document.body.removeChild(container);
    },
  };
}

// ---------------------------------------------------------------------------
// Property 9: Required field validation prevents submission
// **Validates: Requirements 5.8, 5.9**
// ---------------------------------------------------------------------------

describe('Property 9: Required field validation prevents submission', () => {
  beforeEach(() => {
    mockSubmitFeedback.mockReset();
    mockSubmitFeedback.mockResolvedValue(undefined);
  });

  it('does not call submitFeedback and shows an error when required fields are unanswered', async () => {
    await fc.assert(
      fc.asyncProperty(formWithRequiredArb, async (form) => {
        mockSubmitFeedback.mockReset();
        mockSubmitFeedback.mockResolvedValue(undefined);

        const { w, cleanup } = renderInContainer(<FeedbackForm form={form} />);

        try {
          // Submit without filling in any answers
          const submitButton = w.getByRole('button', { name: /submit feedback/i });
          await act(async () => {
            fireEvent.click(submitButton);
          });

          // Wait for validation errors to appear
          await waitFor(() => {
            const alerts = w.queryAllByRole('alert');
            expect(alerts.length).toBeGreaterThan(0);
          }, { timeout: 2000 });

          // submitFeedback must NOT have been called
          expect(mockSubmitFeedback).not.toHaveBeenCalled();
        } finally {
          cleanup();
        }
      }),
      { numRuns: 20 }
    );
  }, 30000);
});

// ---------------------------------------------------------------------------
// Property 6: Response map keys match question IDs
// **Validates: Requirements 3.4**
// ---------------------------------------------------------------------------

describe('Property 6: Response map keys match question IDs', () => {
  beforeEach(() => {
    mockSubmitFeedback.mockReset();
    mockSubmitFeedback.mockResolvedValue(undefined);
  });

  it('responses object keys are a subset of the form question IDs', async () => {
    // Use a simple text-only form so we can fill it programmatically
    const textOnlyFormArb: fc.Arbitrary<FeedbackFormType> = fc.record({
      id: fc.uuid(),
      title: fc.string({ minLength: 1 }),
      location: fc.constantFrom('Qaras Hotels: House 3', 'Qaras Hotels: Bluxton'),
      questions: fc.array(
        fc.record({
          id: fc.uuid(),
          type: fc.constant('text' as const),
          question: fc.string({ minLength: 1 }),
          required: fc.constant(true),
        }),
        { minLength: 1, maxLength: 3 }
      ),
      createdAt: fc.date(),
      isActive: fc.constant(true),
    });

    await fc.assert(
      fc.asyncProperty(textOnlyFormArb, async (form) => {
        mockSubmitFeedback.mockReset();
        mockSubmitFeedback.mockResolvedValue(undefined);

        const questionIds = new Set(form.questions.map((q) => q.id));

        const { w, cleanup } = renderInContainer(<FeedbackForm form={form} />);

        try {
          // Fill in all text inputs
          const inputs = w.getAllByRole('textbox');
          for (const input of inputs) {
            fireEvent.change(input, { target: { value: 'test answer' } });
          }

          // Submit
          const submitButton = w.getByRole('button', { name: /submit feedback/i });
          fireEvent.click(submitButton);

          await waitFor(() => {
            expect(mockSubmitFeedback).toHaveBeenCalled();
          }, { timeout: 5000 });

          const [calledWith] = mockSubmitFeedback.mock.calls[0];
          const responseKeys = Object.keys(calledWith.responses);

          // All response keys must be valid question IDs
          for (const key of responseKeys) {
            expect(questionIds.has(key)).toBe(true);
          }
        } finally {
          cleanup();
        }
      }),
      { numRuns: 10 }
    );
  }, 120000);
});

// ---------------------------------------------------------------------------
// Property 7: Inactive form blocks rendering
// **Validates: Requirements 5.3**
// ---------------------------------------------------------------------------

describe('Property 7: Inactive form blocks rendering', () => {
  it('shows inactive message and renders no question inputs when isActive is false', async () => {
    await fc.assert(
      fc.asyncProperty(inactiveFormArb, async (form) => {
        const { w, cleanup } = renderInContainer(<FeedbackForm form={form} />);

        try {
          // Inactive message must be shown
          expect(w.getByText(/this form is no longer active/i)).toBeInTheDocument();

          // No question blocks should be rendered
          const questionBlocks = w.queryAllByTestId('question-block');
          expect(questionBlocks).toHaveLength(0);

          // No submit button
          expect(w.queryByRole('button', { name: /submit feedback/i })).not.toBeInTheDocument();
        } finally {
          cleanup();
        }
      }),
      { numRuns: 50 }
    );
  }, 30000);
});

// ---------------------------------------------------------------------------
// Property 8: Form renders all questions in order
// **Validates: Requirements 5.4, 5.5, 5.6, 5.7**
// ---------------------------------------------------------------------------

describe('Property 8: Form renders all questions in order', () => {
  it('renders exactly N question blocks in the correct order with correct UI per type', async () => {
    const mixedFormArb: fc.Arbitrary<FeedbackFormType> = fc.record({
      id: fc.uuid(),
      title: fc.string({ minLength: 1 }),
      location: fc.constantFrom('Qaras Hotels: House 3', 'Qaras Hotels: Bluxton'),
      questions: fc.array(questionArb, { minLength: 1, maxLength: 10 }),
      createdAt: fc.date(),
      isActive: fc.constant(true),
    });

    await fc.assert(
      fc.asyncProperty(mixedFormArb, async (form) => {
        const { w, cleanup } = renderInContainer(<FeedbackForm form={form} />);

        try {
          // Exactly N question blocks
          const questionBlocks = w.getAllByTestId('question-block');
          expect(questionBlocks).toHaveLength(form.questions.length);

          // Each block has the correct UI for its type
          form.questions.forEach((question, index) => {
            const block = questionBlocks[index];

            // Question text appears in the heading within the block
            const heading = block.querySelector('h3');
            expect(heading).not.toBeNull();
            expect(heading!.textContent).toContain(question.question);

            if (question.type === 'rating') {
              // Rating: 5 buttons numbered 1-5
              const ratingGroup = block.querySelector(`[data-testid="rating-group-${question.id}"]`);
              expect(ratingGroup).not.toBeNull();
              const buttons = ratingGroup!.querySelectorAll('button');
              expect(buttons).toHaveLength(5);
            } else if (question.type === 'text') {
              // Text: an input element
              const input = block.querySelector('input[type="text"], input:not([type])');
              expect(input).not.toBeNull();
            } else if (question.type === 'multiChoice') {
              // MultiChoice: radio buttons for each option
              const radios = block.querySelectorAll('input[type="radio"]');
              expect(radios).toHaveLength(question.options?.length ?? 0);
            }
          });
        } finally {
          cleanup();
        }
      }),
      { numRuns: 30 }
    );
  }, 60000);
});
