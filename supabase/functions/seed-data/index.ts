import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Staff accounts to create
    const staffAccounts = [
      { email: 'admin@cosmique.ae', password: 'Admin123!', full_name: 'Admin User', role: 'admin' },
      { email: 'reception@cosmique.ae', password: 'Reception123!', full_name: 'Ahmed Al-Mansoori', role: 'reception' },
      { email: 'nurse@cosmique.ae', password: 'Nurse123!', full_name: 'Sarah Ali', role: 'nurse' },
      { email: 'doctor@cosmique.ae', password: 'Doctor123!', full_name: 'Dr. Deepika', role: 'doctor' },
    ];

    const createdStaff = [];

    // Create auth users and staff records
    for (const account of staffAccounts) {
      // Check if user already exists
      const { data: existingStaff } = await supabase
        .from('staff')
        .select('id')
        .eq('email', account.email)
        .single();

      if (existingStaff) {
        console.log(`Staff ${account.email} already exists, skipping`);
        continue;
      }

      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: account.email,
        password: account.password,
        email_confirm: true,
      });

      if (authError) {
        console.error(`Error creating auth user ${account.email}:`, authError);
        continue;
      }

      // Create staff record
      const { data: staffData, error: staffError } = await supabase
        .from('staff')
        .insert({
          user_id: authData.user.id,
          email: account.email,
          full_name: account.full_name,
          role: account.role,
          status: 'active',
        })
        .select()
        .single();

      if (staffError) {
        console.error(`Error creating staff record ${account.email}:`, staffError);
        continue;
      }

      createdStaff.push({ email: account.email, role: account.role });
    }

    // Seed treatments
    const treatments = [
      {
        treatment_name: 'Mounjaro (Semaglutide)',
        category: 'Peptide Therapy',
        dosage_unit: 'mg',
        common_doses: ['2.5', '5', '7.5', '10'],
        administration_method: 'Subcutaneous injection',
        status: 'active',
      },
      {
        treatment_name: 'IV Drip - Vitamin C + Glutathione',
        category: 'IV Therapy',
        dosage_unit: 'ml',
        common_doses: ['250', '500'],
        administration_method: 'Intravenous infusion',
        status: 'active',
      },
      {
        treatment_name: 'EMS (Electromagnetic Muscle Stimulation)',
        category: 'Body Contouring',
        dosage_unit: 'Session',
        common_doses: null,
        administration_method: 'External device',
        status: 'active',
      },
      {
        treatment_name: 'Botox',
        category: 'Injectables',
        dosage_unit: 'Units',
        common_doses: ['20', '30', '50'],
        administration_method: 'Intramuscular injection',
        status: 'active',
      },
    ];

    // Check if treatments already exist
    const { data: existingTreatments } = await supabase
      .from('treatments')
      .select('id')
      .limit(1);

    let insertedTreatments = [];
    if (!existingTreatments || existingTreatments.length === 0) {
      const { data: treatmentData, error: treatmentError } = await supabase
        .from('treatments')
        .insert(treatments)
        .select();

      if (treatmentError) {
        console.error('Error inserting treatments:', treatmentError);
      } else {
        insertedTreatments = treatmentData || [];
      }
    } else {
      // Get existing treatments
      const { data } = await supabase.from('treatments').select();
      insertedTreatments = data || [];
    }

    // Seed consent templates for each treatment
    const consentTemplates = insertedTreatments.map((treatment) => ({
      form_name: `${treatment.treatment_name} Consent`,
      treatment_id: treatment.id,
      consent_text: `I, [PATIENT_NAME], consent to receive ${treatment.treatment_name} treatment administered by Cosmique Aesthetic & Dermatology Clinic on [DATE].

I understand the nature of this treatment and its intended purpose.

Potential risks and side effects have been explained to me, including but not limited to: discomfort, temporary reactions, and rare complications.

I have been informed of alternative treatments available and have had the opportunity to ask questions.

I understand that I can withdraw my consent at any time before the procedure begins.

By signing below, I confirm that I have read and understood this consent form and agree to proceed with the treatment.`,
      version_number: 1,
      is_current_version: true,
      status: 'active',
    }));

    // Check if consent templates already exist
    const { data: existingTemplates } = await supabase
      .from('consent_templates')
      .select('id')
      .limit(1);

    if (!existingTemplates || existingTemplates.length === 0) {
      const { error: consentError } = await supabase
        .from('consent_templates')
        .insert(consentTemplates);

      if (consentError) {
        console.error('Error inserting consent templates:', consentError);
      }
    }

    // Seed vitals config
    const vitalsConfig = [
      {
        vital_name: 'Weight',
        unit: 'kg',
        input_type: 'single',
        is_required: true,
        critical_alert_rule: null,
        warning_alert_rule: null,
        status: 'active',
        display_order: 1,
      },
      {
        vital_name: 'Blood Pressure',
        unit: 'mmHg',
        input_type: 'dual',
        is_required: true,
        critical_alert_rule: { condition: '>180/110', message: '⛔ CRITICAL: BP too high - cannot proceed with treatment' },
        warning_alert_rule: { condition: '>140/90', message: '⚠️ Elevated BP - doctor review needed before proceeding' },
        status: 'active',
        display_order: 2,
      },
      {
        vital_name: 'Heart Rate',
        unit: 'bpm',
        input_type: 'single',
        is_required: true,
        critical_alert_rule: { condition: '<50 OR >120', message: '⛔ CRITICAL: Abnormal heart rate detected' },
        warning_alert_rule: null,
        status: 'active',
        display_order: 3,
      },
    ];

    // Check if vitals config already exists
    const { data: existingVitals } = await supabase
      .from('vitals_config')
      .select('id')
      .limit(1);

    if (!existingVitals || existingVitals.length === 0) {
      const { error: vitalsError } = await supabase
        .from('vitals_config')
        .insert(vitalsConfig);

      if (vitalsError) {
        console.error('Error inserting vitals config:', vitalsError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Seed data created successfully',
        staffCreated: createdStaff,
        treatmentsCount: insertedTreatments.length,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in seed-data function:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
