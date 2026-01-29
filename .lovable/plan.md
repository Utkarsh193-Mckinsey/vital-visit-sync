

## 🏥 Patient Visit & Package Manager - Implementation Plan

A tablet-optimized clinic management system for iPad-based workflow at Cosmique Aesthetic & Dermatology Clinic.

---

### Phase 1: Foundation & Authentication

**Backend Setup (Lovable Cloud)**
- Enable Lovable Cloud for automatic Supabase provisioning
- Create Storage bucket for signatures and PDFs

**Database Schema**
- Create all 9 tables with proper relationships:
  - `staff` (linked to Supabase Auth users)
  - `patients` (with phone as unique identifier)
  - `treatments` (with common doses as JSONB)
  - `consent_templates` (version-controlled)
  - `packages` (session tracking)
  - `visits` (workflow status tracking)
  - `visit_treatments` (treatment documentation)
  - `consent_forms` (signed consents)
  - `vitals_config` (configurable vital parameters)

**Seed Data**
- 4 staff members with roles (admin, reception, nurse, doctor)
- 4 treatments (Mounjaro, IV Drip, EMS, Botox)
- Consent templates for each treatment
- Default vitals configuration (Weight, BP, Heart Rate)

**Authentication System**
- Supabase Auth integration for secure login
- Role-based access control using staff table
- Role-based routing after login
- Session management with auto-logout

---

### Phase 2: Reception Workflow

**Login Screen**
- Large, tablet-optimized input fields (56px height)
- Email/password authentication
- Auto-route based on staff role

**Patient Search Screen** (Reception/Admin)
- Phone number search with large input
- Quick "New Patient" registration button
- Patient cards showing active packages

**Patient Registration** (Reception/Admin)
- Multi-field form with validation
- Signature capture using react-signature-canvas
- Upload signature to cloud storage
- Auto-navigate to Patient Dashboard

**Patient Dashboard**
- Display all active packages as cards
- Add New Package functionality
- Start Visit / Sign Consent flow
- View Visit History access

---

### Phase 3: Consent & Visit Creation

**Add Package Modal**
- Treatment selection dropdown
- Session count with quick presets (4, 8, 12)
- Payment status selection
- Package creation with full session count

**Consent Form Signing**
- Multi-treatment consent flow
- Dynamic placeholder replacement ([PATIENT_NAME], [DATE])
- Individual signature capture per treatment
- Create Visit record with auto-incremented visit number
- Store consent signatures in cloud storage
- Set visit status to "waiting"

---

### Phase 4: Clinical Workflow

**Waiting Area Dashboard** (Nurse/Doctor/Admin)
- Real-time patient queue (10-second polling)
- Show waiting time, treatments, consent status
- "Take Patient" action moves to in-progress
- Auto-refresh for live updates

**Vitals Entry Screen**
- Dynamic form based on vitals_config
- Weight, Blood Pressure, Heart Rate inputs
- Previous visit comparison display
- **Alert System:**
  - 🔴 CRITICAL alerts block proceeding
  - 🟡 WARNING alerts allow with flag
- Save and continue to treatment

**Treatment Documentation** (Doctor/Admin only)
- Read-only vitals display
- For each consented treatment:
  - Treatment performed checkbox
  - Dose selection (radio buttons from common_doses)
  - Custom dose input option
  - Session deduction preview
- Doctor notes (large textarea)
- Complete Visit action:
  - Deduct sessions (FIFO from oldest package)
  - Lock visit record
  - Mark as completed

---

### Phase 5: History & Documents

**Visit History Screen**
- Chronological list of all visits
- Role-filtered content (doctor notes hidden from reception/nurse)
- Per-visit details: vitals, treatments, notes

**PDF Generation**
- Registration PDF (patient info + signature)
- Consent PDF (per treatment, with signature)
- Visit Summary PDF (vitals, treatments, notes)
- Store in cloud storage, URLs saved to database

---

### Phase 6: Admin Settings

**Settings Dashboard** (Admin only)
- Tab-based navigation

**Consent Templates Tab**
- List all templates (active/inactive)
- Create/edit with rich text for consent_text
- Version control (new versions auto-increment)

**Treatments Tab**
- Manage treatments with categories
- Configure dosage units and common doses
- Link consent templates

**Vitals Tab**
- Configure vital parameters
- Set input types (single/dual for BP)
- Define alert rules (critical/warning thresholds)

**Staff Tab**
- Manage staff accounts
- Role assignment
- Status toggle (active/inactive)

---

### Design System (Tablet-Optimized)

**Colors**
- Primary: #1E88E5 (Blue)
- Success: #43A047 (Green)
- Warning: #FB8C00 (Orange)
- Critical: #E53935 (Red)
- Background: #FAFAFA

**Touch-First UI**
- All inputs: 56px height minimum
- All buttons: 56px height, rounded corners
- Touch targets: 44px minimum
- Card shadows with 12px radius
- 16px spacing throughout

**Responsive Layout**
- Optimized for 768px - 1024px (iPad)
- Two-column on larger tablets
- Single column on smaller screens

---

### Key Technical Features

1. **Auto-increment visit numbers** per patient (not global)
2. **FIFO package deduction** (oldest active package first)
3. **Visit locking** after completion (no edits)
4. **Real-time waiting area** (10s polling)
5. **Vitals alert system** with blocking capability
6. **Version-controlled consent templates**
7. **Role-based access** on every screen
8. **Cloud storage** for signatures and PDFs

---

### Security & Compliance

- Row-Level Security (RLS) on all tables
- Role stored in separate table (not user profile)
- Staff actions logged with timestamps
- Locked visits prevent tampering
- Secure signature and document storage

