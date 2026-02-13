
-- appointment_communications table
CREATE TABLE public.appointment_communications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  channel text NOT NULL,
  direction text NOT NULL,
  message_sent text,
  patient_reply text,
  call_duration_seconds integer,
  call_status text,
  call_summary text,
  ai_parsed_intent text,
  ai_confidence text,
  needs_human_review boolean NOT NULL DEFAULT false,
  raw_response jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.appointment_communications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view communications"
  ON public.appointment_communications FOR SELECT
  USING (is_active_staff(auth.uid()));

CREATE POLICY "Staff can insert communications"
  ON public.appointment_communications FOR INSERT
  WITH CHECK (is_active_staff(auth.uid()));

CREATE POLICY "Staff can update communications"
  ON public.appointment_communications FOR UPDATE
  USING (is_active_staff(auth.uid()));

CREATE INDEX idx_comms_appointment ON public.appointment_communications(appointment_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.appointment_communications;

-- pending_requests table
CREATE TABLE public.pending_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  patient_name text NOT NULL,
  phone text NOT NULL,
  request_type text NOT NULL,
  ai_parsed_details jsonb,
  ai_confidence text,
  ai_suggested_reply text,
  original_message text,
  status text NOT NULL DEFAULT 'pending',
  handled_by text,
  handled_at timestamp with time zone,
  staff_reply text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.pending_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view pending requests"
  ON public.pending_requests FOR SELECT
  USING (is_active_staff(auth.uid()));

CREATE POLICY "Staff can insert pending requests"
  ON public.pending_requests FOR INSERT
  WITH CHECK (is_active_staff(auth.uid()));

CREATE POLICY "Staff can update pending requests"
  ON public.pending_requests FOR UPDATE
  USING (is_active_staff(auth.uid()));

CREATE INDEX idx_pending_status ON public.pending_requests(status);
CREATE INDEX idx_pending_appointment ON public.pending_requests(appointment_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.pending_requests;
