import * as XLSX from 'xlsx';
import type { FeedbackResponse, FeedbackForm } from '../types';

export function exportFeedbackToCSV(responses: FeedbackResponse[], forms: FeedbackForm[]): void {
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
  const filename = `feedback-responses-${yyyy}-${mm}-${dd}.csv`;

  XLSX.writeFile(workbook, filename, { bookType: 'csv' });
}

export function exportToCSV(data: any[], filename: string) {
  // Convert data to CSV format
  const csvContent = convertToCSV(data);
  
  // Create a blob with the CSV content
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  
  // Create a download link
  const link = document.createElement('a');
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

function convertToCSV(data: any[]): string {
  if (data.length === 0) return '';

  // Get headers from the first object
  const headers = Object.keys(data[0]);
  
  // Create CSV header row
  const headerRow = headers.join(',');
  
  // Create CSV data rows
  const rows = data.map(obj => 
    headers.map(header => {
      const value = obj[header];
      // Handle special cases (null, undefined, objects, etc.)
      if (value === null || value === undefined) return '';
      if (typeof value === 'object') return JSON.stringify(value);
      // Escape quotes and wrap in quotes if contains comma
      const stringValue = String(value);
      if (stringValue.includes(',') || stringValue.includes('"')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    }).join(',')
  );
  
  // Combine header and rows
  return [headerRow, ...rows].join('\n');
}

export function formatFeedbackForCSV(responses: any[]) {
  return responses.map(response => {
    // Flatten the responses object
    const flattenedResponses: { [key: string]: any } = {};
    Object.entries(response.responses).forEach(([questionId, answer]) => {
      flattenedResponses[`Question ${questionId}`] = answer;
    });

    return {
      Date: new Date(response.submittedAt.seconds * 1000).toLocaleDateString(),
      Location: response.location,
      ...flattenedResponses
    };
  });
}
