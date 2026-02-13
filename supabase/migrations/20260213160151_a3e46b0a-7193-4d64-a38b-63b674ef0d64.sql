
-- Create appointment status enum-like check
CREATE TABLE public.appointments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_name text NOT NULL,
  phone text NOT NULL,
  appointment_date date NOT NULL,
  appointment_time time NOT NULL,
  service text NOT NULL,
  booked_by text,
  status text NOT NULL DEFAULT 'upcoming',
  confirmation_status text NOT NULL DEFAULT 'unconfirmed',
  is_new_patient boolean NOT NULL DEFAULT false,
  no_show_count integer NOT NULL DEFAULT 0,
  followup_step integer NOT NULL DEFAULT 0,
  followup_status text,
  last_reply text,
  reminder_24hr_sent boolean NOT NULL DEFAULT false,
  reminder_24hr_sent_at timestamp with time zone,
  reminder_2hr_sent boolean NOT NULL DEFAULT false,
  reminder_2hr_sent_at timestamp with time zone,
  confirmed_at timestamp with time zone,
  rescheduled_from uuid REFERENCES public.appointments(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone
);

-- Enable RLS
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Staff can view appointments"
  ON public.appointments FOR SELECT
  USING (is_active_staff(auth.uid()));

CREATE POLICY "Staff can insert appointments"
  ON public.appointments FOR INSERT
  WITH CHECK (is_active_staff(auth.uid()));

CREATE POLICY "Staff can update appointments"
  ON public.appointments FOR UPDATE
  USING (is_active_staff(auth.uid()));

CREATE POLICY "Staff can delete appointments"
  ON public.appointments FOR DELETE
  USING (get_user_role(auth.uid()) = 'admin'::staff_role);

-- Index for common queries
CREATE INDEX idx_appointments_date ON public.appointments(appointment_date);
CREATE INDEX idx_appointments_status ON public.appointments(status);
CREATE INDEX idx_appointments_phone ON public.appointments(phone);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_appointments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_appointments_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_appointments_updated_at();
