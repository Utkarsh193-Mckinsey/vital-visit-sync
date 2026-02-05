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
    const logoWidth = 30;
    const logoHeight = 30;
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
  // PATIENT INFORMATION
  // ==========================================
  pdf.setFontSize(11);
  setEnglishFont('bold');
  
  // Patient Name
  pdf.text('Patient Name:', margin, yPosition);
  setEnglishFont('normal');
  pdf.text(` ${data.patientName}`, margin + pdf.getTextWidth('Patient Name:'), yPosition);
  // Draw underline
  const nameLineStart = margin + pdf.getTextWidth('Patient Name: ') + pdf.getTextWidth(data.patientName);
  pdf.line(nameLineStart, yPosition, pageWidth - margin, yPosition);
  yPosition += 8;

  // Date of Treatment
  setEnglishFont('bold');
  pdf.text('Date of Treatment:', margin, yPosition);
  setEnglishFont('normal');
  const treatmentDate = formatDate(data.signedDate.toISOString());
  pdf.text(` ${treatmentDate}`, margin + pdf.getTextWidth('Date of Treatment:'), yPosition);
  yPosition += 8;

  // Dosage
  setEnglishFont('bold');
  pdf.text('Dosage:', margin, yPosition);
  setEnglishFont('normal');
  pdf.text(` ${data.dosage || '________________'}`, margin + pdf.getTextWidth('Dosage:'), yPosition);
  yPosition += 6;

  drawDivider();

  // ==========================================
  // CONSENT CONTENT - Parse sections
  // ==========================================
  const sections = parseConsentSections(data.consentText, data.consentTextAr);
  
  for (const section of sections) {
    checkNewPage(40);
    
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
    
    // Arabic heading
    if (section.arabicTitle) {
      yPosition += 2;
      setArabicFont();
      pdf.setFontSize(11);
      pdf.text(section.arabicTitle, pageWidth - margin, yPosition, { align: 'right' });
      yPosition += 6;
    }
    
    // Arabic content
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
  checkNewPage(60);
  
  pdf.setFontSize(11);
  setEnglishFont('bold');
  pdf.text("Patient's Acknowledgement and Signature", margin, yPosition);
  yPosition += 6;
  
  pdf.setFontSize(10);
  setEnglishFont('normal');
  pdf.text(`I acknowledge I have been informed about the ${data.treatmentName} treatment. I consent to proceed.`, margin, yPosition);
  yPosition += 6;
  
  setArabicFont();
  pdf.text('إقرار المريض وتوقيعه', pageWidth - margin, yPosition, { align: 'right' });
  yPosition += 6;
  pdf.text('.أقر أنه تم إبلاغي بعلاج ' + data.treatmentName + '. أوافق على المتابعة', pageWidth - margin, yPosition, { align: 'right' });
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
  pdf.line(margin + 40, yPosition, margin + 100, yPosition);
  pdf.text('Date:', margin + 110, yPosition);
  pdf.text(formatDate(data.signedDate.toISOString()), margin + 125, yPosition);
  yPosition += 8;

  // Doctor Signature line
  pdf.text("Doctor's Signature:", margin, yPosition);
  pdf.line(margin + 40, yPosition, margin + 100, yPosition);
  pdf.text('Date:', margin + 110, yPosition);
  pdf.line(margin + 125, yPosition, margin + 155, yPosition);
  yPosition += 6;

  drawDivider();

  // ==========================================
  // VIDEO & PHOTOGRAPHIC CONSENT
  // ==========================================
  checkNewPage(50);
  
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
  
  setArabicFont();
  pdf.text('الموافقة على التصوير والفيديو', pageWidth - margin, yPosition, { align: 'right' });
  yPosition += 6;
  const photoConsentAr = '.أوافق على التقاط الصور/الفيديو أثناء علاجي لأغراض تعليمية أو ترويجية أو طبية. ستظل هويتي سرية إلا إذا منحت موافقة صريحة للمشاركة';
  const photoLinesAr = pdf.splitTextToSize(photoConsentAr, contentWidth);
  for (const line of photoLinesAr) {
    pdf.text(line, pageWidth - margin, yPosition, { align: 'right' });
    yPosition += 5;
  }
  yPosition += 8;

  // Photo consent signature
  setEnglishFont('bold');
  pdf.text('Signature:', margin, yPosition);
  pdf.line(margin + 25, yPosition, margin + 85, yPosition);
  pdf.text('Date:', margin + 95, yPosition);
  pdf.line(margin + 110, yPosition, margin + 140, yPosition);

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
  
  // Split by numbered sections (1. Title, 2. Title, etc.)
  const regex = /(\d+\.\s*[^\n]+)\n([\s\S]*?)(?=\d+\.\s|$)/g;
  let match;
  
  while ((match = regex.exec(text)) !== null) {
    const titleLine = match[1].trim();
    const content = match[2].trim();
    
    // Extract title (remove the number prefix)
    const title = titleLine.replace(/^\d+\.\s*/, '');
    
    sections.push({ title, content });
  }
  
  // If no numbered sections found, treat as single section
  if (sections.length === 0 && text.trim()) {
    sections.push({
      title: 'Consent Information',
      content: text.trim()
    });
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
