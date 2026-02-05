-- Add default_dose column to treatments table
ALTER TABLE public.treatments
ADD COLUMN default_dose TEXT;