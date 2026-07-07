export function downloadCSV(filename: string, qas: { question: string; answer: string }[]) {
  const headers = ['Question', 'Answer'];
  
  const escapeCSV = (text: string) => {
    if (text === null || text === undefined) return '';
    const str = String(text);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headerRow = headers.join(',');
  const dataRows = qas.map(qa => `${escapeCSV(qa.question)},${escapeCSV(qa.answer)}`);
  const csvContent = [headerRow, ...dataRows].join('\r\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  
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
