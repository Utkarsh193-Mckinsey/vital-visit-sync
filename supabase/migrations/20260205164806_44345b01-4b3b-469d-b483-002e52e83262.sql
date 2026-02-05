-- Create junction table to link treatments with their default consumables
CREATE TABLE public.treatment_consumables (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  treatment_id UUID NOT NULL REFERENCES public.treatments(id) ON DELETE CASCADE,
  stock_item_id UUID NOT NULL REFERENCES public.stock_items(id) ON DELETE CASCADE,
  default_quantity NUMERIC NOT NULL DEFAULT 1,
  notes TEXT,
  created_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(treatment_id, stock_item_id)
);

-- Enable RLS
ALTER TABLE public.treatment_consumables ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Staff can view treatment consumables"
ON public.treatment_consumables
FOR SELECT
USING (is_active_staff(auth.uid()));

CREATE POLICY "Admin can insert treatment consumables"
ON public.treatment_consumables
FOR INSERT
WITH CHECK (get_user_role(auth.uid()) = 'admin'::staff_role);

CREATE POLICY "Admin can update treatment consumables"
ON public.treatment_consumables
FOR UPDATE
USING (get_user_role(auth.uid()) = 'admin'::staff_role);

CREATE POLICY "Admin can delete treatment consumables"
ON public.treatment_consumables
FOR DELETE
USING (get_user_role(auth.uid()) = 'admin'::staff_role);