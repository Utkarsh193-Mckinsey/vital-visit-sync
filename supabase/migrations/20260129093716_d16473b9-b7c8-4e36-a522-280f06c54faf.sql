-- Create enums first
CREATE TYPE public.staff_role AS ENUM ('admin', 'reception', 'nurse', 'doctor');
CREATE TYPE public.staff_status AS ENUM ('active', 'inactive');
CREATE TYPE public.patient_status AS ENUM ('active', 'inactive');
CREATE TYPE public.treatment_status AS ENUM ('active', 'inactive');
CREATE TYPE public.dosage_unit AS ENUM ('mg', 'ml', 'Units', 'mcg', 'Session');
CREATE TYPE public.consent_status AS ENUM ('active', 'inactive');
CREATE TYPE public.payment_status AS ENUM ('paid', 'pending');
CREATE TYPE public.package_status AS ENUM ('active', 'depleted', 'expired');
CREATE TYPE public.visit_status AS ENUM ('waiting', 'in_progress', 'completed');
CREATE TYPE public.vital_input_type AS ENUM ('single', 'dual');
CREATE TYPE public.vital_status AS ENUM ('active', 'inactive');

-- Staff table (linked to Supabase Auth)
CREATE TABLE public.staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  role staff_role NOT NULL DEFAULT 'reception',
  status staff_status NOT NULL DEFAULT 'active',
  created_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Patients table
CREATE TABLE public.patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  emirates_id TEXT,
  address TEXT,
  registration_signature_url TEXT,
  registration_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status patient_status NOT NULL DEFAULT 'active'
);

-- Treatments table
CREATE TABLE public.treatments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  treatment_name TEXT NOT NULL,
  category TEXT NOT NULL,
  dosage_unit dosage_unit NOT NULL DEFAULT 'Session',
  common_doses JSONB,
  administration_method TEXT,
  consent_template_id UUID,
  status treatment_status NOT NULL DEFAULT 'active',
  created_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Consent Templates table
CREATE TABLE public.consent_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_name TEXT NOT NULL,
  treatment_id UUID REFERENCES public.treatments(id) ON DELETE SET NULL,
  consent_text TEXT NOT NULL,
  version_number INTEGER NOT NULL DEFAULT 1,
  is_current_version BOOLEAN NOT NULL DEFAULT true,
  status consent_status NOT NULL DEFAULT 'active',
  created_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add foreign key from treatments to consent_templates
ALTER TABLE public.treatments 
ADD CONSTRAINT fk_consent_template 
FOREIGN KEY (consent_template_id) REFERENCES public.consent_templates(id) ON DELETE SET NULL;

-- Packages table
CREATE TABLE public.packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  treatment_id UUID NOT NULL REFERENCES public.treatments(id) ON DELETE CASCADE,
  sessions_purchased INTEGER NOT NULL,
  sessions_remaining INTEGER NOT NULL,
  purchase_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expiry_date TIMESTAMP WITH TIME ZONE,
  payment_status payment_status NOT NULL DEFAULT 'pending',
  status package_status NOT NULL DEFAULT 'active',
  created_by UUID REFERENCES public.staff(id) ON DELETE SET NULL
);

-- Visits table
CREATE TABLE public.visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  visit_number INTEGER NOT NULL,
  visit_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  current_status visit_status NOT NULL DEFAULT 'waiting',
  weight_kg DECIMAL(5,2),
  blood_pressure_systolic INTEGER,
  blood_pressure_diastolic INTEGER,
  heart_rate INTEGER,
  doctor_notes TEXT,
  consent_signed BOOLEAN NOT NULL DEFAULT false,
  vitals_completed BOOLEAN NOT NULL DEFAULT false,
  treatment_completed BOOLEAN NOT NULL DEFAULT false,
  is_locked BOOLEAN NOT NULL DEFAULT false,
  reception_staff_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  nurse_staff_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  doctor_staff_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  created_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_date TIMESTAMP WITH TIME ZONE
);

-- Visit Treatments table
CREATE TABLE public.visit_treatments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id UUID NOT NULL REFERENCES public.visits(id) ON DELETE CASCADE,
  treatment_id UUID NOT NULL REFERENCES public.treatments(id) ON DELETE CASCADE,
  package_id UUID NOT NULL REFERENCES public.packages(id) ON DELETE CASCADE,
  dose_administered TEXT NOT NULL,
  dose_unit TEXT NOT NULL,
  administration_details TEXT,
  sessions_deducted INTEGER NOT NULL DEFAULT 1,
  performed_by UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Consent Forms table
CREATE TABLE public.consent_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id UUID NOT NULL REFERENCES public.visits(id) ON DELETE CASCADE,
  treatment_id UUID NOT NULL REFERENCES public.treatments(id) ON DELETE CASCADE,
  consent_template_id UUID NOT NULL REFERENCES public.consent_templates(id) ON DELETE CASCADE,
  signature_url TEXT NOT NULL,
  signed_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  pdf_url TEXT
);

-- Vitals Config table
CREATE TABLE public.vitals_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vital_name TEXT NOT NULL,
  unit TEXT NOT NULL,
  input_type vital_input_type NOT NULL DEFAULT 'single',
  is_required BOOLEAN NOT NULL DEFAULT true,
  critical_alert_rule JSONB,
  warning_alert_rule JSONB,
  status vital_status NOT NULL DEFAULT 'active',
  display_order INTEGER NOT NULL DEFAULT 0
);

