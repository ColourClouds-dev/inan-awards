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
