-- Track next appointment booking status after visit completion
ALTER TABLE public.visits
  ADD COLUMN next_appointment_status text DEFAULT NULL;
-- Values: NULL (not yet handled), 'booked', 'will_call_later', 'package_finished'