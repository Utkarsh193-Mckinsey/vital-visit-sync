
# Staff Performance Reports + "Registered By" Tracking + Booking Confirmation Messages

## Overview
This plan covers four interconnected features:
1. A new **Staff Performance Report** page accessible from the sidebar
2. A **"Registered By"** field added to patient registration and appointment flows
3. **Instant WhatsApp confirmation** when appointments are booked manually
4. **WhatsApp confirmation for follow-up bookings** (next session appointments)

---

## 1. Staff Performance Report Page

A new page at `/staff-reports` with two report tabs:

### SDR / Reception Report
- Number of appointments booked (grouped by staff name from `booked_by` field)
- Total sales amount (sum of `total_amount` from packages where `created_by` matches staff)
- Amount collected (sum of `amount_paid`)
- New patients registered (count where `registered_by` matches staff -- new column)
- Filterable by date range (default: current month)

### Doctor Report
- Number of consultations done (count from `patients` where `consultation_done_by` matches)
- Conversion rate: patients who got packages after consultation
- Total package value from converted patients
- Treatments administered (count from `visit_treatments` where `doctor_staff_id` matches)
- Filterable by date range

### Sidebar Addition
- New nav item "Staff Reports" with a `ClipboardList` icon, visible to `admin` role only, placed between Analytics and Settings

---

## 2. "Registered By" / "Booked By" Tracking

### Database Change
- Add `registered_by` column (text, nullable) to the `patients` table to track who registered each patient

### Patient Registration (`/patient/register`)
- Before the signature section, add a **"Registered By"** dropdown
- Options: all active staff with role `admin` or `reception` (SDR title), plus an "Other" option
- If "Other" is selected, show a text input for a custom name
- This value is saved to `patients.registered_by`

### Add Existing Patient (`/patient/add-existing`)
- Same "Registered By" dropdown added before the submit button

### Appointment Modal (`AddAppointmentModal`)
- Change the "Booked By" free-text field to a dropdown with staff names (admin + reception roles) plus "Other" with custom input
- This ensures every appointment has a proper staff name attached

---

## 3. Instant WhatsApp Confirmation on Manual Booking

When a new appointment is created via the `AddAppointmentModal`:
- After successful insert, call the `send-whatsapp` edge function with a formatted message:

```
Hi [Patient Name],

Your appointment at Cosmique Clinic has been booked.

Date: [Date]
Time: [Time]
Service: [Service]

For any queries, please contact us at +971XXXXXXXXX.

Cosmique Aesthetics & Dermatology
Beach Park Plaza, Al Mamzar, Dubai
```

---

## 4. WhatsApp Confirmation for Follow-up Bookings

When a next-session appointment is booked via `BookNextAppointment`:
- After successful insert, call `send-whatsapp` with:

```
Hi [Patient Name],

Your next appointment at Cosmique Clinic has been booked.

Date: [Date]
Time: [Time]
Service: [Service]

For any queries, please contact us at +971XXXXXXXXX.

Cosmique Aesthetics & Dermatology
Beach Park Plaza, Al Mamzar, Dubai
```

---

## Technical Details

### Database Migration
```sql
ALTER TABLE patients ADD COLUMN registered_by text;
```

### Files to Create
- `src/pages/StaffReports.tsx` -- new report page with SDR and Doctor tabs

### Files to Modify
- `src/components/layout/AppSidebar.tsx` -- add Staff Reports nav item
- `src/App.tsx` -- add route for `/staff-reports`
- `src/pages/PatientRegistration.tsx` -- add "Registered By" dropdown before signature
- `src/pages/AddExistingPatient.tsx` -- add "Registered By" dropdown before submit
- `src/components/appointments/AddAppointmentModal.tsx` -- change "Booked By" to staff dropdown + send WhatsApp on create
- `src/pages/BookNextAppointment.tsx` -- send WhatsApp confirmation after booking

### Staff Dropdown Logic
- Fetch from `staff` table where `status = 'active'` and `role in ('admin', 'reception')`
- Display `full_name` as options
- Include an "Other" option that reveals a text input for custom names
- For Doctor report, fetch staff where `role = 'doctor'`

### Report Queries
- SDR: `appointments` grouped by `booked_by`, `packages` joined by `created_by`, `patients` by `registered_by`
- Doctor: `patients` by `consultation_done_by`, `visit_treatments` by `doctor_staff_id`, `packages` by patient conversion
