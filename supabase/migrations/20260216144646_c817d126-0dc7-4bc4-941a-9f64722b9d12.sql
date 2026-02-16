
-- Add nurse_staff_id to visit_treatments for per-treatment nurse tracking
ALTER TABLE public.visit_treatments 
ADD COLUMN nurse_staff_id uuid REFERENCES public.staff(id);

-- Add doctor_staff_id to visit_treatments (rename performed_by concept, keep performed_by as doctor)
ALTER TABLE public.visit_treatments 
ADD COLUMN doctor_staff_id uuid REFERENCES public.staff(id);
