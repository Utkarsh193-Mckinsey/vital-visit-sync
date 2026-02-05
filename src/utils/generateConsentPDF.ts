import jsPDF from 'jspdf';

interface ConsentPDFData {
  patientName: string;
  patientDOB: string;
  patientPhone: string;
  treatmentName: string;
  consentFormName: string;
  consentText: string;
  consentTextAr?: string;
  signatureDataUrl: string;
  signedDate: Date;
  language?: 'en' | 'ar';
}

export async function generateConsentPDF(data: ConsentPDFData): Promise<Blob> {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - (margin * 2);
  let yPosition = margin;

  // Helper function to check and add new page if needed
  const checkNewPage = (requiredSpace: number = 30) => {
    if (yPosition > pageHeight - requiredSpace) {
      pdf.addPage();
      yPosition = margin;
    }
  };

  // ==========================================
  // HEADER - Clinic Name
  // ==========================================
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Cosmique Aesthetic and Dermatology Clinic', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 12;

  // ==========================================
  // FORM TITLE - Bilingual
  // ==========================================
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  
  // Get Arabic form name based on treatment
  const arabicFormName = getArabicFormName(data.consentFormName);
  const bilingualTitle = `${data.consentFormName} / ${arabicFormName}`;
  pdf.text(bilingualTitle, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 12;

  // Divider line
  pdf.setLineWidth(0.5);
  pdf.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 8;

  // ==========================================
  // PATIENT INFORMATION - Bilingual Labels
  // ==========================================
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');

  // Patient Name
  pdf.text(`Patient Name / اسم المريض: ${data.patientName}`, margin, yPosition);
  yPosition += 6;

  // Date of Birth
  pdf.text(`Date of Birth / تاريخ الميلاد: ${formatDate(data.patientDOB)}`, margin, yPosition);
  yPosition += 6;

  // Contact Number
  pdf.text(`Contact Number / رقم التواصل: ${data.patientPhone}`, margin, yPosition);
  yPosition += 6;

  // Procedure Date
  pdf.text(`Procedure Date / تاريخ الإجراء: ${formatDate(data.signedDate.toISOString())}`, margin, yPosition);
  yPosition += 10;

  // Divider line
  pdf.setLineWidth(0.3);
  pdf.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 8;

  // ==========================================
  // CONSENT TEXT - Show based on selected language
  // ==========================================
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');

  // Replace placeholders in consent text
  let processedText = data.consentText
    .replace(/\[PATIENT_NAME\]/gi, data.patientName)
    .replace(/\[patient name\]/gi, data.patientName)
    .replace(/\[patient's name\]/gi, data.patientName)
    .replace(/\[DATE\]/gi, formatDate(data.signedDate.toISOString()))
    .replace(/\[TREATMENT_NAME\]/gi, data.treatmentName)
    .replace(/\[treatment name\]/gi, data.treatmentName)
    .replace(/\[treatment\]/gi, data.treatmentName);

  // Split and render English text
  const englishLines = pdf.splitTextToSize(processedText, contentWidth);
  
  for (const line of englishLines) {
    checkNewPage();
    pdf.text(line, margin, yPosition);
    yPosition += 4.5;
  }

  // If Arabic text is provided, add it after English
  if (data.consentTextAr) {
    yPosition += 8;
    checkNewPage(40);
    
    // Arabic section divider
    pdf.setLineWidth(0.2);
    pdf.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 6;

    // Arabic header
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    pdf.text('النص العربي / Arabic Text', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 8;

    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');

    // Replace placeholders in Arabic text
    let processedArabicText = data.consentTextAr
      .replace(/\[PATIENT_NAME\]/gi, data.patientName)
      .replace(/\[patient name\]/gi, data.patientName)
      .replace(/\[DATE\]/gi, formatDate(data.signedDate.toISOString()))
      .replace(/\[TREATMENT_NAME\]/gi, data.treatmentName)
      .replace(/\[treatment name\]/gi, data.treatmentName);

    // Split Arabic text - note: jsPDF has limited Arabic support
    // We'll render it as-is, which may have rendering issues with complex Arabic
    const arabicLines = pdf.splitTextToSize(processedArabicText, contentWidth);
    
    for (const line of arabicLines) {
      checkNewPage();
      // Right-align Arabic text
      pdf.text(line, pageWidth - margin, yPosition, { align: 'right' });
      yPosition += 4.5;
    }
  }

  yPosition += 10;
  checkNewPage(60);

  // ==========================================
  // SIGNATURE SECTION
  // ==========================================
  // Divider line
  pdf.setLineWidth(0.3);
  pdf.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 8;

  // Signature header
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Patient Signature / توقيع المريض', margin, yPosition);
  yPosition += 8;

  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.text(
    'I confirm that I have read, understood, and agree to the terms above.',
    margin,
    yPosition
  );
  yPosition += 4;
  pdf.text(
    'أؤكد أنني قرأت وفهمت ووافقت على الشروط أعلاه.',
    pageWidth - margin,
    yPosition,
    { align: 'right' }
  );
  yPosition += 10;

  // Add signature image
  try {
    const signatureImage = await loadImage(data.signatureDataUrl);
    const sigWidth = 60;
    const sigHeight = 25;
    pdf.addImage(signatureImage, 'PNG', margin, yPosition, sigWidth, sigHeight);
    yPosition += sigHeight + 2;
  } catch (error) {
    console.error('Error adding signature to PDF:', error);
    pdf.text('[Signature on file]', margin, yPosition);
    yPosition += 10;
  }

  // Signature line
  pdf.setLineWidth(0.5);
  pdf.line(margin, yPosition, margin + 70, yPosition);
  yPosition += 5;

  pdf.setFontSize(8);
  pdf.text('Patient Signature / توقيع المريض', margin, yPosition);
  yPosition += 8;

  // Date line
  pdf.text(`Date / التاريخ: ${formatDateTime(data.signedDate)}`, margin, yPosition);
  yPosition += 15;

  // ==========================================
  // PRACTITIONER SECTION
  // ==========================================
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Practitioner Details / تفاصيل الممارس', margin, yPosition);
  yPosition += 8;

  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  
  // Practitioner name line
  pdf.text('Practitioner Name / اسم الممارس: _______________________________', margin, yPosition);
  yPosition += 8;

  // Practitioner signature line
  pdf.text('Signature / التوقيع: _______________________________', margin, yPosition);
  yPosition += 8;

  // Date line
  pdf.text('Date / التاريخ: _______________________________', margin, yPosition);

  // ==========================================
  // FOOTER
  // ==========================================
  pdf.setFontSize(7);
  pdf.setTextColor(128, 128, 128);
  pdf.text(
    `Document generated on ${formatDateTime(new Date())} | Cosmique Aesthetic and Dermatology Clinic`,
    pageWidth / 2,
    pageHeight - 10,
    { align: 'center' }
  );

  return pdf.output('blob');
}

function getArabicFormName(englishName: string): string {
  const arabicNames: Record<string, string> = {
    'Fillers Consent Form': 'نموذج موافقة حقن الفيلر',
    'IV Therapy Consent Form': 'نموذج الموافقة للعلاج الوريدي',
    'Mounjaro Consent Form': 'نموذج موافقة مونجارو',
    'HIFU Consent Form': 'نموذج موافقة الهايفو',
    'GFC Consent Form': 'نموذج موافقة GFC',
    'Skin Booster Consent Form': 'نموذج موافقة البوستر للبشرة',
    'Subcision Consent Form': 'نموذج موافقة الساسبيشن',
  };
  return arabicNames[englishName] || 'نموذج الموافقة';
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
