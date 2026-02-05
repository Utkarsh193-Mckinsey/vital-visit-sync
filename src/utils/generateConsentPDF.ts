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
  language?: 'en' | 'ar';
}

export async function generateConsentPDF(data: ConsentPDFData): Promise<Blob> {
  const isArabic = data.language === 'ar';
  
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - (margin * 2);
  let yPosition = margin;

  // Clinic Header
  pdf.setFontSize(20);
  pdf.setFont('helvetica', 'bold');
  pdf.text('COSMIQUE', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 6;
  
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.text('Aesthetics and Dermatology Clinic', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 12;

  // Form Title
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.text('CONSENT FORM', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 8;

  // Treatment/form name
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.text(data.consentFormName, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 12;

  // Divider line
  pdf.setLineWidth(0.5);
  pdf.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 10;

  // Patient Information Section
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  const patientInfoTitle = isArabic ? 'Patient Information / معلومات المريض' : 'PATIENT INFORMATION';
  pdf.text(patientInfoTitle, margin, yPosition);
  yPosition += 8;

  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  
  const patientNameLabel = isArabic ? `Patient Name / اسم المريض: ${data.patientName}` : `Patient Name: ${data.patientName}`;
  pdf.text(patientNameLabel, margin, yPosition);
  yPosition += 6;
  
  const dobLabel = isArabic ? `Date of Birth / تاريخ الميلاد: ${formatDate(data.patientDOB)}` : `Date of Birth: ${formatDate(data.patientDOB)}`;
  pdf.text(dobLabel, margin, yPosition);
  yPosition += 6;
  
  const phoneLabel = isArabic ? `Contact Number / رقم التواصل: ${data.patientPhone}` : `Phone: ${data.patientPhone}`;
  pdf.text(phoneLabel, margin, yPosition);
  yPosition += 6;
  
  const procedureDateLabel = isArabic ? `Procedure Date / تاريخ الإجراء: ${formatDate(data.signedDate.toISOString())}` : `Treatment: ${data.treatmentName}`;
  pdf.text(procedureDateLabel, margin, yPosition);
  yPosition += 12;

  // Divider line
  pdf.setLineWidth(0.3);
  pdf.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 10;

  // Consent Text Section
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  const consentTermsTitle = isArabic ? 'CONSENT TERMS / شروط الموافقة' : 'CONSENT TERMS';
  pdf.text(consentTermsTitle, margin, yPosition);
  yPosition += 8;

  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');

  // Replace placeholders in consent text
  let processedConsentText = data.consentText
    .replace(/\[PATIENT_NAME\]/g, data.patientName)
    .replace(/\[patient_name\]/gi, data.patientName)
    .replace(/\[patient name\]/gi, data.patientName)
    .replace(/\[patient's name\]/gi, data.patientName)
    .replace(/I patient name/gi, `I, ${data.patientName},`)
    .replace(/I, patient name,/gi, `I, ${data.patientName},`)
    .replace(/\[DATE\]/g, formatDate(data.signedDate.toISOString()))
    .replace(/\[date\]/gi, formatDate(data.signedDate.toISOString()))
    .replace(/\[TREATMENT_NAME\]/g, data.treatmentName)
    .replace(/\[treatment_name\]/gi, data.treatmentName)
    .replace(/\[treatment name\]/gi, data.treatmentName)
    .replace(/\[treatment\]/gi, data.treatmentName);

  // Split consent text into lines that fit the page width
  const consentLines = pdf.splitTextToSize(processedConsentText, contentWidth);
  
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
  const signatureTitle = isArabic ? 'PATIENT SIGNATURE / توقيع المريض' : 'PATIENT SIGNATURE';
  pdf.text(signatureTitle, margin, yPosition);
  yPosition += 8;

  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  const signatureAcknowledgement = isArabic 
    ? 'By signing below, I acknowledge that I have read, understood, and agree to the terms above.'
    : 'By signing below, I acknowledge that I have read, understood, and agree to the terms above.';
  pdf.text(signatureAcknowledgement, margin, yPosition);
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
  const patientSigLabel = isArabic ? 'Patient Signature / توقيع المريض' : 'Patient Signature';
  pdf.text(patientSigLabel, margin, yPosition);
  
  // Date
  const dateLabel = isArabic ? `Date / التاريخ: ${formatDateTime(data.signedDate)}` : `Date: ${formatDateTime(data.signedDate)}`;
  pdf.text(dateLabel, margin + 100, yPosition);
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
