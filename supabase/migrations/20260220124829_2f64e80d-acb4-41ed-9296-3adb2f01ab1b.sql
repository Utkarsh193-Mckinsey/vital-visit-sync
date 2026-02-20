
-- Create clinic_packages table (package templates for the clinic)
CREATE TABLE public.clinic_packages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  base_price NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create clinic_package_treatments table (treatment lines for each template)
CREATE TABLE public.clinic_package_treatments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_package_id UUID NOT NULL REFERENCES public.clinic_packages(id) ON DELETE CASCADE,
  treatment_id UUID NOT NULL REFERENCES public.treatments(id) ON DELETE CASCADE,
  sessions INTEGER NOT NULL DEFAULT 1,
  is_complimentary BOOLEAN NOT NULL DEFAULT false,
  created_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.clinic_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinic_package_treatments ENABLE ROW LEVEL SECURITY;

-- RLS policies for clinic_packages
CREATE POLICY "Staff can view clinic packages"
  ON public.clinic_packages FOR SELECT
  USING (is_active_staff(auth.uid()));

CREATE POLICY "Admin can insert clinic packages"
  ON public.clinic_packages FOR INSERT
  WITH CHECK (get_user_role(auth.uid()) = 'admin'::staff_role);

CREATE POLICY "Admin can update clinic packages"
  ON public.clinic_packages FOR UPDATE
  USING (get_user_role(auth.uid()) = 'admin'::staff_role);

CREATE POLICY "Admin can delete clinic packages"
  ON public.clinic_packages FOR DELETE
  USING (get_user_role(auth.uid()) = 'admin'::staff_role);

-- RLS policies for clinic_package_treatments
CREATE POLICY "Staff can view clinic package treatments"
  ON public.clinic_package_treatments FOR SELECT
  USING (is_active_staff(auth.uid()));

CREATE POLICY "Admin can insert clinic package treatments"
  ON public.clinic_package_treatments FOR INSERT
  WITH CHECK (get_user_role(auth.uid()) = 'admin'::staff_role);

CREATE POLICY "Admin can update clinic package treatments"
  ON public.clinic_package_treatments FOR UPDATE
  USING (get_user_role(auth.uid()) = 'admin'::staff_role);

CREATE POLICY "Admin can delete clinic package treatments"
  ON public.clinic_package_treatments FOR DELETE
  USING (get_user_role(auth.uid()) = 'admin'::staff_role);
