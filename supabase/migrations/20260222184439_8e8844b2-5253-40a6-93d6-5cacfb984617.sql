CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
  RETURNS staff_role
  LANGUAGE sql
  STABLE SECURITY DEFINER
  SET search_path TO 'public'
AS $$
  SELECT role FROM public.staff
  WHERE user_id = _user_id AND status = 'active'
  ORDER BY
    CASE role
      WHEN 'admin' THEN 1
      WHEN 'doctor' THEN 2
      WHEN 'nurse'  THEN 3
      WHEN 'reception' THEN 4
      ELSE 5
    END
  LIMIT 1
$$;