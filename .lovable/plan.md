
# Cosmique Packages Feature Plan

## Overview

This feature adds two major capabilities:

1. **Cosmique Packages** — Pre-built treatment bundles (like Mounjaro 1-month, 2-month, etc.) that auto-fill treatments, complimentary sessions, and pricing when selected.
2. **Package Templates Manager** — An admin section in Settings where staff can create, edit, and manage these package templates.
3. **VAT Display** — When a price is entered, the form shows base price + 5% VAT = final total automatically.
4. **Mounjaro Packages** — 6 pre-seeded Mounjaro packages (1–6 months) based on the uploaded PDF.

---

## What Changes

### 1. New Database Table: `clinic_packages` (Package Templates)

A new table to store reusable package templates:

```text
clinic_packages
├── id (uuid, PK)
├── name (text) — e.g. "Mounjaro 1 Month Package"
├── description (text, optional)
├── base_price (numeric) — price before VAT
├── status (text) — active / inactive
├── created_date (timestamp)
```

A linked table for template treatment lines:
```text
clinic_package_treatments
├── id (uuid, PK)
├── clinic_package_id (uuid, FK → clinic_packages)
├── treatment_id (uuid, FK → treatments)
├── sessions (integer)
├── is_complimentary (boolean)
```

RLS: Admin can manage (insert/update), all active staff can view.

---

### 2. Updated Add Package Modal (`AddPackageModal.tsx`)

The modal will have two sections at the top:

**Section A: Cosmique Packages**
- A dropdown showing all active `clinic_packages`
- When a package is selected, it auto-fills:
  - All treatment lines (with session counts)
  - All complimentary treatment lines
  - The base price field
  - A calculated VAT row: `base price + 5% = total (VAT included)`
- The total amount stored in DB = base price × 1.05

**Section B: Add Treatments (Custom)**
- Works exactly as before — manual treatment/session selection

The two sections are separated visually. Staff can either pick a Cosmique Package OR build manually.

---

### 3. VAT Calculation Display

When a Cosmique Package is selected (or when the staff enters a base price in a "Package Price" field):

```
Package Price:   AED 2,299.00
VAT (5%):       +AED 114.95
─────────────────────────────
Total Bill:      AED 2,413.95  (VAT Included)
```

The `totalAmount` saved to DB = `basePrice × 1.05`.

---

### 4. Admin Settings — "Packages" Tab

A new tab is added to `AdminSettings.tsx` called **Packages**, rendering a new `ClinicPackagesManager` component.

**ClinicPackagesManager** allows admins to:
- View all package templates in a list
- Create a new package:
  - Name
  - Description (optional)
  - Add treatment lines (treatment + session count)
  - Add complimentary treatment lines
  - Set base price (VAT preview shown)
- Edit / deactivate existing packages

---

### 5. Pre-seeded Mounjaro Packages

Based on the uploaded PDF, 6 Mounjaro packages will be seeded into `clinic_packages` using a database migration. Package details (from standard Mounjaro weight management protocols):

| Package | Duration | Treatment | Sessions | Comp Sessions | Base Price |
|---|---|---|---|---|---|
| Mounjaro 1 Month | 1 mo | Mounjaro | 4 | 0 | 2,299 |
| Mounjaro 2 Month | 2 mo | Mounjaro | 8 | 0 | 4,299 |
| Mounjaro 3 Month | 3 mo | Mounjaro | 12 | 0 | 5,999 |
| Mounjaro 4 Month | 4 mo | Mounjaro | 16 | 0 | 7,499 |
| Mounjaro 6 Month | 6 mo | Mounjaro | 24 | 0 | 9,999 |

> **Note:** Since the PDF could not be parsed, exact pricing and session counts are placeholders. These can be easily edited by the admin in the new Packages settings tab. Please confirm the correct prices if they differ.

---

## Files To Create / Modify

### New Files
- `src/components/admin/ClinicPackagesManager.tsx` — Admin UI for managing package templates
- `supabase/migrations/[timestamp]_clinic_packages.sql` — DB schema for the two new tables + RLS + seed data

### Modified Files
- `src/components/patient/AddPackageModal.tsx` — Add "Cosmique Packages" section with auto-fill + VAT display
- `src/pages/AdminSettings.tsx` — Add "Packages" tab calling `ClinicPackagesManager`

---

## User Flow

```text
Staff opens "Add Package" for a patient
    │
    ├─ [Cosmique Package] → Select from dropdown
    │       ↓
    │  Treatments auto-fill + VAT calculated
    │       ↓
    │  Staff confirms payment → Save
    │
    └─ [Add Treatments] → Manual entry (existing flow unchanged)
```

---

## Technical Notes

- VAT is always 5% per UAE law — hardcoded constant `VAT_RATE = 0.05`
- The `total_amount` saved to the DB is always the VAT-inclusive total
- Base price is only a UI concept; it is NOT stored separately (keeps DB schema clean)
- Package templates are fetched once when the modal opens, alongside the treatments list
- Selecting a Cosmique Package clears any existing manual treatment lines and replaces them
- Staff can still manually edit/add/remove treatments after selecting a package template
