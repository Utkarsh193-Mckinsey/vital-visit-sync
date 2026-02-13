
-- Add new columns to patients table for expanded registration
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS nationality text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS gender text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS country_of_residence text DEFAULT 'United Arab Emirates',
  ADD COLUMN IF NOT EXISTS emirate text DEFAULT 'Dubai',
  ADD COLUMN IF NOT EXISTS emergency_contact_name text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS emergency_contact_number text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS emergency_contact_relationship text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS medical_heart_disease boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS medical_heart_disease_details text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS medical_blood_pressure boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS medical_blood_pressure_details text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS medical_allergy boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS medical_allergy_details text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS medical_diabetes boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS medical_diabetes_details text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS medical_other boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS medical_other_details text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS doctor_signature_url text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS doctor_reviewed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS doctor_reviewed_by uuid DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS doctor_reviewed_date timestamp with time zone DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS language text DEFAULT 'en';

-- Make email optional (was required before)
ALTER TABLE public.patients ALTER COLUMN email DROP NOT NULL;
ALTER TABLE public.patients ALTER COLUMN email SET DEFAULT NULL;
