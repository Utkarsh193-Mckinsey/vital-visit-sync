-- Add Arabic consent text column to consent_templates
ALTER TABLE public.consent_templates 
ADD COLUMN IF NOT EXISTS consent_text_ar text;

-- Add language column to consent_forms to record which language was selected
ALTER TABLE public.consent_forms 
ADD COLUMN IF NOT EXISTS language text DEFAULT 'en';

-- Delete all existing consent forms as requested by user
DELETE FROM public.consent_forms;