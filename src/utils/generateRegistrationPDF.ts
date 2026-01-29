import jsPDF from 'jspdf';

interface RegistrationPDFData {
  patientName: string;
  patientDOB: string;
  patientPhone: string;
  patientEmail: string;
  emiratesId?: string | null;
  address?: string | null;
  signatureDataUrl: string;
  registrationDate: Date;
}

export async function generateRegistrationPDF(data: RegistrationPDFData): Promise<Blob> {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 20;
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
  pdf.text('PATIENT REGISTRATION FORM', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 10;

  // Divider line
  pdf.setLineWidth(0.5);
  pdf.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 10;

  // Patient Information Section
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.text('PATIENT INFORMATION', margin, yPosition);
  yPosition += 10;

  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  
  const fields = [
    { label: 'Full Name', value: data.patientName },
    { label: 'Date of Birth', value: formatDate(data.patientDOB) },
    { label: 'Phone Number', value: data.patientPhone },
    { label: 'Email', value: data.patientEmail },
  ];

  if (data.emiratesId) {
    fields.push({ label: 'Emirates ID', value: data.emiratesId });
  }
  if (data.address) {
    fields.push({ label: 'Address', value: data.address });
  }

  for (const field of fields) {
    pdf.setFont('helvetica', 'bold');
    pdf.text(`${field.label}:`, margin, yPosition);
    pdf.setFont('helvetica', 'normal');
    pdf.text(field.value, margin + 40, yPosition);
    yPosition += 8;
  }

  yPosition += 10;

  // Divider line
  pdf.setLineWidth(0.3);
  pdf.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 10;

  // Declaration Section
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.text('DECLARATION', margin, yPosition);
  yPosition += 10;

  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  const declarationText = 
    'I hereby confirm that the information provided above is true and accurate to the best of my knowledge. ' +
    'I understand that this information will be used for my medical records and treatment purposes. ' +
    'I consent to the clinic storing and processing my personal data in accordance with applicable privacy laws.';
  
  const declarationLines = pdf.splitTextToSize(declarationText, pageWidth - (margin * 2));
  for (const line of declarationLines) {
    pdf.text(line, margin, yPosition);
    yPosition += 5;
  }

  yPosition += 15;

  // Signature Section
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.text('PATIENT SIGNATURE', margin, yPosition);
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
    pdf.setFont('helvetica', 'normal');
    pdf.text('[Signature on file]', margin, yPosition);
    yPosition += 10;
  }

  // Signature line
  pdf.line(margin, yPosition, margin + 80, yPosition);
  yPosition += 5;
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  pdf.text('Patient Signature', margin, yPosition);
  
  // Date
  pdf.text(`Date: ${formatDateTime(data.registrationDate)}`, margin + 100, yPosition);

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

export function getRegistrationFileName(firstName: string, phone: string): string {
  const cleanPhone = phone.replace(/\D/g, '');
  return `${firstName} ${cleanPhone} Reg form.pdf`;
}
