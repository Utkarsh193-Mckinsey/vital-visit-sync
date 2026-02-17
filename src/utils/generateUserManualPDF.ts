import jsPDF from 'jspdf';

// Screenshot data URLs will be loaded from the app
const SCREENSHOT_PAGES = [
  { route: '/', label: 'Dashboard' },
  { route: '/appointments', label: 'Appointments' },
  { route: '/patients', label: 'All Patients / Check-In' },
  { route: '/new-patients', label: 'New Patient Registrations' },
  { route: '/waiting', label: 'Waiting Area' },
  { route: '/in-treatment', label: 'In Treatment' },
  { route: '/completed', label: 'Completed Today' },
  { route: '/book-next', label: 'Book Next Appointment' },
  { route: '/assistant', label: 'Personal Assistant' },
  { route: '/whatsapp', label: 'WhatsApp Chats' },
  { route: '/no-show', label: 'No Show' },
  { route: '/analytics', label: 'Analytics' },
  { route: '/treatments', label: 'Treatments' },
  { route: '/settings', label: 'Admin Settings' },
];

async function capturePageScreenshot(route: string): Promise<string | null> {
  return new Promise((resolve) => {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.left = '-9999px';
    iframe.style.width = '1280px';
    iframe.style.height = '720px';
    iframe.src = route;
    // We can't actually capture iframe screenshots due to CORS, so skip
    resolve(null);
  });
}

