// Application-level types for the clinic management system

export type StaffRole = 'admin' | 'reception' | 'nurse' | 'doctor';
export type StaffStatus = 'active' | 'inactive';
export type PatientStatus = 'active' | 'inactive';
export type TreatmentStatus = 'active' | 'inactive';
export type DosageUnit = 'mg' | 'ml' | 'Units' | 'mcg' | 'Session';
export type ConsentStatus = 'active' | 'inactive';
export type PaymentStatus = 'paid' | 'pending';
export type PackageStatus = 'active' | 'depleted' | 'expired';
export type VisitStatus = 'waiting' | 'in_progress' | 'completed';
export type VitalInputType = 'single' | 'dual';
export type VitalStatus = 'active' | 'inactive';

export interface Staff {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  role: StaffRole;
  status: StaffStatus;
  created_date: string;
}

export interface Patient {
  id: string;
  phone_number: string;
  full_name: string;
  email: string;
  date_of_birth: string;
  emirates_id?: string;
  address?: string;
  registration_signature_url?: string;
  registration_date: string;
  status: PatientStatus;
  file_number?: string;
}

export interface Treatment {
  id: string;
  treatment_name: string;
  category: string;
  dosage_unit: DosageUnit;
  common_doses?: string[];
  default_dose?: string;
  administration_method?: string;
  consent_template_id?: string;
  status: TreatmentStatus;
  created_date: string;
}

export interface ConsentTemplate {
  id: string;
  form_name: string;
  treatment_id?: string;
  consent_text: string;
  consent_text_ar?: string;
  version_number: number;
  is_current_version: boolean;
  status: ConsentStatus;
  created_date: string;
  last_updated: string;
}

export interface Package {
  id: string;
  patient_id: string;
  treatment_id: string;
  sessions_purchased: number;
  sessions_remaining: number;
  purchase_date: string;
  expiry_date?: string;
  payment_status: PaymentStatus;
  status: PackageStatus;
  created_by?: string;
  total_amount?: number;
  amount_paid: number;
  next_payment_date?: string;
  next_payment_amount?: number;
  consulting_doctor_id?: string;
  package_notes?: string;
  is_patient_initiated?: boolean;
  // Joined data
  treatment?: Treatment;
}

export interface Visit {
  id: string;
  patient_id: string;
  visit_number: number;
  visit_date: string;
  current_status: VisitStatus;
  weight_kg?: number;
  blood_pressure_systolic?: number;
  blood_pressure_diastolic?: number;
  heart_rate?: number;
  temperature?: number;
  height_cm?: number;
  respiratory_rate?: number;
  spo2?: number;
  hip_cm?: number;
  waist_cm?: number;
  head_circumference_cm?: number;
  sugar?: number;
  urinalysis?: string;
  other_details?: string;
  lmp?: string;
  doctor_notes?: string;
  consent_signed: boolean;
  vitals_completed: boolean;
  treatment_completed: boolean;
  is_locked: boolean;
  reception_staff_id?: string;
  nurse_staff_id?: string;
  doctor_staff_id?: string;
  created_date: string;
  completed_date?: string;
  // Joined data
  patient?: Patient;
  consent_forms?: ConsentForm[];
}

export interface VisitTreatment {
  id: string;
  visit_id: string;
  treatment_id: string;
  package_id: string;
  dose_administered: string;
  dose_unit: string;
  administration_details?: string;
  sessions_deducted: number;
  performed_by?: string;
  timestamp: string;
  // Joined data
  treatment?: Treatment;
}

export interface ConsentForm {
  id: string;
  visit_id: string;
  treatment_id: string;
  consent_template_id: string;
  signature_url: string;
  signed_date: string;
  pdf_url?: string;
  language?: string;
  // Joined data
  treatment?: Treatment;
  consent_template?: ConsentTemplate;
}

export interface VitalsConfig {
  id: string;
  vital_name: string;
  unit: string;
  input_type: VitalInputType;
  is_required: boolean;
  critical_alert_rule?: AlertRule;
  warning_alert_rule?: AlertRule;
  status: VitalStatus;
  display_order: number;
}

export interface AlertRule {
  condition: string;
  message: string;
}

 export interface StockItem {
   id: string;
   item_name: string;
   category: string;
   unit: string;
   brand?: string;
   current_stock?: number;
   packaging_unit?: string;
   units_per_package?: number;
   variant?: string;
   status: string;
   created_date: string;
 }
 
 export interface VisitConsumable {
   id: string;
   visit_id: string;
   stock_item_id: string;
   quantity_used: number;
   notes?: string;
   recorded_by?: string;
   created_date: string;
   // Joined data
  stock_item?: StockItem;
}

export interface TreatmentConsumable {
  id: string;
  treatment_id: string;
  stock_item_id: string;
  default_quantity: number;
  notes?: string;
  created_date: string;
  // Joined data
  stock_item?: StockItem;
}
 
// Auth context types
export interface AuthState {
  user: { id: string; email: string } | null;
  staff: Staff | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}
