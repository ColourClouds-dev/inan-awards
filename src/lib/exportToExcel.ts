import * as XLSX from 'xlsx';
import type { FeedbackResponse, FeedbackForm } from '../types';

export function exportToExcel(responses: FeedbackResponse[], forms: FeedbackForm[]): void {
  const formMap = new Map<string, string>(forms.map(f => [f.id, f.title]));

  const rows = responses.map(response => {
    const formTitle = formMap.get(response.formId) ?? response.formId;

    const submittedAt =
      response.submittedAt instanceof Date
        ? response.submittedAt.toISOString()
        : typeof (response.submittedAt as { toDate?: () => Date }).toDate === 'function'
          ? (response.submittedAt as { toDate: () => Date }).toDate().toISOString()
          : String(response.submittedAt);

    const row: Record<string, string | number> = {
      'Form Title': formTitle,
      Location: response.location,
      'Submitted At': submittedAt,
    };

    for (const [questionId, answer] of Object.entries(response.responses)) {
      row[questionId] = answer;
    }

    return row;
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Responses');

  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const filename = `feedback-responses-${yyyy}-${mm}-${dd}.xlsx`;

  XLSX.writeFile(workbook, filename);
}