export async function generateUserManualPDF() {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = 210;
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;
  let y = 20;

  const addPage = () => { doc.addPage(); y = 20; };
  const checkPage = (needed: number) => { if (y + needed > 278) addPage(); };

  const sectionTitle = (text: string, size = 16) => {
    checkPage(14);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(size);
    doc.setTextColor(30, 30, 30);
    doc.text(text, margin, y);
    y += size * 0.55;
    doc.setDrawColor(195, 165, 115);
    doc.setLineWidth(0.6);
    doc.line(margin, y, margin + contentWidth, y);
    y += 5;
  };

  const subtitle = (text: string) => {
    checkPage(10);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(50, 50, 50);
    doc.text(text, margin, y);
    y += 6;
  };

  const subsubtitle = (text: string) => {
    checkPage(8);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(70, 70, 70);
    doc.text(text, margin + 2, y);
    y += 5;
  };

  const body = (text: string, indent = 0) => {
    checkPage(6);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(40, 40, 40);
    const lines = doc.splitTextToSize(text, contentWidth - indent);
    lines.forEach((line: string) => {
      checkPage(4.5);
      doc.text(line, margin + indent, y);
      y += 4.2;
    });
    y += 1;
  };

  const bullet = (text: string, indent = 4) => {
    checkPage(5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(40, 40, 40);
    doc.text('•', margin + indent, y);
    const lines = doc.splitTextToSize(text, contentWidth - indent - 5);
    lines.forEach((line: string) => {
      checkPage(4.5);
      doc.text(line, margin + indent + 5, y);
      y += 4.2;
    });
  };

  const numberedItem = (num: string, text: string, indent = 4) => {
    checkPage(5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(40, 40, 40);
    doc.text(num, margin + indent, y);
    const lines = doc.splitTextToSize(text, contentWidth - indent - 7);
    lines.forEach((line: string) => {
      checkPage(4.5);
      doc.text(line, margin + indent + 7, y);
      y += 4.2;
    });
  };

  const spacer = (h = 3) => { y += h; };

  const tipBox = (text: string) => {
    checkPage(12);
    doc.setFillColor(240, 248, 255);
    doc.setDrawColor(100, 150, 200);
    doc.setLineWidth(0.3);
    const lines = doc.splitTextToSize('💡 ' + text, contentWidth - 8);
    const boxH = lines.length * 4.5 + 4;
    doc.roundedRect(margin, y - 2, contentWidth, boxH, 2, 2, 'FD');
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(50, 80, 120);
    lines.forEach((line: string) => {
      doc.text(line, margin + 4, y + 2);
      y += 4.5;
    });
    y += 4;
  };

  const screenshotPlaceholder = (label: string, route: string) => {
    checkPage(45);
    doc.setFillColor(245, 245, 248);
    doc.setDrawColor(200, 200, 210);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, y, contentWidth, 38, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 90);
    doc.text(`📸 Screenshot: ${label}`, margin + 4, y + 10);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 130);
    doc.text(`Navigate to: ${route}`, margin + 4, y + 18);
    doc.text('See the live application for this view.', margin + 4, y + 25);
    y += 42;
  };

  const tableRow = (cols: string[], widths: number[], bold = false, fillColor?: [number, number, number]) => {
    checkPage(6);
    if (fillColor) {
      doc.setFillColor(...fillColor);
      doc.rect(margin, y - 3.5, contentWidth, 5.5, 'F');
    }
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(bold ? 30 : 50, bold ? 30 : 50, bold ? 30 : 50);
    let x = margin + 2;
    cols.forEach((col, i) => {
      doc.text(col, x, y);
      x += widths[i];
    });
    y += 5;
  };

  // ═══════════════════════════════════════
  // COVER PAGE
  // ═══════════════════════════════════════
  doc.setFillColor(22, 22, 28);
  doc.rect(0, 0, 210, 297, 'F');

  // Gold accent line
  doc.setDrawColor(195, 165, 115);
  doc.setLineWidth(1);
  doc.line(60, 80, 150, 80);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(36);
  doc.setTextColor(195, 165, 115);
  doc.text('COSMIQUE', pageWidth / 2, 100, { align: 'center' });

  doc.setFontSize(13);
  doc.setTextColor(170, 170, 175);
  doc.text('Aesthetics & Dermatology Clinic', pageWidth / 2, 112, { align: 'center' });

  doc.setDrawColor(195, 165, 115);
  doc.setLineWidth(0.5);
  doc.line(70, 125, 140, 125);

  doc.setFontSize(24);
  doc.setTextColor(255, 255, 255);
  doc.text('Clinic Management System', pageWidth / 2, 142, { align: 'center' });

  doc.setFontSize(20);
  doc.text('User Manual', pageWidth / 2, 155, { align: 'center' });

  doc.setFontSize(10);
  doc.setTextColor(140, 140, 145);
  doc.text('Version 1.0 — February 2026', pageWidth / 2, 175, { align: 'center' });

  doc.setDrawColor(195, 165, 115);
  doc.line(60, 200, 150, 200);

  doc.setFontSize(10);
  doc.setTextColor(120, 120, 125);
  doc.text('Prepared for', pageWidth / 2, 215, { align: 'center' });

  doc.setFontSize(11);
  doc.setTextColor(170, 170, 175);
  doc.text('Doctors  •  Admin Staff  •  SDR / Reception', pageWidth / 2, 225, { align: 'center' });

  doc.setFontSize(8);
  doc.setTextColor(100, 100, 105);
  doc.text('CONFIDENTIAL — For internal use only', pageWidth / 2, 275, { align: 'center' });

  // ═══════════════════════════════════════
  // TABLE OF CONTENTS
  // ═══════════════════════════════════════
  addPage();
  sectionTitle('Table of Contents', 18);
  spacer(4);

  const tocItems = [
    { num: '1', title: 'Getting Started', sub: ['Logging In', 'Navigation Overview', 'Screen Reference Gallery'] },
    { num: '2', title: 'Admin Guide (Full Access)', sub: ['Staff Management', 'Treatment Configuration', 'Consent Forms', 'Stock Management', 'Analytics & Reports', 'WhatsApp Communication'] },
    { num: '3', title: 'SDR / Reception Guide', sub: ['Booking via WhatsApp', 'Patient Check-In', 'New Patient Registration', 'Existing Patient Migration', 'Consent Signing', 'Vitals Entry', 'Book Next Appointment'] },
    { num: '4', title: 'Doctor Guide', sub: ['Reviewing Registrations', 'Consultations', 'Treatment Administration'] },
    { num: '5', title: 'Common Workflows & Reference', sub: ['Complete Patient Journey', 'Document Downloads', 'Role Access Matrix'] },
  ];

  tocItems.forEach(item => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(30, 30, 30);
    doc.text(`${item.num}.  ${item.title}`, margin + 4, y);
    y += 5.5;
    item.sub.forEach(s => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text(`    •  ${s}`, margin + 10, y);
      y += 4.5;
    });
    y += 2;
  });

  // ═══════════════════════════════════════
  // 1. GETTING STARTED
  // ═══════════════════════════════════════
  addPage();
  sectionTitle('1. Getting Started');

  subtitle('1.1 Logging In');
  numberedItem('1.', 'Open the app on your iPad or tablet browser');
  numberedItem('2.', 'Enter your email address and password');
  numberedItem('3.', 'You will land on the Dashboard — your daily overview');
  spacer();
  tipBox('Each staff member has a dedicated login. Contact Admin (Sarika) if you need credentials reset.');

  spacer(4);
  subtitle('1.2 Navigation Overview');
  body('The left sidebar provides quick access to every section of the system. Blinking red badges indicate items needing immediate attention.');
  spacer(2);

  const navSections = [
    ['Dashboard', 'Overview of today\'s activity, schedule, and weekly stats'],
    ['All Patients', 'Search patients, register new ones, or add existing patient data'],
    ['Appointments', 'Today\'s bookings with status, confirmation, and quick actions'],
    ['Waiting Area', 'Patients who checked in and are waiting for vitals/treatment'],
    ['In Treatment', 'Active treatment sessions in progress'],
    ['Completed', 'Visits finished today with export capability'],
    ['Book Next Appt', 'Schedule follow-ups for patients with remaining sessions'],
    ['New Patients', 'Pending doctor reviews and consultations'],
    ['Personal Assistant', 'AI-parsed patient requests needing staff response'],
    ['WhatsApp Chats', 'Threaded patient conversations via WhatsApp'],
    ['No Show', 'Track and follow up on missed appointments'],
    ['Analytics', 'Performance charts, trends, and exportable reports'],
    ['Treatments', 'Treatment catalog with doses, consent links, consumables'],
    ['Settings', 'Staff roster, consumables inventory, consent template management'],
  ];

  navSections.forEach(([name, desc]) => {
    checkPage(8);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(40, 40, 40);
    doc.text(`${name}`, margin + 4, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(80, 80, 80);
    doc.text(` — ${desc}`, margin + 4 + doc.getTextWidth(name) + 2, y);
    y += 5;
  });

  // Screen reference gallery
  addPage();
  subtitle('1.3 Screen Reference Gallery');
  body('Below are reference screenshots showing each main section of the application. Visit these pages in the live system for the full interactive experience.');
  spacer(2);

  SCREENSHOT_PAGES.forEach(({ route, label }) => {
    screenshotPlaceholder(label, route);
  });

  // ═══════════════════════════════════════
  // 2. ADMIN GUIDE
  // ═══════════════════════════════════════
  addPage();
  sectionTitle('2. Admin Guide (Full Access)');
  body('Admins have unrestricted access to all system features. This includes everything Doctors and SDRs can do, plus configuration and reporting tools.');
  spacer();

  subtitle('2.1 Staff Management');
  body('Navigate to: Settings → Staff tab');
  screenshotPlaceholder('Admin Settings — Staff', '/settings');
  bullet('View all staff members organized by role category (Doctor, Nurse, SDR, Reception, Admin)');
  bullet('Add Staff: Tap "+ Add Staff" → Enter full name, email, role, and title');
  bullet('Deactivate: Toggle staff to inactive to prevent login');
  spacer();
  tipBox('Staff names appear in clinical dropdowns (Doctor, Nurse). Adding/removing here updates all treatment forms.');

  spacer(4);
  subtitle('2.2 Treatment Configuration');
  body('Navigate to: Treatments page (sidebar)');
  screenshotPlaceholder('Treatments List', '/treatments');
  bullet('View all 19+ active treatments organized by category');
  bullet('Add Treatment: Name, Category, Dosage Unit (mg/ml/Units/mcg/Session), default dose');
  bullet('Link a bilingual Consent Template to each treatment');
  bullet('Configure common dose presets (e.g., Mounjaro: 2.5mg, 5mg, 7.5mg, 10mg, 12.5mg, 15mg)');
  bullet('Attach consumable items with default quantities per treatment');
  spacer();

  subtitle('2.3 Consent Form Management');
  body('Navigate to: Settings → Consent Forms tab');
  bullet('View all consent templates with English and Arabic text');
  bullet('Add/Edit templates with dynamic placeholders:');
  body('  [PATIENT_NAME] — auto-replaced with patient name', 8);
  body('  [DATE] — auto-replaced with current date', 8);
  body('  [TREATMENT_NAME] — auto-replaced with treatment name', 8);
  bullet('Link templates to treatments so consent is automatically required at treatment time');
  spacer();

  subtitle('2.4 Stock / Consumables Management');
  body('Navigate to: Settings → Consumables tab');
  bullet('View all stock items with current quantities, categories, brands');
  bullet('Add items: category, item name, unit, brand, variant, packaging info');
  bullet('Stock auto-decrements when consumables are recorded during treatment');
  spacer();

  subtitle('2.5 Analytics & Reports');
  body('Navigate to: Analytics (sidebar)');
  screenshotPlaceholder('Analytics Dashboard', '/analytics');
  bullet('Follow-up Recovery Rate, No-Show trends (30 days), Confirmation Method breakdown');
  bullet('Busiest Time Slots chart, Appointments by Day of Week');
  bullet('Export Daily Report — multi-sheet Excel file containing:');
  body('  • New Patients — demographics of newly registered patients', 8);
  body('  • Treatment-wise — service usage breakdown', 8);
  body('  • Patient-wise — visit logs per patient', 8);
  body('  • Daily Sales — package payments and revenue', 8);
  body('  • Consultations — interest tracking and conversion rates', 8);
  body('  • SDR Performance — sales conversion by "Booked by" agent', 8);
  spacer();

  subtitle('2.6 WhatsApp Communication');
  body('Navigate to: WhatsApp Chats (sidebar)');
  screenshotPlaceholder('WhatsApp Chats', '/whatsapp');
  bullet('View threaded conversations with patients, sorted by most recent');
  bullet('Tap any thread to open full chat with message bubbles and timestamps');
  bullet('Send manual messages directly from the chat interface');
  bullet('Quick access: Tap the WhatsApp icon (💬) next to any phone number throughout the app');
  bullet('Appointment cards have a "W" shortcut that opens the relevant patient\'s chat thread');

  // ═══════════════════════════════════════
  // 3. SDR / RECEPTION GUIDE
  // ═══════════════════════════════════════
  addPage();
  sectionTitle('3. SDR / Reception Guide');

  subtitle('3.1 Booking Appointments via WhatsApp');
  body('Performed by: Admin or SDR');
  body('Send a structured message to the clinic WhatsApp number in this exact format:');
  spacer(2);

  // Format box
  checkPage(30);
  doc.setFillColor(248, 248, 248);
  doc.setDrawColor(200, 200, 200);
  doc.roundedRect(margin + 4, y - 1, contentWidth - 8, 32, 2, 2, 'FD');
  doc.setFont('courier', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(50, 50, 50);
  const formatLines = [
    'Name: [Patient Name]',
    'Phone: [Phone Number]',
    'Date: [DD/MM/YYYY]',
    'Time: [HH:MM AM/PM]',
    'Service: [Treatment Name]',
    'Booked by: [Your Name]',
  ];
  formatLines.forEach(line => {
    doc.text(line, margin + 10, y + 3);
    y += 4.5;
  });
  y += 6;

  doc.setFont('helvetica', 'normal');
  subtitle('Booking Rules:');
  bullet('Times must be between 10:00 AM and 10:00 PM');
  bullet('Dates must be today or a future date');
  bullet('"Booked by" must match a registered Admin or SDR staff name');
  bullet('Missing or invalid information triggers an automatic WhatsApp correction request');
  bullet('Only one active appointment per patient — conflicts prompt replacement confirmation');
  spacer();

  screenshotPlaceholder('Appointments Page', '/appointments');

  subtitle('3.2 Patient Check-In');
  body('Navigate to: All Patients (sidebar)');
  screenshotPlaceholder('All Patients / Check-In', '/patients');
  numberedItem('1.', 'Search by name, phone number, or Emirates ID');
  numberedItem('2.', 'Tap a patient card to open their dashboard');
  numberedItem('3.', 'From the dashboard, start a new visit');
  spacer();
  tipBox('If the search box is empty and you tap "Search", it opens the Scan ID feature for quick patient lookup.');

  spacer(4);
  subtitle('3.3 Registering a New Patient');
  body('Performed by: Admin (can also be done by any logged-in staff)');
  body('Navigate to: All Patients → "New Patient Registration"');
  spacer(2);

  subsubtitle('Step 1 — Language Selection');
  body('Choose English or Arabic. This affects the registration form language.');
  spacer();

  subsubtitle('Step 2 — Document Scan');
  numberedItem('1.', 'Choose document type: Emirates ID, Passport, or Other');
  numberedItem('2.', 'Capture front side photo → preview → confirm');
  numberedItem('3.', 'Capture back side photo → preview → confirm (or skip)');
  numberedItem('4.', 'System auto-extracts: name, date of birth, nationality, Emirates ID number');
  body('📄 ID PDF automatically downloads as: [Full Name] [Phone] ID.pdf', 6);
  spacer();
  tipBox('Alternatively, tap "+ Manual Entry" to skip scanning and fill details by hand.');

  subsubtitle('Step 3 — Registration Form');
  numberedItem('1.', 'Patient demographics (defaults: UAE, Dubai)');
  numberedItem('2.', 'Emergency contact details');
  numberedItem('3.', 'Medical history — toggle Yes/No for each condition; "Yes" opens text field for details');
  numberedItem('4.', 'Patient digital signature on the pad');
  numberedItem('5.', 'Submit → patient enters "Pending Doctor Review" queue');
  spacer();

  subtitle('3.4 Adding an Existing Patient (Data Migration)');
  body('Navigate to: All Patients → "Add Existing Patient"');
  numberedItem('1.', 'Enter Patient File Number from the legacy system');
  numberedItem('2.', 'Optionally scan a document to auto-fill details');
  numberedItem('3.', 'Fill in patient info, emergency contacts, medical history');
  numberedItem('4.', 'Packages section: add treatment lines with sessions purchased/used');
  numberedItem('5.', 'Payment details: Cash, Card, Tabby, Tamara, or Toothpick');
  numberedItem('6.', 'Submit → goes to Doctor Review queue');
  spacer();

  subtitle('3.5 Consent Signing');
  body('When a patient arrives for treatment and consent is required:');
  numberedItem('1.', 'System shows which treatments need consent signing');
  numberedItem('2.', 'For each treatment: read consent in English or Arabic (toggle available)');
  numberedItem('3.', 'Patient signs on the digital signature pad');
  numberedItem('4.', 'Tap "Sign & Submit"');
  body('📄 All signed consent PDFs automatically download upon completion', 6);
  body('📄 A separate Photo/Video consent form is also presented for media release', 6);
  spacer();

  subtitle('3.6 Vitals Entry');
  body('Navigate to: Waiting Area → select a patient');
  screenshotPlaceholder('Waiting Area', '/waiting');
  numberedItem('1.', 'Enter required vitals: weight, blood pressure, heart rate, temperature, SpO2, etc.');
  numberedItem('2.', 'Select the Nurse performing vitals from the dropdown');
  numberedItem('3.', 'Submit → patient moves to "Waiting for Treatment"');
  spacer();

  subtitle('3.7 Book Next Appointment');
  body('Performed by: Admin');
  body('Navigate to: Book Next Appt (sidebar)');
  screenshotPlaceholder('Book Next Appointment', '/book-next');
  body('After a visit is completed and sessions remain:');
  bullet('Book appointment — schedule the next session');
  bullet('Will Call Later — patient will call to schedule');
  bullet('Package Finished — close if no sessions remain');
  spacer();
  tipBox('The sidebar badge shows the count of patients needing follow-up booking.');

  // ═══════════════════════════════════════
  // 4. DOCTOR GUIDE
  // ═══════════════════════════════════════
  addPage();
  sectionTitle('4. Doctor Guide');

  subtitle('4.1 Reviewing New Patient Registrations');
  body('Navigate to: New Patients page');
  screenshotPlaceholder('New Patient Registrations', '/new-patients');
  numberedItem('1.', 'Under "Pending Doctor Review", tap a patient card');
  numberedItem('2.', 'Review: personal information, medical history, registration signature');
  numberedItem('3.', 'Select your name from the Doctor dropdown');
  numberedItem('4.', 'Provide your digital signature');
  numberedItem('5.', 'Tap "Approve"');
  body('📄 Registration PDF auto-downloads as: [FirstName] [Phone] Reg form.pdf', 6);
  numberedItem('6.', 'Patient moves to "Awaiting Consultation"');
  spacer();

  subtitle('4.2 Conducting Consultations');
  numberedItem('1.', 'On New Patients page, find patients under "Awaiting Consultation"');
  numberedItem('2.', 'Tap "Consult" on the patient card');
  numberedItem('3.', 'Select your name (Doctor) in the modal');
  numberedItem('4.', 'Multi-select Treatment Interests: Hair, Skin, Fat Loss, IV, etc.');
  numberedItem('5.', 'Submit → status changes to "Consulted"');
  body('Once a treatment package is purchased, status becomes "Converted".', 6);
  spacer();

  subtitle('4.3 Treatment Administration');
  body('Navigate to: In Treatment (sidebar) or take a patient from Waiting Area');
  screenshotPlaceholder('In Treatment', '/in-treatment');

  subsubtitle('Consent Check');
  bullet('If consent is NOT signed: you\'ll see "No consent — Sign now" badge (orange)');
  bullet('Click it → inline consent signing modal opens immediately');
  bullet('Have the patient sign, then proceed');
  spacer();

  subsubtitle('Selecting a Dose');
  bullet('Choose from preset doses (e.g., Mounjaro 2.5mg, 5mg, 7.5mg, 10mg, 12.5mg, 15mg)');
  bullet('Or select "Custom" to enter a custom dose with value, unit, and brand');
  bullet('Custom doses can be saved as new defaults for future use');
  bullet('Leave dose empty to skip a treatment for this visit');
  spacer();

  subsubtitle('Completing the Visit');
  numberedItem('1.', 'Select the Doctor and Nurse for each treatment line');
  numberedItem('2.', 'Add Doctor Notes (visible only to Doctors and Admins in visit history)');
  numberedItem('3.', 'Record consumables used (auto-populated from defaults, adjustable)');
  numberedItem('4.', 'Tap "Complete Visit"');
  spacer();

  subtitle('4.4 Important Notes for Doctors');
  checkPage(20);
  doc.setFillColor(255, 248, 235);
  doc.setDrawColor(200, 170, 100);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, y - 2, contentWidth, 28, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(140, 100, 30);
  const warnings = [
    '⚠️  Doctor Notes are restricted — only Doctors and Admins can view them',
    '⚠️  Always select your name from the Doctor dropdown — required for accountability',
    '⚠️  Consent must be signed before a dose can be administered',
    '⚠️  Do NOT skip the Doctor selection — it defaults to empty intentionally',
  ];
  warnings.forEach(w => {
    doc.text(w, margin + 4, y + 2);
    y += 5;
  });
  y += 6;

  // ═══════════════════════════════════════
  // 5. COMMON WORKFLOWS & REFERENCE
  // ═══════════════════════════════════════
  addPage();
  sectionTitle('5. Common Workflows & Reference');

  subtitle('5.1 Complete Patient Journey');
  spacer(2);

  const journey = [
    { step: '1', label: 'Appointment Booked', detail: 'Via WhatsApp structured message (Admin/SDR)' },
    { step: '2', label: 'Patient Arrives', detail: 'Check-in via All Patients search or Scan ID' },
    { step: '3', label: 'Registration', detail: 'Language → Document Scan → Form → Submit (Admin)' },
    { step: '4', label: 'Doctor Review', detail: 'Approval + Signature → Registration PDF downloads' },
    { step: '5', label: 'Consultation', detail: 'Doctor selects treatment interests' },
    { step: '6', label: 'Package Purchase', detail: 'Sessions created with payment details' },
    { step: '7', label: 'Consent Signing', detail: 'All consent PDFs download upon completion' },
    { step: '8', label: 'Vitals Entry', detail: 'Nurse records weight, BP, heart rate, temp, etc.' },
    { step: '9', label: 'Treatment', detail: 'Doctor selects dose, nurse, records consumables' },
    { step: '10', label: 'Visit Completed', detail: 'Summary generated, stock auto-decremented' },
    { step: '11', label: 'Book Next Appt', detail: 'If sessions remain (Admin)' },
  ];

  journey.forEach(({ step, label, detail }) => {
    checkPage(8);
    // Step circle
    doc.setFillColor(195, 165, 115);
    doc.circle(margin + 8, y - 1, 3, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text(step, margin + 8, y, { align: 'center' });

    // Label
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(30, 30, 30);
    doc.text(label, margin + 14, y);

    // Detail
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 100, 100);
    doc.text(detail, margin + 14, y + 4.5);

    // Connector line
    if (step !== '11') {
      doc.setDrawColor(195, 165, 115);
      doc.setLineWidth(0.3);
      doc.line(margin + 8, y + 2, margin + 8, y + 8);
    }
    y += 11;
  });

  spacer(4);
  subtitle('5.2 Automatic Document Downloads');
  spacer(2);

  const tblWidths = [52, 50, 70];
  tableRow(['Event', 'PDF Downloaded', 'File Name Format'], tblWidths, true, [235, 235, 240]);
  tableRow(['ID/Document Scanned', 'Emirates ID / Passport', '[Full Name] [Phone] ID.pdf'], tblWidths);
  doc.setDrawColor(220, 220, 220); doc.line(margin, y - 4, margin + contentWidth, y - 4);
  tableRow(['Doctor Approves Reg', 'Registration Form', '[FirstName] [Phone] Reg form.pdf'], tblWidths);
  doc.line(margin, y - 4, margin + contentWidth, y - 4);
  tableRow(['All Consents Signed', 'Treatment Consent PDFs', 'Per treatment name'], tblWidths);
  spacer(4);

  subtitle('5.3 Role Access Matrix');
  body('Who can do what in the system:');
  spacer(2);

  const roleWidths = [42, 24, 20, 22, 20];
  tableRow(['Feature', 'Admin', 'SDR', 'Doctor', 'Nurse'], roleWidths, true, [235, 235, 240]);

  const roleData = [
    ['Book Appointments', '✓', '✓', '—', '—'],
    ['Patient Registration', '✓', '✓', '✓', '✓'],
    ['Doctor Review & Sign', '✓', '—', '✓', '—'],
    ['Consultation', '✓', '—', '✓', '—'],
    ['Vitals Entry', '✓', '✓', '✓', '✓'],
    ['Consent Signing', '✓', '✓', '✓', '✓'],
    ['Treatment Admin', '✓', '—', '✓', '—'],
    ['View Doctor Notes', '✓', '—', '✓', '—'],
    ['Book Next Appt', '✓', '—', '—', '—'],
    ['Staff Management', '✓', '—', '—', '—'],
    ['Treatment Config', '✓', '—', '—', '—'],
    ['Stock Management', '✓', '—', '—', '—'],
    ['Analytics & Reports', '✓', '—', '—', '—'],
  ];

  roleData.forEach((row, i) => {
    if (i % 2 === 0) {
      tableRow(row, roleWidths, false, [248, 248, 250]);
    } else {
      tableRow(row, roleWidths);
    }
  });

  // ═══════════════════════════════════════
  // FOOTER on every page
  // ═══════════════════════════════════════
  const totalPages = doc.getNumberOfPages();
  for (let i = 2; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(195, 165, 115);
    doc.setLineWidth(0.3);
    doc.line(margin, 285, pageWidth - margin, 285);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(140, 140, 140);
    doc.text('COSMIQUE Aesthetics & Dermatology Clinic — User Manual v1.0 — CONFIDENTIAL', margin, 290);
    doc.text(`Page ${i - 1} of ${totalPages - 1}`, pageWidth - margin, 290, { align: 'right' });
  }

  doc.save('Cosmique_User_Manual.pdf');
}
