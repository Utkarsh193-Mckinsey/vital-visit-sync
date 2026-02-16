
-- Add a display title column for staff (e.g. "Sales Development Representative")
ALTER TABLE public.staff ADD COLUMN title text;

-- Set titles for existing staff
UPDATE public.staff SET title = 'Doctor' WHERE role = 'doctor';
UPDATE public.staff SET title = 'Nurse / Beauty Therapist' WHERE role = 'nurse';
UPDATE public.staff SET title = 'Reception' WHERE role = 'reception';
UPDATE public.staff SET title = 'Admin' WHERE role = 'admin';

-- Update SDR titles
UPDATE public.staff SET title = 'Sales Development Representative' WHERE email IN ('priti@cosmique.ae', 'yara@cosmique.ae');
