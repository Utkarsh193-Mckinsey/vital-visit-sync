
-- Add payment fields to packages table
ALTER TABLE public.packages
ADD COLUMN total_amount numeric NULL,
ADD COLUMN amount_paid numeric NOT NULL DEFAULT 0,
ADD COLUMN next_payment_date date NULL,
ADD COLUMN next_payment_amount numeric NULL;

-- Create package_payments table for split/multiple payment methods
CREATE TABLE public.package_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  package_id uuid NOT NULL REFERENCES public.packages(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  payment_method text NOT NULL DEFAULT 'cash',
  payment_date timestamp with time zone NOT NULL DEFAULT now(),
  notes text NULL,
  created_date timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.package_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view package payments"
ON public.package_payments FOR SELECT
USING (is_active_staff(auth.uid()));

CREATE POLICY "Staff can insert package payments"
ON public.package_payments FOR INSERT
WITH CHECK (is_active_staff(auth.uid()));

CREATE POLICY "Staff can update package payments"
ON public.package_payments FOR UPDATE
USING (is_active_staff(auth.uid()));
