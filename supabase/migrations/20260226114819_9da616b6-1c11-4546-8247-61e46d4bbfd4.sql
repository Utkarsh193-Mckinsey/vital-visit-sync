
ALTER TABLE public.packages
ADD COLUMN IF NOT EXISTS consulting_doctor_id uuid REFERENCES public.staff(id),
ADD COLUMN IF NOT EXISTS package_notes text,
ADD COLUMN IF NOT EXISTS is_patient_initiated boolean NOT NULL DEFAULT false;
