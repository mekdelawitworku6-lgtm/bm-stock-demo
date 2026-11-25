import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface PdfReportMetric {
  label: string;
  value: string;
}

export interface PdfReportTable {
  title?: string;
  headers: string[];
  rows: (string | number)[][];
}

export interface GenerateReportPdfOptions {
  reportTitle: string;
  companyName?: string;
  period?: string;
  metrics?: PdfReportMetric[];
  tables?: PdfReportTable[];
  fileName?: string;
}

export function generateReportPdf({
  reportTitle,
  companyName = 'BM Stock Store',
  period = 'Today',
  metrics = [],
  tables = [],
  fileName,
}: GenerateReportPdfOptions) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const primaryColor: [number, number, number] = [2, 94, 167]; // #025EA7
  const darkColor: [number, number, number] = [15, 23, 42]; // #0F172A
  const slateColor: [number, number, number] = [100, 116, 139]; // #64748B
  const lightBg: [number, number, number] = [248, 250, 252]; // #F8FAFC

  let currentY = 15;

  // Header Banner
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, 210, 22, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text('BM STOCK', 14, 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('Inventory & Management System', 196, 14, { align: 'right' });

  currentY = 30;

  // Title Section
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...darkColor);
  doc.text(reportTitle, 14, currentY);

  currentY += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...slateColor);
  const nowStr = new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
  doc.text(`Company: ${companyName}   |   Period: ${period.toUpperCase()}   |   Generated: ${nowStr}`, 14, currentY);

  currentY += 8;

  // Metrics Section (Cards layout)
  if (metrics.length > 0) {
    const cardWidth = (210 - 28 - (metrics.length - 1) * 4) / Math.min(metrics.length, 4);
    const cardHeight = 16;

    metrics.slice(0, 4).forEach((m, idx) => {
      const x = 14 + idx * (cardWidth + 4);
      doc.setFillColor(...lightBg);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(x, currentY, cardWidth, cardHeight, 2, 2, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...slateColor);
      doc.text(m.label.toUpperCase(), x + 4, currentY + 5);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(...primaryColor);
      doc.text(m.value, x + 4, currentY + 12);
    });

    currentY += cardHeight + 8;
  }

  // Tables Section
  tables.forEach((t) => {
    if (t.title) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(...darkColor);
      doc.text(t.title, 14, currentY);
      currentY += 4;
    }

    autoTable(doc, {
      startY: currentY,
      head: [t.headers],
      body: t.rows.map((r) => r.map((cell) => (cell === null || cell === undefined ? '—' : String(cell)))),
      headStyles: {
        fillColor: primaryColor,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 9,
      },
      bodyStyles: {
        fontSize: 8,
        textColor: darkColor,
      },
      alternateRowStyles: {
        fillColor: [241, 245, 249],
      },
      margin: { left: 14, right: 14 },
      didDrawPage: (data) => {
        currentY = data.cursor?.y ? data.cursor.y + 8 : currentY + 10;
      },
    });

    currentY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 10 : currentY + 10;
  });

  // Footer (on each page)
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...slateColor);
    doc.text(`Page ${i} of ${totalPageCount(doc)}`, 196, 287, { align: 'right' });
    doc.text(`BM Stock Confidential Document — ${companyName}`, 14, 287);
  }

  const safeTitle = reportTitle.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  const name = fileName || `${safeTitle}_report_${period.toLowerCase()}.pdf`;
  doc.save(name);
}

function totalPageCount(doc: jsPDF): number {
  return (doc as any).internal.getNumberOfPages();
}
