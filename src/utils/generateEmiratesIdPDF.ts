import jsPDF from 'jspdf';

interface EmiratesIdPDFData {
  patientName: string;
  patientPhone: string;
  emiratesId?: string | null;
  frontImage: string;
  backImage?: string;
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

export async function generateEmiratesIdPDF(data: EmiratesIdPDFData): Promise<Blob> {
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

  // Title
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.text('EMIRATES ID COPY', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 10;

  // Divider
  pdf.setLineWidth(0.5);
  pdf.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 10;

  // Patient details
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Patient Name:', margin, yPosition);
  pdf.setFont('helvetica', 'normal');
  pdf.text(data.patientName, margin + 35, yPosition);
  yPosition += 7;

  pdf.setFont('helvetica', 'bold');
  pdf.text('Phone:', margin, yPosition);
  pdf.setFont('helvetica', 'normal');
  pdf.text(data.patientPhone, margin + 35, yPosition);
  yPosition += 7;

  if (data.emiratesId) {
    pdf.setFont('helvetica', 'bold');
    pdf.text('Emirates ID:', margin, yPosition);
    pdf.setFont('helvetica', 'normal');
    pdf.text(data.emiratesId, margin + 35, yPosition);
    yPosition += 7;
  }

  yPosition += 8;

  // Front side image
  const imgWidth = pageWidth - margin * 2;
  const imgHeight = imgWidth / 1.586; // Emirates ID aspect ratio

  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Front Side', margin, yPosition);
  yPosition += 5;

  try {
    const frontImg = await loadImage(data.frontImage);
    pdf.addImage(frontImg, 'JPEG', margin, yPosition, imgWidth, imgHeight);
    yPosition += imgHeight + 10;
  } catch {
    pdf.setFont('helvetica', 'normal');
    pdf.text('[Front image unavailable]', margin, yPosition + 10);
    yPosition += 20;
  }

  // Back side image
  if (data.backImage) {
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Back Side', margin, yPosition);
    yPosition += 5;

    try {
      const backImg = await loadImage(data.backImage);
      pdf.addImage(backImg, 'JPEG', margin, yPosition, imgWidth, imgHeight);
      yPosition += imgHeight + 10;
    } catch {
      pdf.setFont('helvetica', 'normal');
      pdf.text('[Back image unavailable]', margin, yPosition + 10);
      yPosition += 20;
    }
  }

  // Footer
  pdf.setFontSize(8);
  pdf.setTextColor(128, 128, 128);
  pdf.text(
    `Document generated on ${new Date().toLocaleString('en-AE', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`,
    pageWidth / 2,
    pdf.internal.pageSize.getHeight() - 10,
    { align: 'center' }
  );

  return pdf.output('blob');
}

export function getEmiratesIdFileName(firstName: string, phone: string): string {
  const cleanPhone = phone.replace(/\D/g, '');
  return `${firstName} ${cleanPhone} Emirates ID.pdf`;
}
