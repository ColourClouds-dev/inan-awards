export class PDFDocument {
  objects: string[] = [];

  addObject(content: string): number {
    this.objects.push(content);
    return this.objects.length;
  }

  updateObject(index: number, content: string) {
    this.objects[index] = content;
  }

  build(): Blob {
    const header = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n';
    const offsets: number[] = [];
    let currentOffset = header.length;

    const objectBytes: string[] = [];
    for (let i = 0; i < this.objects.length; i++) {
      offsets.push(currentOffset);
      const objStr = `${i + 1} 0 obj\n${this.objects[i]}\nendobj\n`;
      objectBytes.push(objStr);
      currentOffset += objStr.length;
    }

    const startXref = currentOffset;
    let xref = `xref\n0 ${this.objects.length + 1}\n0000000000 65535 f \n`;
    for (let i = 0; i < this.objects.length; i++) {
      const offsetStr = String(offsets[i]).padStart(10, '0');
      xref += `${offsetStr} 00000 n \n`;
    }

    const trailer = `trailer\n<< /Size ${this.objects.length + 1} /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF\n`;
    const fullContent = header + objectBytes.join('') + xref + trailer;

    const buf = new Uint8Array(fullContent.length);
    for (let i = 0; i < fullContent.length; i++) {
      buf[i] = fullContent.charCodeAt(i) & 0xff;
    }

    return new Blob([buf], { type: 'application/pdf' });
  }
}

function escapePdfString(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function cleanText(str: string): string {
  if (!str) return '';
  return str
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[^\x00-\xFF]/g, '?');
}

function wrapText(text: string, maxChars: number = 75): string[] {
  if (!text) return [''];
  const paragraphs = text.split('\n');
  const lines: string[] = [];

  for (const p of paragraphs) {
    const words = p.split(' ');
    let currentLine = '';
    for (const word of words) {
      if ((currentLine + word).length > maxChars) {
        if (currentLine) lines.push(currentLine.trim());
        currentLine = word + ' ';
      } else {
        currentLine += word + ' ';
      }
    }
    if (currentLine) lines.push(currentLine.trim());
  }
  return lines;
}

export function generateResponsePDF(
  title: string,
  dateStr: string,
  qas: { question: string; answer: string }[]
): Blob {
  const doc = new PDFDocument();

  // Create formatting item structure
  const items: Array<{ font: string; size: number; text: string; leading: number }> = [];

  // Title block
  items.push({ font: '/F2', size: 16, text: cleanText(title), leading: 22 });
  items.push({ font: '/F1', size: 10, text: `Submitted on: ${cleanText(dateStr)}`, leading: 14 });
  items.push({ font: '/F1', size: 10, text: '', leading: 14 }); // spacer

  // Q&A Blocks
  qas.forEach((qa, index) => {
    const questionText = `Question ${index + 1}: ${qa.question}`;
    const questionWrapped = wrapText(questionText, 70);
    questionWrapped.forEach(line => {
      items.push({ font: '/F2', size: 10, text: cleanText(line), leading: 14 });
    });

    const answerWrapped = wrapText(qa.answer, 70);
    answerWrapped.forEach(line => {
      items.push({ font: '/F1', size: 10, text: cleanText(line), leading: 14 });
    });

    items.push({ font: '/F1', size: 10, text: '', leading: 14 }); // spacer between Qs
  });

  // Split items into pages. Page height is 842. Margins: top 780, bottom 60. Printable area: 720.
  const pagesData: Array<typeof items> = [];
  let currentPage: typeof items = [];
  let currentY = 780;

  for (const item of items) {
    if (item.text === '' && currentPage.length === 0) continue; // skip trailing space at page top

    if (currentY - item.leading < 60) {
      pagesData.push(currentPage);
      currentPage = [];
      currentY = 780;
    }
    currentPage.push(item);
    currentY -= item.leading;
  }
  if (currentPage.length > 0) {
    pagesData.push(currentPage);
  }

  // Set up standard objects
  doc.addObject('<< /Type /Catalog /Pages 2 0 R >>');
  const pagesObjIndex = doc.addObject(''); // Placeholder for Object 2

  // Fonts
  doc.addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'); // Object 3 (F1)
  doc.addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>'); // Object 4 (F2)

  const pageIndices: number[] = [];

  pagesData.forEach((pageItems) => {
    const pageId = doc.objects.length + 1;
    const streamId = doc.objects.length + 2;
    pageIndices.push(pageId);

    // Build content stream
    let streamText = 'BT\n';
    streamText += '50 780 Td\n'; // Start offset

    let currentFont = '';
    let currentSize = 0;

    pageItems.forEach((item, idx) => {
      if (idx > 0) {
        streamText += `0 -${item.leading} Td\n`;
      }
      if (item.font !== currentFont || item.size !== currentSize) {
        streamText += `${item.font} ${item.size} Tf\n`;
        currentFont = item.font;
        currentSize = item.size;
      }
      if (item.text) {
        streamText += `(${escapePdfString(item.text)}) Tj\n`;
      }
    });
    streamText += 'ET\n';

    doc.addObject(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${streamId} 0 R >>`);
    doc.addObject(`<< /Length ${streamText.length} >>\nstream\n${streamText}endstream`);
  });

  // Overwrite the pages list (Object 2) with the correct child references
  const kidsStr = pageIndices.map(idx => `${idx} 0 R`).join(' ');
  doc.updateObject(pagesObjIndex - 1, `<< /Type /Pages /Kids [${kidsStr}] /Count ${pageIndices.length} >>`);

  return doc.build();
}
