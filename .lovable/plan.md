

## Fix: Treatment Save Fails Due to Role Lookup Bug

### Root Cause

The `get_user_role()` database function uses `LIMIT 1` **without ORDER BY**, so when a user has multiple staff records (Sarika has admin, doctor, reception, nurse), it returns a random role -- currently returning `doctor` instead of `admin`. This makes the RLS policy check `get_user_role(auth.uid()) = 'admin'` fail every time.

### Solution

Update the `get_user_role()` function to prioritize the `admin` role when a user has multiple staff records. This is done by adding an `ORDER BY` that sorts `admin` first.

### Technical Details

**Database migration** -- alter the `get_user_role` function:

```sql
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
```

This single change fixes the save error for treatments (and any other table using the same RLS pattern). No frontend code changes needed.

