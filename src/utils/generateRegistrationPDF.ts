import jsPDF from 'jspdf';

interface MedicalItem {
  label: string;
  value: boolean;
  details?: string | null;
}

interface RegistrationPDFData {
  patientName: string;
  patientDOB: string;
  patientPhone: string;
  patientEmail: string;
  emiratesId?: string | null;
  address?: string | null;
  nationality?: string | null;
  gender?: string | null;
  countryOfResidence?: string | null;
  emirate?: string | null;
  emergencyContactName?: string | null;
  emergencyContactNumber?: string | null;
  emergencyContactRelationship?: string | null;
  medicalHistory?: MedicalItem[];
  signatureDataUrl: string;
  doctorSignatureDataUrl?: string;
  registrationDate: Date;
}

export async function generateRegistrationPDF(data: RegistrationPDFData): Promise<Blob> {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 20;
  let yPosition = margin;

  const checkPageBreak = (needed: number) => {
    if (yPosition + needed > pageHeight - 20) {
      pdf.addPage();
      yPosition = margin;
    }
  };

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

  pdf.setLineWidth(0.5);
  pdf.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 10;

  // Patient Information
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.text('PATIENT INFORMATION', margin, yPosition);
  yPosition += 10;

  const fields = [
    { label: 'Full Name', value: data.patientName },
    { label: 'Date of Birth', value: formatDate(data.patientDOB) },
    { label: 'Mobile Number', value: data.patientPhone },
    ...(data.patientEmail ? [{ label: 'Email', value: data.patientEmail }] : []),
    ...(data.nationality ? [{ label: 'Nationality', value: data.nationality }] : []),
    ...(data.gender ? [{ label: 'Gender', value: data.gender }] : []),
    ...(data.countryOfResidence ? [{ label: 'Country of Residence', value: data.countryOfResidence }] : []),
    ...(data.emirate ? [{ label: 'Emirate', value: data.emirate }] : []),
    ...(data.emiratesId ? [{ label: 'Emirates ID', value: data.emiratesId }] : []),
    ...(data.address ? [{ label: 'Address', value: data.address }] : []),
  ];

  pdf.setFontSize(10);
  for (const field of fields) {
    checkPageBreak(8);
    pdf.setFont('helvetica', 'bold');
    pdf.text(`${field.label}:`, margin, yPosition);
    pdf.setFont('helvetica', 'normal');
    pdf.text(field.value, margin + 45, yPosition);
    yPosition += 8;
  }

  yPosition += 5;

  // Emergency Contact
  if (data.emergencyContactName || data.emergencyContactNumber) {
    checkPageBreak(40);
    pdf.setLineWidth(0.3);
    pdf.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 10;

    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text('EMERGENCY CONTACT DETAILS', margin, yPosition);
    yPosition += 10;

    const ecFields = [
      ...(data.emergencyContactName ? [{ label: 'Name', value: data.emergencyContactName }] : []),
      ...(data.emergencyContactNumber ? [{ label: 'Number', value: data.emergencyContactNumber }] : []),
      ...(data.emergencyContactRelationship ? [{ label: 'Relationship', value: data.emergencyContactRelationship }] : []),
    ];

    pdf.setFontSize(10);
    for (const field of ecFields) {
      pdf.setFont('helvetica', 'bold');
      pdf.text(`${field.label}:`, margin, yPosition);
      pdf.setFont('helvetica', 'normal');
      pdf.text(field.value, margin + 45, yPosition);
      yPosition += 8;
    }
    yPosition += 5;
  }

  // Medical History
  if (data.medicalHistory && data.medicalHistory.length > 0) {
    checkPageBreak(40);
    pdf.setLineWidth(0.3);
    pdf.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 10;

    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text('MEDICAL HISTORY DECLARATION', margin, yPosition);
    yPosition += 10;

    pdf.setFontSize(10);
    for (const item of data.medicalHistory) {
      checkPageBreak(16);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`${item.label}:`, margin, yPosition);
      pdf.setFont('helvetica', 'normal');
      pdf.text(item.value ? 'Yes' : 'No', margin + 45, yPosition);
      yPosition += 7;
      if (item.value && item.details) {
        const detailLines = pdf.splitTextToSize(`Details: ${item.details}`, pageWidth - margin * 2 - 10);
        for (const line of detailLines) {
          checkPageBreak(6);
          pdf.text(line, margin + 10, yPosition);
          yPosition += 5;
        }
        yPosition += 2;
      }
    }
    yPosition += 5;
  }

  // Declaration
  checkPageBreak(40);
  pdf.setLineWidth(0.3);
  pdf.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 10;

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
  const declarationLines = pdf.splitTextToSize(declarationText, pageWidth - margin * 2);
  for (const line of declarationLines) {
    checkPageBreak(6);
    pdf.text(line, margin, yPosition);
    yPosition += 5;
  }
  yPosition += 10;

  // Patient Signature
  checkPageBreak(50);
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.text('PATIENT SIGNATURE', margin, yPosition);
  yPosition += 10;

  try {
    if (data.signatureDataUrl) {
      const sigImg = await loadImage(data.signatureDataUrl);
      pdf.addImage(sigImg, 'PNG', margin, yPosition, 60, 25);
      yPosition += 30;
    }
  } catch {
    pdf.setFont('helvetica', 'normal');
    pdf.text('[Signature on file]', margin, yPosition);
    yPosition += 10;
  }

  pdf.line(margin, yPosition, margin + 80, yPosition);
  yPosition += 5;
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  pdf.text('Patient Signature', margin, yPosition);
  pdf.text(`Date: ${formatDateTime(data.registrationDate)}`, margin + 100, yPosition);
  yPosition += 15;

  // Doctor Signature
  if (data.doctorSignatureDataUrl) {
    checkPageBreak(50);
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text('DOCTOR SIGNATURE', margin, yPosition);
    yPosition += 10;

    try {
      const docSigImg = await loadImage(data.doctorSignatureDataUrl);
      pdf.addImage(docSigImg, 'PNG', margin, yPosition, 60, 25);
      yPosition += 30;
    } catch {
      pdf.setFont('helvetica', 'normal');
      pdf.text('[Signature on file]', margin, yPosition);
      yPosition += 10;
    }

    pdf.line(margin, yPosition, margin + 80, yPosition);
    yPosition += 5;
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    pdf.text('Doctor Signature', margin, yPosition);
  }

  // Footer
  pdf.setFontSize(8);
  pdf.setTextColor(128, 128, 128);
  pdf.text(
    `Document generated on ${formatDateTime(new Date())}`,
    pageWidth / 2,
    pageHeight - 10,
    { align: 'center' }
  );

  return pdf.output('blob');
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-AE', { year: 'numeric', month: 'long', day: 'numeric' });
}

function formatDateTime(date: Date): string {
  return date.toLocaleString('en-AE', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
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
