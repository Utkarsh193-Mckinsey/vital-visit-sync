-- Create stock_items table to store all consumables/supplies
CREATE TABLE public.stock_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_name TEXT NOT NULL,
  category TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'pcs',
  status TEXT NOT NULL DEFAULT 'active',
  created_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create visit_consumables table to track what was used per visit
CREATE TABLE public.visit_consumables (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  visit_id UUID NOT NULL REFERENCES public.visits(id) ON DELETE CASCADE,
  stock_item_id UUID NOT NULL REFERENCES public.stock_items(id),
  quantity_used NUMERIC NOT NULL DEFAULT 1,
  notes TEXT,
  recorded_by UUID REFERENCES public.staff(id),
  created_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on both tables
ALTER TABLE public.stock_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visit_consumables ENABLE ROW LEVEL SECURITY;

-- RLS policies for stock_items
CREATE POLICY "Staff can view stock items"
  ON public.stock_items FOR SELECT
  USING (is_active_staff(auth.uid()));

CREATE POLICY "Admin can insert stock items"
  ON public.stock_items FOR INSERT
  WITH CHECK (get_user_role(auth.uid()) = 'admin'::staff_role);

CREATE POLICY "Admin can update stock items"
  ON public.stock_items FOR UPDATE
  USING (get_user_role(auth.uid()) = 'admin'::staff_role);

-- RLS policies for visit_consumables
CREATE POLICY "Staff can view visit consumables"
  ON public.visit_consumables FOR SELECT
  USING (is_active_staff(auth.uid()));

CREATE POLICY "Doctor/Admin can insert visit consumables"
  ON public.visit_consumables FOR INSERT
  WITH CHECK (get_user_role(auth.uid()) = ANY (ARRAY['doctor'::staff_role, 'admin'::staff_role]));

CREATE POLICY "Doctor/Admin can update visit consumables"
  ON public.visit_consumables FOR UPDATE
  USING (get_user_role(auth.uid()) = ANY (ARRAY['doctor'::staff_role, 'admin'::staff_role]));

CREATE POLICY "Doctor/Admin can delete visit consumables"
  ON public.visit_consumables FOR DELETE
  USING (get_user_role(auth.uid()) = ANY (ARRAY['doctor'::staff_role, 'admin'::staff_role]));

-- Create indexes for performance
CREATE INDEX idx_visit_consumables_visit_id ON public.visit_consumables(visit_id);
CREATE INDEX idx_visit_consumables_stock_item_id ON public.visit_consumables(stock_item_id);
CREATE INDEX idx_stock_items_category ON public.stock_items(category);

-- Enable realtime for consumables tracking
ALTER PUBLICATION supabase_realtime ADD TABLE public.visit_consumables;