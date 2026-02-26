
ALTER TABLE public.patients
ADD COLUMN IF NOT EXISTS caution_notes text,
ADD COLUMN IF NOT EXISTS contraindicated_treatments uuid[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS package_notes text;
