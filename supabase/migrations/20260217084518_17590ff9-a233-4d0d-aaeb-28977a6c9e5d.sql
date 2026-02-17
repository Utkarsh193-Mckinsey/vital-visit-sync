
-- Add consultation tracking fields to patients table
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS consultation_status text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS consultation_done_by uuid REFERENCES public.staff(id) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS consultation_date timestamp with time zone DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS treatment_interests text[] DEFAULT NULL;

-- consultation_status values: NULL (not yet reviewed), 'awaiting_consultation' (doctor signed reg), 'consulted' (consultation done), 'converted' (package added)
