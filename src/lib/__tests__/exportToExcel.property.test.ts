// Feature: feedback-form-refactor, Property 14: Export filename includes current date

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import * as XLSX from 'xlsx';

// Mock the xlsx module so XLSX.writeFile doesn't try to write to disk
vi.mock('xlsx', async () => {
  const actual = await vi.importActual<typeof XLSX>('xlsx');
  return {
    ...actual,
    writeFile: vi.fn(),
  };
});

import { exportToExcel } from '../exportToExcel';
import type { FeedbackResponse, FeedbackForm } from '../../types';

describe('Property 14: Export filename includes current date', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('filename matches feedback-responses-YYYY-MM-DD.xlsx for any date', () => {
    // Arbitrary: any date between year 2000 and 2099
    const dateArb = fc.date({
      min: new Date('2000-01-01T00:00:00.000Z'),
      max: new Date('2099-12-31T23:59:59.999Z'),
    });

    fc.assert(
      fc.property(dateArb, (date) => {
        vi.useFakeTimers();
        vi.setSystemTime(date);

        const responses: FeedbackResponse[] = [];
        const forms: FeedbackForm[] = [];

        exportToExcel(responses, forms);

        const writeFileMock = vi.mocked(XLSX.writeFile);
        expect(writeFileMock).toHaveBeenCalledOnce();

        const calledFilename = writeFileMock.mock.calls[0][1] as string;

        // Build expected filename using local date (same logic as implementation)
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        const expectedFilename = `feedback-responses-${yyyy}-${mm}-${dd}.xlsx`;

        expect(calledFilename).toBe(expectedFilename);

        vi.clearAllMocks();
        vi.useRealTimers();
      }),
      { numRuns: 100 }
    );
  });
});
