/**
 * Utility to trigger a browser download of a PDF blob
 */
export function downloadPDF(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Get the first name from a full name, stripping common titles
 */
export function getFirstName(fullName: string): string {
  const titles = /^(mr\.?|mrs\.?|ms\.?|dr\.?|prof\.?)\s+/i;
  const stripped = fullName.trim().replace(titles, '');
  return stripped.split(' ')[0] || fullName.trim();
}

/**
 * Format visit number as ordinal (1st, 2nd, 3rd, etc.)
 */
export function formatVisitOrdinal(visitNumber: number): string {
  const suffixes = ['th', 'st', 'nd', 'rd'];
  const v = visitNumber % 100;
  return visitNumber + (suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]);
}

/**
 * Generate consent form file name: FirstName Treatment VisitNo consent form.pdf
 */
export function getConsentFileName(
  firstName: string,
  treatmentName: string,
  visitNumber: number
): string {
  const ordinal = formatVisitOrdinal(visitNumber);
  return `${firstName} ${treatmentName} ${ordinal} visit consent form.pdf`;
}
