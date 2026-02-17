# Cosmique Clinic Management System — User Manual

> **Version 1.0 | February 2026**

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [SDR (Sales Development Representative) Guide](#sdr-guide)
3. [Doctor Guide](#doctor-guide)
4. [Admin Guide](#admin-guide)
5. [Common Workflows](#common-workflows)

---

## 1. Getting Started

### Logging In
1. Open the app on your iPad/tablet
2. Enter your email and password
3. You'll land on the **Dashboard**

### Navigation
Use the **left sidebar** to access all sections:
- **Dashboard** — Overview of today's clinic activity
- **Appointments** — View and manage today's bookings
- **New Patients** — Pending registrations and consultations
- **All Patients** — Search and access any patient
- **Waiting Area** — Patients checked in and waiting
- **In Treatment** — Active treatment sessions
- **Completed Today** — Finished visits for the day
- **Book Next Appt** — Follow-up scheduling for patients with remaining sessions
- **WhatsApp Chats** — View patient communication threads
- **Analytics** — Reports and data export
- **Treatments** — Treatment catalog management
- **Settings** — Staff, consumables, and consent form management

> **Blinking badges** on sidebar items indicate pending actions that need attention.

---

## 2. SDR (Sales Development Representative) Guide

### 2.1 Booking Appointments via WhatsApp

Appointments are booked by sending a structured message to the clinic's WhatsApp number in this format:

```
Name: [Patient Name]
Phone: [Phone Number]
Date: [DD/MM/YYYY]
Time: [HH:MM AM/PM]
Service: [Treatment Name]
Booked by: [Your Name]
```

**Rules:**
- Times must be between **10:00 AM and 10:00 PM**
- Dates must be **today or future**
- "Booked by" must match your registered staff name
- If any information is missing, the system will message you back asking for corrections
- Only **one active appointment per patient** is allowed — if a conflict exists, you'll be asked to confirm replacement

### 2.2 Patient Check-In

1. Go to **All Patients** (or tap the search bar on the home screen)
2. Search by **name**, **phone number**, or **Emirates ID**
3. Tap the patient card to open their dashboard
4. From the patient dashboard, start a new visit

**Tip:** If the search box is empty and you tap "Search", it will open the **Scan ID** feature to quickly find patients.

### 2.3 Registering a New Patient

1. Go to **All Patients** → tap **"New Patient Registration"**
2. **Step 1 — Language:** Select English or Arabic
3. **Step 2 — Scan Document:**
   - Choose document type: **Emirates ID**, **Passport**, or **Other**
   - Capture **front side** photo → preview → confirm
   - Capture **back side** photo → preview → confirm (or skip back side)
   - The system will auto-extract patient details (name, DOB, nationality, etc.)
   - **ID PDF automatically downloads** with naming: `[Name] [Phone] ID.pdf`
   - Alternatively, tap **"+ Manual Entry"** to skip scanning and fill details manually
4. **Step 3 — Registration Form:**
   - Fill in patient demographics (defaults: UAE, Dubai)
   - Emergency contact details
   - Medical history — toggle Yes/No for each condition; "Yes" requires explanation
   - Patient signature
5. Submit the form — patient enters **"Pending Doctor Review"** queue

### 2.4 Adding an Existing Patient (Data Migration)

1. Go to **All Patients** → tap **"Add Existing Patient"**
2. Enter the **Patient File Number** (from legacy system)
3. Optionally tap **"Scan Document"** to auto-fill details from Emirates ID, Passport, or other document
4. Fill in patient information, emergency contacts, medical history
5. **Packages section (optional):**
   - Add treatment lines with sessions purchased and sessions already used
   - Add complementary (free) treatment sessions
   - Enter payment details with split payment support (Cash, Card, Tabby, Tamara, Toothpick)
   - Set payment date and pending balance if applicable
6. Submit — patient goes to Doctor Review queue

### 2.5 Consent Signing

When a patient arrives for treatment and consent is required:

1. The system shows which treatments need consent
2. For each treatment:
   - Read the consent form (toggle between English/Arabic)
   - Patient signs on the signature pad
   - Tap "Sign & Submit"
3. **All signed consent PDFs automatically download** upon completion
4. A separate **Photo/Video consent** form is also presented for media release

### 2.6 Vitals Entry

1. From Waiting Area, select a patient
2. Enter required vitals (weight, blood pressure, heart rate, temperature, etc.)
3. **Select the Nurse** performing vitals from the dropdown
4. Submit vitals — patient moves to "Waiting for Treatment"

### 2.7 Book Next Appointment

After a visit is completed and the patient has remaining sessions:

1. Go to **Book Next Appt** (check the badge for pending count)
2. Options for each patient:
   - **Book appointment** — Schedule the next session
   - **Will Call Later** — Patient will call to schedule
   - **Package Finished** — Close if no sessions remain

---

## 3. Doctor Guide

### 3.1 Reviewing New Patient Registrations

1. Go to **New Patients** page
2. Under **"Pending Doctor Review"**, tap a patient card
3. Review the patient's:
   - Personal information and demographics
   - Medical history declarations
   - Registration signature
4. Select your name from the **Doctor** dropdown
5. Sign with your digital signature
6. Tap **"Approve"**
7. **Registration PDF automatically downloads** as `[FirstName] [Phone] Reg form.pdf`
8. Patient moves to **"Awaiting Consultation"**

### 3.2 Conducting Consultations

1. On **New Patients** page, find patients under **"Awaiting Consultation"**
2. Tap **"Consult"** on the patient card
3. In the consultation modal:
   - Select your name (Doctor)
   - Multi-select **Treatment Interests** (Hair, Skin, Fat Loss, IV, etc.)
4. Submit — patient status changes to **"Consulted"**
5. Once a package is purchased, status becomes **"Converted"**

### 3.3 Treatment Administration

1. Go to **In Treatment** or take a patient from **Waiting Area**
2. On the Treatment page, you'll see all active packages for the patient
3. For each treatment:

   **If consent is not signed:**
   - You'll see a **"No consent — Sign now"** badge
   - Click it to open the inline consent signing modal
   - Have the patient sign, then proceed

   **Selecting a dose:**
   - Choose from **preset doses** (e.g., Mounjaro 2.5mg–15mg)
   - Or select **"Custom"** to enter a custom dose with value, unit, and brand
   - Custom doses can be **saved as new defaults** for future use
   - Leave dose empty to **skip** a treatment for this visit

4. Select the **Doctor** and **Nurse** performing each treatment
5. Add **doctor notes** (visible only to Doctors and Admins)
6. Record **consumables used** (auto-populated from treatment defaults, adjustable)
7. Tap **"Complete Visit"**

### 3.4 Important Notes

- **Doctor Notes** are restricted — only Doctors and Admins can view them in visit history
- Always **select your name** from the Doctor dropdown — the system requires explicit selection for clinical accountability
- Consent must be signed before a dose can be administered for any treatment

---

## 4. Admin Guide

Admins have access to **everything** Doctors and SDRs can do, plus:

### 4.1 Staff Management

**Settings → Staff tab**

- View all staff members with their roles and titles
- **Add new staff:** Enter name, email, role (Admin/Doctor/Nurse/Reception), and title
- **Deactivate staff:** Toggle status to inactive (they can no longer log in)
- Staff categories: Doctor, Nurse/Beauty Therapist, SDR, Reception, Admin

### 4.2 Treatment Management

**Treatments page**

- View all treatments organized by category
- **Add new treatment:**
  - Name, Category (Hair Treatment, Face Injectable, Face Non-Invasive, IV Drip, Fat Loss, Body Contouring, etc.)
  - Dosage unit (mg, ml, Units, mcg, Session)
  - Default dose and common dose presets
  - Link to a consent template
  - Administration method
- **Edit treatments:** Update doses, categories, or linked consent forms
- **Link consumables:** Associate stock items with default quantities per treatment

### 4.3 Consumables / Stock Management

**Settings → Consumables tab**

- View all stock items with current quantities
- **Add new items** with category, unit, brand, variant, packaging info
- **Update stock levels** as inventory changes
- Track usage automatically when treatments are administered

### 4.4 Consent Form Management

**Settings → Consent Forms tab**

- View all consent templates
- **Add new templates:** Enter form name, English text, Arabic text
- **Edit existing templates:** Update consent language
- Templates use **dynamic placeholders:**
  - `[PATIENT_NAME]` — Auto-replaced with patient's name
  - `[DATE]` — Auto-replaced with current date
  - `[TREATMENT_NAME]` — Auto-replaced with treatment name
- Link templates to treatments so consent is automatically required

### 4.5 Analytics & Reports

**Analytics page**

- View clinic performance metrics
- **Export Daily Report** — Downloads a multi-sheet Excel file with:
  - **New Patients** — Demographics of newly registered patients
  - **Treatment-wise** — Service usage breakdown
  - **Patient-wise** — Visit logs per patient
  - **Daily Sales** — Package payments and revenue
  - **Consultations** — Interest tracking and conversion rates
  - **SDR Performance** — Sales conversion metrics grouped by "Booked by" agent

### 4.6 WhatsApp Communication

**WhatsApp Chats page**

- View threaded conversations with patients
- Send manual messages via the WATI integration
- Quick access: Tap the WhatsApp icon next to any patient's phone number throughout the app
- Appointment cards have a **"W" shortcut** that opens the relevant chat thread

---

## 5. Common Workflows

### Complete Patient Journey

```
Appointment Booked (WhatsApp)
    ↓
Patient Arrives → Check-In (Search/Scan ID)
    ↓
New Patient? → Registration (Language → ID Scan → Form → Submit)
    ↓
Doctor Review → Approval & Signature → Registration PDF ↓
    ↓
Consultation → Treatment Interests Selected
    ↓
Package Purchased → Sessions Created
    ↓
Consent Signing → All Consent PDFs Downloaded
    ↓
Vitals Entry (Nurse selects themselves)
    ↓
Treatment Administration (Doctor selects dose, records consumables)
    ↓
Visit Completed
    ↓
Book Next Appointment (if sessions remain)
```

### Document Downloads (Automatic)

| Event | PDF Downloaded | Naming Format |
|-------|---------------|---------------|
| ID/Document Scanned | Emirates ID / Passport PDF | `[Name] [Phone] ID.pdf` |
| Doctor Approves Registration | Registration Form PDF | `[FirstName] [Phone] Reg form.pdf` |
| All Consents Signed | Treatment Consent PDFs | Per treatment name |

### Role Access Summary

| Feature | SDR/Reception | Nurse | Doctor | Admin |
|---------|:---:|:---:|:---:|:---:|
| Book Appointments | ✅ | ❌ | ❌ | ✅ |
| Patient Registration | ✅ | ✅ | ✅ | ✅ |
| Doctor Review & Sign | ❌ | ❌ | ✅ | ✅ |
| Consultation | ❌ | ❌ | ✅ | ✅ |
| Vitals Entry | ✅ | ✅ | ✅ | ✅ |
| Consent Signing | ✅ | ✅ | ✅ | ✅ |
| Treatment Admin | ❌ | ❌ | ✅ | ✅ |
| View Doctor Notes | ❌ | ❌ | ✅ | ✅ |
| Staff Management | ❌ | ❌ | ❌ | ✅ |
| Treatment Config | ❌ | ❌ | ❌ | ✅ |
| Stock Management | ❌ | ❌ | ❌ | ✅ |
| Analytics & Reports | ❌ | ❌ | ❌ | ✅ |

---

**For support or questions, contact your system administrator.**