-- Enable RLS on all tables
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treatments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consent_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visit_treatments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consent_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vitals_config ENABLE ROW LEVEL SECURITY;

-- Security definer function to check staff role (avoids infinite recursion)
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS staff_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.staff WHERE user_id = _user_id AND status = 'active' LIMIT 1
$$;

-- Security definer function to check if user is staff
CREATE OR REPLACE FUNCTION public.is_active_staff(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff WHERE user_id = _user_id AND status = 'active'
  )
$$;

-- RLS Policies for Staff table
CREATE POLICY "Staff can view all staff" ON public.staff
  FOR SELECT TO authenticated
  USING (public.is_active_staff(auth.uid()));

CREATE POLICY "Admin can insert staff" ON public.staff
  FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Admin can update staff" ON public.staff
  FOR UPDATE TO authenticated
  USING (public.get_user_role(auth.uid()) = 'admin');

-- RLS Policies for Patients table (all active staff can access)
CREATE POLICY "Staff can view patients" ON public.patients
  FOR SELECT TO authenticated
  USING (public.is_active_staff(auth.uid()));

CREATE POLICY "Staff can insert patients" ON public.patients
  FOR INSERT TO authenticated
  WITH CHECK (public.is_active_staff(auth.uid()));

CREATE POLICY "Staff can update patients" ON public.patients
  FOR UPDATE TO authenticated
  USING (public.is_active_staff(auth.uid()));

-- RLS Policies for Treatments table
CREATE POLICY "Staff can view treatments" ON public.treatments
  FOR SELECT TO authenticated
  USING (public.is_active_staff(auth.uid()));

CREATE POLICY "Admin can insert treatments" ON public.treatments
  FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Admin can update treatments" ON public.treatments
  FOR UPDATE TO authenticated
  USING (public.get_user_role(auth.uid()) = 'admin');

-- RLS Policies for Consent Templates table
CREATE POLICY "Staff can view consent templates" ON public.consent_templates
  FOR SELECT TO authenticated
  USING (public.is_active_staff(auth.uid()));

CREATE POLICY "Admin can insert consent templates" ON public.consent_templates
  FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Admin can update consent templates" ON public.consent_templates
  FOR UPDATE TO authenticated
  USING (public.get_user_role(auth.uid()) = 'admin');

-- RLS Policies for Packages table
CREATE POLICY "Staff can view packages" ON public.packages
  FOR SELECT TO authenticated
  USING (public.is_active_staff(auth.uid()));

CREATE POLICY "Staff can insert packages" ON public.packages
  FOR INSERT TO authenticated
  WITH CHECK (public.is_active_staff(auth.uid()));

CREATE POLICY "Staff can update packages" ON public.packages
  FOR UPDATE TO authenticated
  USING (public.is_active_staff(auth.uid()));

-- RLS Policies for Visits table
CREATE POLICY "Staff can view visits" ON public.visits
  FOR SELECT TO authenticated
  USING (public.is_active_staff(auth.uid()));

CREATE POLICY "Staff can insert visits" ON public.visits
  FOR INSERT TO authenticated
  WITH CHECK (public.is_active_staff(auth.uid()));

CREATE POLICY "Staff can update visits" ON public.visits
  FOR UPDATE TO authenticated
  USING (public.is_active_staff(auth.uid()) AND NOT is_locked);

-- RLS Policies for Visit Treatments table
CREATE POLICY "Staff can view visit treatments" ON public.visit_treatments
  FOR SELECT TO authenticated
  USING (public.is_active_staff(auth.uid()));

CREATE POLICY "Doctor/Admin can insert visit treatments" ON public.visit_treatments
  FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role(auth.uid()) IN ('doctor', 'admin'));

-- RLS Policies for Consent Forms table
CREATE POLICY "Staff can view consent forms" ON public.consent_forms
  FOR SELECT TO authenticated
  USING (public.is_active_staff(auth.uid()));

CREATE POLICY "Staff can insert consent forms" ON public.consent_forms
  FOR INSERT TO authenticated
  WITH CHECK (public.is_active_staff(auth.uid()));

-- RLS Policies for Vitals Config table
CREATE POLICY "Staff can view vitals config" ON public.vitals_config
  FOR SELECT TO authenticated
  USING (public.is_active_staff(auth.uid()));

CREATE POLICY "Admin can manage vitals config" ON public.vitals_config
  FOR ALL TO authenticated
  USING (public.get_user_role(auth.uid()) = 'admin');

-- Create storage bucket for signatures and PDFs
INSERT INTO storage.buckets (id, name, public) 
VALUES ('clinic-documents', 'clinic-documents', true);

-- Storage policies for clinic-documents bucket
CREATE POLICY "Staff can view clinic documents" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'clinic-documents' AND public.is_active_staff(auth.uid()));

CREATE POLICY "Staff can upload clinic documents" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'clinic-documents' AND public.is_active_staff(auth.uid()));

CREATE POLICY "Staff can update clinic documents" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'clinic-documents' AND public.is_active_staff(auth.uid()));

-- Enable realtime for visits (waiting area updates)
ALTER PUBLICATION supabase_realtime ADD TABLE public.visits;