// Feature: feedback-form-refactor, Property 1: Form save produces a complete document
// Feature: feedback-form-refactor, Property 15: Deactivate form sets isActive to false
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';

// Hoist mock functions so they are available inside vi.mock factories
const { mockSetDoc, mockUpdateDoc } = vi.hoisted(() => ({
  mockSetDoc: vi.fn(),
  mockUpdateDoc: vi.fn(),
}));

// Mock firebase modules before importing firestore
vi.mock('../../lib/firebase', () => ({ db: {} }));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn((_db, _col, id) => ({ id })),
  getDocs: vi.fn(),
  getDoc: vi.fn(),
  addDoc: vi.fn(),
  setDoc: mockSetDoc,
  updateDoc: mockUpdateDoc,
  orderBy: vi.fn(),
  query: vi.fn(),
}));

import { saveForm, deactivateForm } from '../firestore';
import type { FeedbackForm, FeedbackQuestion } from '../../types';

const questionArb: fc.Arbitrary<FeedbackQuestion> = fc.record({
  id: fc.uuid(),
  type: fc.constantFrom('rating', 'text', 'multiChoice') as fc.Arbitrary<'rating' | 'text' | 'multiChoice'>,
  question: fc.string({ minLength: 1 }),
  required: fc.boolean(),
});

const formArb: fc.Arbitrary<FeedbackForm> = fc.record({
  id: fc.uuid(),
  title: fc.string({ minLength: 1 }),
  location: fc.constantFrom('Qaras Hotels: House 3', 'Qaras Hotels: Bluxton'),
  questions: fc.array(questionArb, { minLength: 1 }),
  createdAt: fc.date(),
  isActive: fc.constant(true),
});

// **Validates: Requirements 1.1, 1.2**
describe('Property 1: Form save produces a complete document', () => {
  beforeEach(() => {
    mockSetDoc.mockReset();
    mockSetDoc.mockResolvedValue(undefined);
  });

  it('written document contains all required fields', async () => {
    await fc.assert(
      fc.asyncProperty(formArb, async (form) => {
        await saveForm(form);
        expect(mockSetDoc).toHaveBeenCalledOnce();
        const [, writtenDoc] = mockSetDoc.mock.calls[0];
        expect(writtenDoc).toMatchObject({
          id: form.id,
          title: form.title,
          location: form.location,
          questions: form.questions,
          isActive: true,
        });
        expect(writtenDoc).toHaveProperty('createdAt');
        mockSetDoc.mockReset();
        mockSetDoc.mockResolvedValue(undefined);
      }),
      { numRuns: 100 }
    );
  });
});

// **Validates: Requirements 4.3**
describe('Property 15: Deactivate form sets isActive to false', () => {
  beforeEach(() => {
    mockUpdateDoc.mockReset();
    mockUpdateDoc.mockResolvedValue(undefined);
  });

  it('calls updateDoc with { isActive: false } for any form ID', async () => {
    await fc.assert(
      fc.asyncProperty(fc.uuid(), async (formId) => {
        await deactivateForm(formId);
        expect(mockUpdateDoc).toHaveBeenCalledOnce();
        const [, update] = mockUpdateDoc.mock.calls[0];
        expect(update).toEqual({ isActive: false });
        mockUpdateDoc.mockReset();
        mockUpdateDoc.mockResolvedValue(undefined);
      }),
      { numRuns: 100 }
    );
  });
});
