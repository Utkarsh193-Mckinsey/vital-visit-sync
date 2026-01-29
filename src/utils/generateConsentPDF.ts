import jsPDF from 'jspdf';

interface ConsentPDFData {
  patientName: string;
  patientDOB: string;
  patientPhone: string;
  treatmentName: string;
  consentFormName: string;
  consentText: string;
  signatureDataUrl: string;
  signedDate: Date;
}

export async function generateConsentPDF(data: ConsentPDFData): Promise<Blob> {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - (margin * 2);
  let yPosition = margin;

  // Header
  pdf.setFontSize(18);
  pdf.setFont('helvetica', 'bold');
  pdf.text('CONSENT FORM', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 10;

  // Treatment name
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.text(data.consentFormName, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 15;

  // Divider line
  pdf.setLineWidth(0.5);
  pdf.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 10;

  // Patient Information Section
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.text('PATIENT INFORMATION', margin, yPosition);
  yPosition += 8;

  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  
  pdf.text(`Patient Name: ${data.patientName}`, margin, yPosition);
  yPosition += 6;
  
  pdf.text(`Date of Birth: ${formatDate(data.patientDOB)}`, margin, yPosition);
  yPosition += 6;
  
  pdf.text(`Phone: ${data.patientPhone}`, margin, yPosition);
  yPosition += 6;
  
  pdf.text(`Treatment: ${data.treatmentName}`, margin, yPosition);
  yPosition += 12;

  // Divider line
  pdf.setLineWidth(0.3);
  pdf.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 10;

  // Consent Text Section
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.text('CONSENT TERMS', margin, yPosition);
  yPosition += 8;

  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');

  // Split consent text into lines that fit the page width
  const consentLines = pdf.splitTextToSize(data.consentText, contentWidth);
  
  for (const line of consentLines) {
    // Check if we need a new page
    if (yPosition > 250) {
      pdf.addPage();
      yPosition = margin;
    }
    pdf.text(line, margin, yPosition);
    yPosition += 5;
  }

  yPosition += 10;

  // Check if signature section needs new page
  if (yPosition > 220) {
    pdf.addPage();
    yPosition = margin;
  }

  // Divider line
  pdf.setLineWidth(0.3);
  pdf.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 10;

  // Signature Section
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.text('PATIENT SIGNATURE', margin, yPosition);
  yPosition += 8;

  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.text(
    'By signing below, I acknowledge that I have read, understood, and agree to the terms above.',
    margin,
    yPosition
  );
  yPosition += 10;

  // Add signature image
  try {
    const signatureImage = await loadImage(data.signatureDataUrl);
    const sigWidth = 60;
    const sigHeight = 25;
    pdf.addImage(signatureImage, 'PNG', margin, yPosition, sigWidth, sigHeight);
    yPosition += sigHeight + 5;
  } catch (error) {
    console.error('Error adding signature to PDF:', error);
    pdf.text('[Signature on file]', margin, yPosition);
    yPosition += 10;
  }

  // Signature line
  pdf.line(margin, yPosition, margin + 80, yPosition);
  yPosition += 5;
  pdf.setFontSize(8);
  pdf.text('Patient Signature', margin, yPosition);
  
  // Date
  pdf.text(`Date: ${formatDateTime(data.signedDate)}`, margin + 100, yPosition);
  yPosition += 15;

  // Footer
  pdf.setFontSize(8);
  pdf.setTextColor(128, 128, 128);
  pdf.text(
    `Document generated on ${formatDateTime(new Date())}`,
    pageWidth / 2,
    pdf.internal.pageSize.getHeight() - 10,
    { align: 'center' }
  );

  return pdf.output('blob');
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-AE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatDateTime(date: Date): string {
  return date.toLocaleString('en-AE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}
