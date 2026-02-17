import jsPDF from 'jspdf';

export function generateUserManualPDF() {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = 210;
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = 20;

  const addPage = () => { doc.addPage(); y = 20; };
  const checkPage = (needed: number) => { if (y + needed > 275) addPage(); };

  const title = (text: string, size = 18) => {
    checkPage(15);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(size);
    doc.setTextColor(30, 30, 30);
    doc.text(text, margin, y);
    y += size * 0.6;
    // underline
    doc.setDrawColor(200, 170, 120);
    doc.setLineWidth(0.5);
    doc.line(margin, y, margin + contentWidth, y);
    y += 6;
  };

  const subtitle = (text: string) => {
    checkPage(12);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(50, 50, 50);
    doc.text(text, margin, y);
    y += 7;
  };

  const subsubtitle = (text: string) => {
    checkPage(10);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(70, 70, 70);
    doc.text(text, margin + 2, y);
    y += 6;
  };

  const body = (text: string, indent = 0) => {
    checkPage(8);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(40, 40, 40);
    const lines = doc.splitTextToSize(text, contentWidth - indent);
    lines.forEach((line: string) => {
      checkPage(5);
      doc.text(line, margin + indent, y);
      y += 4.5;
    });
    y += 1;
  };

  const bullet = (text: string, indent = 5) => {
    checkPage(6);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(40, 40, 40);
    doc.text('•', margin + indent, y);
    const lines = doc.splitTextToSize(text, contentWidth - indent - 5);
    lines.forEach((line: string, i: number) => {
      checkPage(5);
      doc.text(line, margin + indent + 5, y);
      y += 4.5;
    });
  };

  const numberedItem = (num: string, text: string, indent = 5) => {
    checkPage(6);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(40, 40, 40);
    doc.text(num, margin + indent, y);
    const lines = doc.splitTextToSize(text, contentWidth - indent - 8);
    lines.forEach((line: string) => {
      checkPage(5);
      doc.text(line, margin + indent + 8, y);
      y += 4.5;
    });
  };

  const spacer = (h = 4) => { y += h; };

  const tableRow = (cols: string[], widths: number[], bold = false) => {
    checkPage(7);
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(9);
    doc.setTextColor(40, 40, 40);
    let x = margin;
    cols.forEach((col, i) => {
      doc.text(col, x + 1, y);
      x += widths[i];
    });
    y += 5;
  };

  // ─── COVER PAGE ───
  doc.setFillColor(25, 25, 30);
  doc.rect(0, 0, 210, 297, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(32);
  doc.setTextColor(200, 170, 120);
  doc.text('COSMIQUE', pageWidth / 2, 100, { align: 'center' });

  doc.setFontSize(14);
  doc.setTextColor(180, 180, 180);
  doc.text('Aesthetics & Dermatology Clinic', pageWidth / 2, 112, { align: 'center' });

  doc.setFontSize(22);
  doc.setTextColor(255, 255, 255);
  doc.text('User Manual', pageWidth / 2, 140, { align: 'center' });

  doc.setFontSize(11);
  doc.setTextColor(150, 150, 150);
  doc.text('Version 1.0 — February 2026', pageWidth / 2, 155, { align: 'center' });

  doc.setFontSize(10);
  doc.setTextColor(120, 120, 120);
  doc.text('For Doctors, SDR/Reception, and Administrators', pageWidth / 2, 200, { align: 'center' });

  // ─── TABLE OF CONTENTS ───
  addPage();
  title('Table of Contents', 16);
  spacer(3);
  const tocItems = [
    '1. Getting Started',
    '2. SDR (Sales Development Representative) Guide',
    '3. Doctor Guide',
    '4. Admin Guide',
    '5. Common Workflows',
  ];
  tocItems.forEach(item => { body(item, 5); spacer(1); });

  // ─── 1. GETTING STARTED ───
  addPage();
  title('1. Getting Started');

  subtitle('Logging In');
  numberedItem('1.', 'Open the app on your iPad/tablet');
  numberedItem('2.', 'Enter your email and password');
  numberedItem('3.', 'You\'ll land on the Dashboard');
  spacer();

  subtitle('Navigation');
  body('Use the left sidebar to access all sections:');
  const navItems = [
    'Dashboard — Overview of today\'s clinic activity',
    'Appointments — View and manage today\'s bookings',
    'New Patients — Pending registrations and consultations',
    'All Patients — Search and access any patient',
    'Waiting Area — Patients checked in and waiting',
    'In Treatment — Active treatment sessions',
    'Completed Today — Finished visits for the day',
    'Book Next Appt — Follow-up scheduling for patients with remaining sessions',
    'WhatsApp Chats — View patient communication threads',
    'Analytics — Reports and data export',
    'Treatments — Treatment catalog management',
    'Settings — Staff, consumables, and consent form management',
  ];
  navItems.forEach(item => bullet(item));
  spacer();
  body('Blinking badges on sidebar items indicate pending actions that need attention.', 5);

  // ─── 2. SDR GUIDE ───
  addPage();
  title('2. SDR (Sales Development Representative) Guide');

  subtitle('2.1 Booking Appointments via WhatsApp');
  body('Appointments are booked by sending a structured message to the clinic\'s WhatsApp number:');
  spacer(2);
  body('Name: [Patient Name]', 10);
  body('Phone: [Phone Number]', 10);
  body('Date: [DD/MM/YYYY]', 10);
  body('Time: [HH:MM AM/PM]', 10);
  body('Service: [Treatment Name]', 10);
  body('Booked by: [Your Name]', 10);
  spacer();
  body('Rules:');
  bullet('Times must be between 10:00 AM and 10:00 PM');
  bullet('Dates must be today or future');
  bullet('"Booked by" must match your registered staff name');
  bullet('If any information is missing, the system will message you back asking for corrections');
  bullet('Only one active appointment per patient is allowed');
  spacer();

  subtitle('2.2 Patient Check-In');
  numberedItem('1.', 'Go to All Patients (or tap the search bar on the home screen)');
  numberedItem('2.', 'Search by name, phone number, or Emirates ID');
  numberedItem('3.', 'Tap the patient card to open their dashboard');
  numberedItem('4.', 'From the patient dashboard, start a new visit');
  spacer();

  subtitle('2.3 Registering a New Patient');
  numberedItem('1.', 'Go to All Patients → tap "New Patient Registration"');
  numberedItem('2.', 'Step 1 — Language: Select English or Arabic');
  numberedItem('3.', 'Step 2 — Scan Document: Choose document type (Emirates ID, Passport, or Other)');
  body('   - Capture front side photo → preview → confirm', 10);
  body('   - Capture back side photo → preview → confirm (or skip)', 10);
  body('   - System auto-extracts patient details', 10);
  body('   - ID PDF automatically downloads: [Name] [Phone] ID.pdf', 10);
  numberedItem('4.', 'Step 3 — Registration Form: Fill demographics, emergency contact, medical history, sign');
  numberedItem('5.', 'Submit — patient enters "Pending Doctor Review" queue');
  spacer();

  subtitle('2.4 Adding an Existing Patient (Data Migration)');
  numberedItem('1.', 'Go to All Patients → tap "Add Existing Patient"');
  numberedItem('2.', 'Enter the Patient File Number from legacy system');
  numberedItem('3.', 'Optionally scan a document to auto-fill details');
  numberedItem('4.', 'Fill in patient info, emergency contacts, medical history');
  numberedItem('5.', 'Add packages with sessions purchased/used and payment details');
  numberedItem('6.', 'Submit — patient goes to Doctor Review queue');
  spacer();

  subtitle('2.5 Consent Signing');
  numberedItem('1.', 'System shows which treatments need consent');
  numberedItem('2.', 'For each treatment: read consent (English/Arabic toggle), patient signs');
  numberedItem('3.', 'All signed consent PDFs automatically download upon completion');
  numberedItem('4.', 'Separate Photo/Video consent form also presented');
  spacer();

  subtitle('2.6 Vitals Entry');
  numberedItem('1.', 'From Waiting Area, select a patient');
  numberedItem('2.', 'Enter required vitals (weight, BP, heart rate, temperature, etc.)');
  numberedItem('3.', 'Select the Nurse performing vitals from dropdown');
  numberedItem('4.', 'Submit — patient moves to "Waiting for Treatment"');
  spacer();

  subtitle('2.7 Book Next Appointment');
  body('After a visit is completed and the patient has remaining sessions:');
  bullet('Book appointment — Schedule the next session');
  bullet('Will Call Later — Patient will call to schedule');
  bullet('Package Finished — Close if no sessions remain');

  // ─── 3. DOCTOR GUIDE ───
  addPage();
  title('3. Doctor Guide');

  subtitle('3.1 Reviewing New Patient Registrations');
  numberedItem('1.', 'Go to New Patients page');
  numberedItem('2.', 'Under "Pending Doctor Review", tap a patient card');
  numberedItem('3.', 'Review personal info, medical history, registration signature');
  numberedItem('4.', 'Select your name from the Doctor dropdown');
  numberedItem('5.', 'Sign with your digital signature');
  numberedItem('6.', 'Tap "Approve" — Registration PDF downloads as [FirstName] [Phone] Reg form.pdf');
  numberedItem('7.', 'Patient moves to "Awaiting Consultation"');
  spacer();

  subtitle('3.2 Conducting Consultations');
  numberedItem('1.', 'On New Patients page, find patients under "Awaiting Consultation"');
  numberedItem('2.', 'Tap "Consult" on the patient card');
  numberedItem('3.', 'Select your name (Doctor) and multi-select Treatment Interests');
  numberedItem('4.', 'Submit — status changes to "Consulted"');
  numberedItem('5.', 'Once a package is purchased, status becomes "Converted"');
  spacer();

  subtitle('3.3 Treatment Administration');
  numberedItem('1.', 'Go to In Treatment or take a patient from Waiting Area');
  numberedItem('2.', 'View all active packages for the patient');
  spacer(2);
  body('If consent is not signed:', 5);
  bullet('You\'ll see a "No consent — Sign now" badge', 10);
  bullet('Click it to open inline consent signing modal', 10);
  spacer(2);
  body('Selecting a dose:', 5);
  bullet('Choose from preset doses (e.g., Mounjaro 2.5mg–15mg)', 10);
  bullet('Or select "Custom" to enter a custom dose with value, unit, and brand', 10);
  bullet('Custom doses can be saved as new defaults for future use', 10);
  bullet('Leave dose empty to skip a treatment for this visit', 10);
  spacer(2);
  numberedItem('3.', 'Select the Doctor and Nurse performing each treatment');
  numberedItem('4.', 'Add doctor notes (visible only to Doctors and Admins)');
  numberedItem('5.', 'Record consumables used');
  numberedItem('6.', 'Tap "Complete Visit"');
  spacer();

  subtitle('3.4 Important Notes');
  bullet('Doctor Notes are restricted — only Doctors and Admins can view them');
  bullet('Always select your name from the Doctor dropdown');
  bullet('Consent must be signed before a dose can be administered');

  // ─── 4. ADMIN GUIDE ───
  addPage();
  title('4. Admin Guide');
  body('Admins have access to everything Doctors and SDRs can do, plus:');
  spacer();

  subtitle('4.1 Staff Management (Settings → Staff tab)');
  bullet('View all staff members with roles and titles');
  bullet('Add new staff: name, email, role (Admin/Doctor/Nurse/Reception), title');
  bullet('Deactivate staff: toggle status to inactive');
  spacer();

  subtitle('4.2 Treatment Management (Treatments page)');
  bullet('View all treatments organized by category');
  bullet('Add new treatment: name, category, dosage unit, default dose, consent template');
  bullet('Edit treatments: update doses, categories, linked consent forms');
  bullet('Link consumables: associate stock items with default quantities');
  spacer();

  subtitle('4.3 Consumables / Stock Management (Settings → Consumables)');
  bullet('View all stock items with current quantities');
  bullet('Add new items with category, unit, brand, variant, packaging info');
  bullet('Update stock levels as inventory changes');
  bullet('Track usage automatically when treatments are administered');
  spacer();

  subtitle('4.4 Consent Form Management (Settings → Consent Forms)');
  bullet('View all consent templates');
  bullet('Add/edit templates with English and Arabic text');
  bullet('Dynamic placeholders: [PATIENT_NAME], [DATE], [TREATMENT_NAME]');
  bullet('Link templates to treatments for automatic consent requirements');
  spacer();

  subtitle('4.5 Analytics & Reports');
  bullet('View clinic performance metrics');
  bullet('Export Daily Report — multi-sheet Excel with:');
  body('New Patients, Treatment-wise, Patient-wise, Daily Sales, Consultations, SDR Performance', 15);
  spacer();

  subtitle('4.6 WhatsApp Communication');
  bullet('View threaded conversations with patients');
  bullet('Send manual messages via integrated messaging');
  bullet('Quick access: tap WhatsApp icon next to any phone number');
  bullet('"W" shortcut in appointment cards opens relevant chat thread');

  // ─── 5. COMMON WORKFLOWS ───
  addPage();
  title('5. Common Workflows');

  subtitle('Complete Patient Journey');
  const journey = [
    'Appointment Booked (WhatsApp)',
    '  ↓  Patient Arrives → Check-In (Search/Scan ID)',
    '  ↓  New Patient? → Registration (Language → ID Scan → Form → Submit)',
    '  ↓  Doctor Review → Approval & Signature → Registration PDF',
    '  ↓  Consultation → Treatment Interests Selected',
    '  ↓  Package Purchased → Sessions Created',
    '  ↓  Consent Signing → All Consent PDFs Downloaded',
    '  ↓  Vitals Entry (Nurse selects themselves)',
    '  ↓  Treatment Administration (Doctor selects dose, records consumables)',
    '  ↓  Visit Completed',
    '  ↓  Book Next Appointment (if sessions remain)',
  ];
  journey.forEach(step => body(step, 5));
  spacer();

  subtitle('Document Downloads (Automatic)');
  const tblWidths = [55, 55, 60];
  tableRow(['Event', 'PDF Downloaded', 'Naming Format'], tblWidths, true);
  doc.setDrawColor(180, 180, 180);
  doc.line(margin, y - 4, margin + contentWidth, y - 4);
  tableRow(['ID/Document Scanned', 'Emirates ID / Passport', '[Name] [Phone] ID.pdf'], tblWidths);
  tableRow(['Doctor Approves Reg', 'Registration Form', '[FirstName] [Phone] Reg form.pdf'], tblWidths);
  tableRow(['Consents Signed', 'Treatment Consent PDFs', 'Per treatment name'], tblWidths);
  spacer();

  subtitle('Role Access Summary');
  const roleWidths = [45, 25, 22, 25, 22];
  tableRow(['Feature', 'SDR', 'Nurse', 'Doctor', 'Admin'], roleWidths, true);
  doc.line(margin, y - 4, margin + contentWidth, y - 4);
  const roles = [
    ['Book Appointments', '✓', '—', '—', '✓'],
    ['Patient Registration', '✓', '✓', '✓', '✓'],
    ['Doctor Review & Sign', '—', '—', '✓', '✓'],
    ['Consultation', '—', '—', '✓', '✓'],
    ['Vitals Entry', '✓', '✓', '✓', '✓'],
    ['Consent Signing', '✓', '✓', '✓', '✓'],
    ['Treatment Admin', '—', '—', '✓', '✓'],
    ['View Doctor Notes', '—', '—', '✓', '✓'],
    ['Staff Management', '—', '—', '—', '✓'],
    ['Treatment Config', '—', '—', '—', '✓'],
    ['Stock Management', '—', '—', '—', '✓'],
    ['Analytics & Reports', '—', '—', '—', '✓'],
  ];
  roles.forEach(row => tableRow(row, roleWidths));

  // Footer on every page
  const totalPages = doc.getNumberOfPages();
  for (let i = 2; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('COSMIQUE Aesthetics & Dermatology Clinic — User Manual v1.0', margin, 290);
    doc.text(`Page ${i - 1} of ${totalPages - 1}`, pageWidth - margin, 290, { align: 'right' });
  }

  doc.save('Cosmique_User_Manual.pdf');
}
