import jsPDF from 'jspdf';
import { loadAmiriFontFromBundle } from './fonts/amiriFontBase64';
import cosmiqueSymbol from '@/assets/cosmique-symbol.png';

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
  dosage?: string;
  photoVideoSignatureDataUrl?: string;
}

// Cache the font to avoid loading it multiple times
let cachedAmiriFont: string | null = null;

async function getAmiriFont(): Promise<string> {
  if (cachedAmiriFont) return cachedAmiriFont;
  cachedAmiriFont = await loadAmiriFontFromBundle();
  return cachedAmiriFont;
}

// Load logo image
async function loadLogoImage(): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = cosmiqueSymbol;
  });
}

export async function generateConsentPDF(data: ConsentPDFData): Promise<Blob> {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Load and embed Amiri font for Arabic support
  let hasAmiriFont = false;
  try {
    const amiriBase64 = await getAmiriFont();
    pdf.addFileToVFS('Amiri-Regular.ttf', amiriBase64);
    pdf.addFont('Amiri-Regular.ttf', 'Amiri', 'normal');
    hasAmiriFont = true;
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
    if (hasAmiriFont) {
      pdf.setFont('Amiri', 'normal');
    } else {
      pdf.setFont('helvetica', 'normal');
    }
  };

  // Draw section divider line
  const drawDivider = () => {
    yPosition += 4;
    pdf.setDrawColor(0, 0, 0);
    pdf.setLineWidth(0.3);
    pdf.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 8;
  };

  // ==========================================
  // HEADER - Logo and Clinic Name
  // ==========================================
  try {
    const logo = await loadLogoImage();
    // Calculate aspect ratio to prevent stretching
    const originalWidth = logo.naturalWidth || logo.width;
    const originalHeight = logo.naturalHeight || logo.height;
    const aspectRatio = originalWidth / originalHeight;
    
    const logoHeight = 25;
    const logoWidth = logoHeight * aspectRatio;
    
    pdf.addImage(logo, 'PNG', (pageWidth - logoWidth) / 2, yPosition, logoWidth, logoHeight);
    yPosition += logoHeight + 5;
  } catch (error) {
    console.warn('Could not load logo:', error);
    yPosition += 10;
  }

  // Clinic name
  setEnglishFont('bold');
  pdf.setFontSize(18);
  pdf.setTextColor(0, 0, 0);
  pdf.text('COSMIQUE', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 6;
  
  pdf.setFontSize(10);
  setEnglishFont('normal');
  pdf.text('Aesthetics and Dermatology Clinic', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 12;

  // ==========================================
  // FORM TITLE - Red color
  // ==========================================
  pdf.setFontSize(14);
  setEnglishFont('bold');
  pdf.setTextColor(200, 50, 50); // Red color
  const treatmentTitle = getTreatmentTitle(data.treatmentName);
  pdf.text(`Consent Form - ${treatmentTitle}`, pageWidth / 2, yPosition, { align: 'center' });
  pdf.setTextColor(0, 0, 0); // Reset to black
  yPosition += 12;

  // ==========================================
  // PATIENT INFORMATION - Properly formatted
  // ==========================================
  pdf.setFontSize(11);
  
  // Patient Name - with underline extending to right margin
  setEnglishFont('bold');
  pdf.text('Patient Name:', margin, yPosition);
  const nameLabelWidth = pdf.getTextWidth('Patient Name:');
  setEnglishFont('normal');
  pdf.text(' ' + data.patientName, margin + nameLabelWidth, yPosition);
  // Draw underline from after name to right margin
  const nameTextWidth = pdf.getTextWidth(' ' + data.patientName);
  pdf.setLineWidth(0.3);
  pdf.line(margin + nameLabelWidth + nameTextWidth + 2, yPosition + 1, pageWidth - margin, yPosition + 1);
  yPosition += 8;

  // Date of Treatment - with proper colon and spacing
  setEnglishFont('bold');
  pdf.text('Date of Treatment:', margin, yPosition);
  const dateLabelWidth = pdf.getTextWidth('Date of Treatment:');
  setEnglishFont('normal');
  const treatmentDate = formatDate(data.signedDate.toISOString());
  pdf.text(' ' + treatmentDate, margin + dateLabelWidth, yPosition);
  yPosition += 8;

  // Dosage - with underline
  setEnglishFont('bold');
  pdf.text('Dosage:', margin, yPosition);
  const dosageLabelWidth = pdf.getTextWidth('Dosage:');
  setEnglishFont('normal');
  if (data.dosage) {
    pdf.text(' ' + data.dosage, margin + dosageLabelWidth, yPosition);
  }
  pdf.setLineWidth(0.3);
  pdf.line(margin + dosageLabelWidth + 2, yPosition + 1, margin + 100, yPosition + 1);
  yPosition += 6;

  drawDivider();

  // ==========================================
  // CONSENT CONTENT - Parse sections
  // ==========================================
  const sections = parseConsentSections(data.consentText, data.consentTextAr);
  
  for (const section of sections) {
    checkNewPage(50);
    
    // English heading
    pdf.setFontSize(11);
    setEnglishFont('bold');
    pdf.text(section.englishTitle, margin, yPosition);
    yPosition += 6;
    
    // English content
    pdf.setFontSize(10);
    setEnglishFont('normal');
    const englishLines = pdf.splitTextToSize(section.englishContent, contentWidth);
    for (const line of englishLines) {
      checkNewPage();
      pdf.text(line, margin, yPosition);
      yPosition += 5;
    }
    yPosition += 2;
    
    // Arabic heading (right-aligned)
    if (section.arabicTitle) {
      checkNewPage();
      setArabicFont();
      pdf.setFontSize(11);
      pdf.text(section.arabicTitle, pageWidth - margin, yPosition, { align: 'right' });
      yPosition += 6;
    }
    
    // Arabic content (right-aligned)
    if (section.arabicContent) {
      pdf.setFontSize(10);
      setArabicFont();
      const arabicLines = pdf.splitTextToSize(section.arabicContent, contentWidth);
      for (const line of arabicLines) {
        checkNewPage();
        pdf.text(line, pageWidth - margin, yPosition, { align: 'right' });
        yPosition += 5;
      }
    }
    
    drawDivider();
  }

  // ==========================================
  // PATIENT SIGNATURE SECTION
  // ==========================================
  checkNewPage(70);
  
  pdf.setFontSize(11);
  setEnglishFont('bold');
  pdf.text("Patient's Acknowledgement and Signature", margin, yPosition);
  yPosition += 6;
  
  pdf.setFontSize(10);
  setEnglishFont('normal');
  const ackText = `I acknowledge I have been informed about the ${data.treatmentName} treatment. I consent to proceed.`;
  const ackLines = pdf.splitTextToSize(ackText, contentWidth);
  for (const line of ackLines) {
    pdf.text(line, margin, yPosition);
    yPosition += 5;
  }
  yPosition += 2;
  
  // Arabic acknowledgment
  setArabicFont();
  pdf.text('إقرار المريض وتوقيعه', pageWidth - margin, yPosition, { align: 'right' });
  yPosition += 6;
  const arabicAck = 'أقر أنه تم إبلاغي بالعلاج. أوافق على المتابعة.';
  pdf.text(arabicAck, pageWidth - margin, yPosition, { align: 'right' });
  yPosition += 12;

  // Add patient signature image
  try {
    const signatureImage = await loadImage(data.signatureDataUrl);
    const sigWidth = 50;
    const sigHeight = 20;
    pdf.addImage(signatureImage, 'PNG', margin, yPosition, sigWidth, sigHeight);
    yPosition += sigHeight + 2;
  } catch (error) {
    console.error('Error adding signature to PDF:', error);
    yPosition += 5;
  }

  // Patient Signature line
  setEnglishFont('bold');
  pdf.setFontSize(10);
  pdf.text("Patient's Signature:", margin, yPosition);
  pdf.setLineWidth(0.3);
  pdf.line(margin + 38, yPosition + 1, margin + 95, yPosition + 1);
  pdf.text('Date:', margin + 100, yPosition);
  setEnglishFont('normal');
  pdf.text(' ' + formatDate(data.signedDate.toISOString()), margin + 112, yPosition);
  yPosition += 8;

  // Doctor Signature line
  setEnglishFont('bold');
  pdf.text("Doctor's Signature:", margin, yPosition);
  pdf.setLineWidth(0.3);
  pdf.line(margin + 38, yPosition + 1, margin + 95, yPosition + 1);
  pdf.text('Date:', margin + 100, yPosition);
  pdf.line(margin + 112, yPosition + 1, margin + 150, yPosition + 1);
  yPosition += 6;

  drawDivider();

  // ==========================================
  // VIDEO & PHOTOGRAPHIC CONSENT
  // ==========================================
  checkNewPage(60);
  
  pdf.setFontSize(11);
  setEnglishFont('bold');
  pdf.text('Video & Photographic Consent', margin, yPosition);
  yPosition += 6;
  
  pdf.setFontSize(10);
  setEnglishFont('normal');
  const photoConsentEn = `I consent to the taking of photographs/videos during my ${data.treatmentName} treatment for educational, promotional, or medical purposes. My identity will be kept confidential unless I give explicit consent to share.`;
  const photoLines = pdf.splitTextToSize(photoConsentEn, contentWidth);
  for (const line of photoLines) {
    pdf.text(line, margin, yPosition);
    yPosition += 5;
  }
  yPosition += 2;
  
  // Arabic photo consent
  setArabicFont();
  pdf.text('الموافقة على التصوير والفيديو', pageWidth - margin, yPosition, { align: 'right' });
  yPosition += 6;
  const photoConsentAr = 'أوافق على التقاط الصور/الفيديو أثناء علاجي لأغراض تعليمية أو ترويجية أو طبية. ستظل هويتي سرية إلا إذا منحت موافقة صريحة للمشاركة.';
  const photoLinesAr = pdf.splitTextToSize(photoConsentAr, contentWidth);
  for (const line of photoLinesAr) {
    pdf.text(line, pageWidth - margin, yPosition, { align: 'right' });
    yPosition += 5;
  }
  yPosition += 8;

  // Add photo/video signature if provided
  if (data.photoVideoSignatureDataUrl) {
    try {
      const photoSigImage = await loadImage(data.photoVideoSignatureDataUrl);
      const sigWidth = 50;
      const sigHeight = 20;
      pdf.addImage(photoSigImage, 'PNG', margin, yPosition, sigWidth, sigHeight);
      yPosition += sigHeight + 2;
    } catch (error) {
      console.error('Error adding photo consent signature to PDF:', error);
    }
  }

  // Photo consent signature line
  setEnglishFont('bold');
  pdf.text('Signature:', margin, yPosition);
  pdf.setLineWidth(0.3);
  pdf.line(margin + 22, yPosition + 1, margin + 80, yPosition + 1);
  pdf.text('Date:', margin + 85, yPosition);
  setEnglishFont('normal');
  if (data.photoVideoSignatureDataUrl) {
    pdf.text(' ' + formatDate(data.signedDate.toISOString()), margin + 97, yPosition);
  } else {
    pdf.line(margin + 97, yPosition + 1, margin + 135, yPosition + 1);
  }

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

function getTreatmentTitle(treatmentName: string): string {
  const titles: Record<string, string> = {
    'Mounjaro': 'Mounjaro Injectable Treatment',
    'Fillers': 'Dermal Filler Treatment',
    'IV Therapy': 'IV Therapy Treatment',
    'HIFU': 'HIFU Treatment',
    'GFC': 'GFC Treatment',
    'Skin Booster': 'Skin Booster Treatment',
    'Subcision': 'Subcision Treatment',
  };
  return titles[treatmentName] || `${treatmentName} Treatment`;
}

interface ConsentSection {
  englishTitle: string;
  englishContent: string;
  arabicTitle?: string;
  arabicContent?: string;
}

function parseConsentSections(englishText: string, arabicText?: string): ConsentSection[] {
  // Parse English sections
  const englishSections = parseTextToSections(englishText);
  const arabicSections = arabicText ? parseTextToSections(arabicText) : [];
  
  // Merge English and Arabic sections
  const sections: ConsentSection[] = [];
  
  for (let i = 0; i < englishSections.length; i++) {
    const arabicSection = arabicSections[i];
    sections.push({
      englishTitle: englishSections[i].title,
      englishContent: englishSections[i].content,
      arabicTitle: arabicSection?.title,
      arabicContent: arabicSection?.content,
    });
  }
  
  return sections;
}

function parseTextToSections(text: string): { title: string; content: string }[] {
  const sections: { title: string; content: string }[] = [];
  
  // Split by numbered sections - supports both English (1. 2. 3.) and Arabic numerals
  // Match pattern: number followed by period, then title text, then content until next number or end
  const regex = /(?:^|\n)([\d٠-٩]+\.\s*[^\n]+)\n([\s\S]*?)(?=(?:^|\n)[\d٠-٩]+\.\s|$)/gm;
  let match;
  
  while ((match = regex.exec(text)) !== null) {
    const titleLine = match[1].trim();
    const content = match[2].trim();
    
    // Extract title (remove the number prefix - both Arabic and English numerals)
    const title = titleLine.replace(/^[\d٠-٩]+\.\s*/, '');
    
    if (title && content) {
      sections.push({ title, content });
    }
  }
  
  // If no numbered sections found, treat as single section
  if (sections.length === 0 && text.trim()) {
    // Try to split by double newlines as paragraphs
    const paragraphs = text.split(/\n\n+/).filter(p => p.trim());
    if (paragraphs.length > 1) {
      // First paragraph might be a title
      sections.push({
        title: 'معلومات الموافقة',
        content: text.trim()
      });
    } else {
      sections.push({
        title: 'Consent Information',
        content: text.trim()
      });
    }
  }
  
  return sections;
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
