-- Fix treatments table RLS policies to be PERMISSIVE (not restrictive)
-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Admin can insert treatments" ON public.treatments;
DROP POLICY IF EXISTS "Admin can update treatments" ON public.treatments;
DROP POLICY IF EXISTS "Staff can view treatments" ON public.treatments;

-- Recreate as PERMISSIVE policies (default, no AS RESTRICTIVE)
CREATE POLICY "Admin can insert treatments"
ON public.treatments
FOR INSERT
WITH CHECK (get_user_role(auth.uid()) = 'admin'::staff_role);

CREATE POLICY "Admin can update treatments"
ON public.treatments
FOR UPDATE
USING (get_user_role(auth.uid()) = 'admin'::staff_role);

CREATE POLICY "Staff can view treatments"
ON public.treatments
FOR SELECT
USING (is_active_staff(auth.uid()));