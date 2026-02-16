
ALTER TABLE public.patients
ADD COLUMN IF NOT EXISTS file_number text NULL;
