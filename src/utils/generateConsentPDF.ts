import jsPDF from 'jspdf';
import { loadAmiriFontFromBundle } from './fonts/amiriFontBase64';

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

// Cache the font to avoid loading it multiple times
let cachedAmiriFont: string | null = null;

async function getAmiriFont(): Promise<string> {
  if (cachedAmiriFont) return cachedAmiriFont;
  cachedAmiriFont = await loadAmiriFontFromBundle();
  return cachedAmiriFont;
}

export async function generateConsentPDF(data: ConsentPDFData): Promise<Blob> {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Load and embed Amiri font for Arabic support
  try {
    const amiriBase64 = await getAmiriFont();
    pdf.addFileToVFS('Amiri-Regular.ttf', amiriBase64);
    pdf.addFont('Amiri-Regular.ttf', 'Amiri', 'normal');
  } catch (error) {
    console.warn('Could not load Amiri font, Arabic may not render correctly:', error);
  }

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

  // Helper to set English font
  const setEnglishFont = (style: 'normal' | 'bold' = 'normal') => {
    pdf.setFont('helvetica', style);
  };

  // Helper to set Arabic font
  const setArabicFont = () => {
    try {
      pdf.setFont('Amiri', 'normal');
    } catch {
      pdf.setFont('helvetica', 'normal');
    }
  };

  // ==========================================
  // HEADER - Clinic Name
  // ==========================================
  setEnglishFont('bold');
  pdf.setFontSize(16);
  pdf.text('Cosmique Aesthetic and Dermatology Clinic', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 12;

  // ==========================================
  // FORM TITLE - Bilingual
  // ==========================================
  pdf.setFontSize(14);
  
  // English title
  setEnglishFont('bold');
  const arabicFormName = getArabicFormName(data.consentFormName);
  pdf.text(`${data.consentFormName} / `, pageWidth / 2, yPosition, { align: 'center' });
  
  // Add Arabic title using Amiri font
  const englishTitleWidth = pdf.getTextWidth(`${data.consentFormName} / `);
  setArabicFont();
  pdf.text(arabicFormName, pageWidth / 2 + englishTitleWidth / 2 + 2, yPosition);
  yPosition += 12;

  // Divider line
  pdf.setLineWidth(0.5);
  pdf.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 8;

  // ==========================================
  // PATIENT INFORMATION - Bilingual Labels
  // ==========================================
  pdf.setFontSize(10);

  // Patient Name
  setEnglishFont('normal');
  pdf.text('Patient Name / ', margin, yPosition);
  setArabicFont();
  const nameEnWidth = pdf.getTextWidth('Patient Name / ');
  pdf.text('اسم المريض', margin + nameEnWidth, yPosition);
  setEnglishFont('normal');
  pdf.text(`: ${data.patientName}`, margin + nameEnWidth + pdf.getTextWidth('اسم المريض'), yPosition);
  yPosition += 6;

  // Date of Birth
  setEnglishFont('normal');
  pdf.text('Date of Birth / ', margin, yPosition);
  setArabicFont();
  const dobEnWidth = pdf.getTextWidth('Date of Birth / ');
  pdf.text('تاريخ الميلاد', margin + dobEnWidth, yPosition);
  setEnglishFont('normal');
  pdf.text(`: ${formatDate(data.patientDOB)}`, margin + dobEnWidth + pdf.getTextWidth('تاريخ الميلاد'), yPosition);
  yPosition += 6;

  // Contact Number
  setEnglishFont('normal');
  pdf.text('Contact Number / ', margin, yPosition);
  setArabicFont();
  const contactEnWidth = pdf.getTextWidth('Contact Number / ');
  pdf.text('رقم التواصل', margin + contactEnWidth, yPosition);
  setEnglishFont('normal');
  pdf.text(`: ${data.patientPhone}`, margin + contactEnWidth + pdf.getTextWidth('رقم التواصل'), yPosition);
  yPosition += 6;

  // Procedure Date
  setEnglishFont('normal');
  pdf.text('Procedure Date / ', margin, yPosition);
  setArabicFont();
  const procEnWidth = pdf.getTextWidth('Procedure Date / ');
  pdf.text('تاريخ الإجراء', margin + procEnWidth, yPosition);
  setEnglishFont('normal');
  pdf.text(`: ${formatDate(data.signedDate.toISOString())}`, margin + procEnWidth + pdf.getTextWidth('تاريخ الإجراء'), yPosition);
  yPosition += 10;

  // Divider line
  pdf.setLineWidth(0.3);
  pdf.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 8;

  // ==========================================
  // ENGLISH CONSENT TEXT
  // ==========================================
  pdf.setFontSize(9);
  setEnglishFont('normal');

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

  // ==========================================
  // ARABIC CONSENT TEXT (if provided)
  // ==========================================
  if (data.consentTextAr) {
    yPosition += 8;
    checkNewPage(40);
    
    // Arabic section divider
    pdf.setLineWidth(0.2);
    pdf.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 6;

    // Arabic header
    pdf.setFontSize(10);
    setArabicFont();
    pdf.text('النص العربي', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 8;

    pdf.setFontSize(9);

    // Replace placeholders in Arabic text
    let processedArabicText = data.consentTextAr
      .replace(/\[PATIENT_NAME\]/gi, data.patientName)
      .replace(/\[patient name\]/gi, data.patientName)
      .replace(/\[DATE\]/gi, formatDate(data.signedDate.toISOString()))
      .replace(/\[TREATMENT_NAME\]/gi, data.treatmentName)
      .replace(/\[treatment name\]/gi, data.treatmentName);

    // Split Arabic text and render with Amiri font
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
  setEnglishFont('normal');
  
  // Divider line
  pdf.setLineWidth(0.3);
  pdf.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 8;

  // Signature header - bilingual
  pdf.setFontSize(11);
  setEnglishFont('bold');
  pdf.text('Patient Signature / ', margin, yPosition);
  setArabicFont();
  const sigEnWidth = pdf.getTextWidth('Patient Signature / ');
  pdf.text('توقيع المريض', margin + sigEnWidth, yPosition);
  yPosition += 8;

  pdf.setFontSize(9);
  setEnglishFont('normal');
  pdf.text(
    'I confirm that I have read, understood, and agree to the terms above.',
    margin,
    yPosition
  );
  yPosition += 4;
  setArabicFont();
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
    setEnglishFont('normal');
    pdf.text('[Signature on file]', margin, yPosition);
    yPosition += 10;
  }

  // Signature line
  setEnglishFont('normal');
  pdf.setLineWidth(0.5);
  pdf.line(margin, yPosition, margin + 70, yPosition);
  yPosition += 5;

  pdf.setFontSize(8);
  pdf.text('Patient Signature / ', margin, yPosition);
  setArabicFont();
  pdf.text('توقيع المريض', margin + pdf.getTextWidth('Patient Signature / '), yPosition);
  yPosition += 8;

  // Date line
  setEnglishFont('normal');
  pdf.text('Date / ', margin, yPosition);
  setArabicFont();
  pdf.text('التاريخ', margin + pdf.getTextWidth('Date / '), yPosition);
  setEnglishFont('normal');
  pdf.text(`: ${formatDateTime(data.signedDate)}`, margin + pdf.getTextWidth('Date / ') + pdf.getTextWidth('التاريخ'), yPosition);
  yPosition += 15;

  // ==========================================
  // PRACTITIONER SECTION
  // ==========================================
  pdf.setFontSize(10);
  setEnglishFont('bold');
  pdf.text('Practitioner Details / ', margin, yPosition);
  setArabicFont();
  pdf.text('تفاصيل الممارس', margin + pdf.getTextWidth('Practitioner Details / '), yPosition);
  yPosition += 8;

  pdf.setFontSize(9);
  setEnglishFont('normal');
  
  // Practitioner name line
  pdf.text('Practitioner Name / ', margin, yPosition);
  setArabicFont();
  pdf.text('اسم الممارس', margin + pdf.getTextWidth('Practitioner Name / '), yPosition);
  setEnglishFont('normal');
  pdf.text(': _______________________________', margin + pdf.getTextWidth('Practitioner Name / ') + pdf.getTextWidth('اسم الممارس'), yPosition);
  yPosition += 8;

  // Practitioner signature line
  pdf.text('Signature / ', margin, yPosition);
  setArabicFont();
  pdf.text('التوقيع', margin + pdf.getTextWidth('Signature / '), yPosition);
  setEnglishFont('normal');
  pdf.text(': _______________________________', margin + pdf.getTextWidth('Signature / ') + pdf.getTextWidth('التوقيع'), yPosition);
  yPosition += 8;

  // Date line
  pdf.text('Date / ', margin, yPosition);
  setArabicFont();
  pdf.text('التاريخ', margin + pdf.getTextWidth('Date / '), yPosition);
  setEnglishFont('normal');
  pdf.text(': _______________________________', margin + pdf.getTextWidth('Date / ') + pdf.getTextWidth('التاريخ'), yPosition);

  // ==========================================
  // FOOTER
  // ==========================================
  setEnglishFont('normal');
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
