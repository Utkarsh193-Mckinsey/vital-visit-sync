import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import SignatureCanvas from 'react-signature-canvas';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { TabletButton } from '@/components/ui/tablet-button';
import { TabletCard, TabletCardContent, TabletCardHeader, TabletCardTitle } from '@/components/ui/tablet-card';
import { PageContainer, PageHeader } from '@/components/layout/PageContainer';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, UserPlus, Eraser, Download, Check, CreditCard } from 'lucide-react';
import { generateRegistrationPDF, getRegistrationFileName } from '@/utils/generateRegistrationPDF';
import { generateEmiratesIdPDF, getEmiratesIdFileName } from '@/utils/generateEmiratesIdPDF';
import { downloadPDF, getFirstName } from '@/utils/pdfDownload';
import EmiratesIdCapture, { type ExtractedIdData } from '@/components/patient/EmiratesIdCapture';
import LanguageSelector from '@/components/patient/LanguageSelector';
import PatientInfoSection from '@/components/patient/registration/PatientInfoSection';
import EmergencyContactSection from '@/components/patient/registration/EmergencyContactSection';
import MedicalHistorySection from '@/components/patient/registration/MedicalHistorySection';

type RegistrationStep = 'language' | 'id_capture' | 'form';

export default function PatientRegistration() {
  const [step, setStep] = useState<RegistrationStep>('language');
  const [language, setLanguage] = useState<'en' | 'ar'>('en');
  const [frontIdImage, setFrontIdImage] = useState('');
  const [backIdImage, setBackIdImage] = useState('');
  const [formData, setFormData] = useState({
    full_name: '',
    phone_number: '',
    email: '',
    date_of_birth: '',
    emirates_id: '',
    nationality: '',
    gender: '',
    country_of_residence: 'United Arab Emirates',
    emirate: 'Dubai',
    emergency_contact_name: '',
    emergency_contact_number: '',
    emergency_contact_relationship: '',
    medical_heart_disease: false,
    medical_heart_disease_details: '',
    medical_blood_pressure: false,
    medical_blood_pressure_details: '',
    medical_allergy: false,
    medical_allergy_details: '',
    medical_diabetes: false,
    medical_diabetes_details: '',
    medical_other: false,
    medical_other_details: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registeredPatient, setRegisteredPatient] = useState<{ id: string; signatureDataUrl: string } | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const signatureRef = useRef<SignatureCanvas>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { staff } = useAuth();

  const handleLanguageSelect = (lang: 'en' | 'ar') => {
    setLanguage(lang);
    setStep('id_capture');
  };

  const handleIdDataExtracted = (data: ExtractedIdData, frontImg: string, backImg: string) => {
    setFrontIdImage(frontImg);
    setBackIdImage(backImg);
    setFormData(prev => ({
      ...prev,
      full_name: data.full_name || prev.full_name,
      date_of_birth: data.date_of_birth || prev.date_of_birth,
      emirates_id: data.emirates_id || prev.emirates_id,
      nationality: data.nationality || prev.nationality,
      gender: data.gender || prev.gender,
    }));
    setStep('form');
  };

  const handleSkipIdCapture = () => {
    setStep('form');
  };

  const handleChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleMedicalChange = (key: string, hasCondition: boolean) => {
    setFormData(prev => ({
      ...prev,
      [key]: hasCondition,
      [`${key}_details`]: hasCondition ? prev[`${key}_details` as keyof typeof prev] : '',
    }));
  };

  const handleMedicalDetailsChange = (key: string, details: string) => {
    setFormData(prev => ({ ...prev, [`${key}_details`]: details }));
  };

  const medicalConditions = [
    { key: 'medical_heart_disease', label: 'Heart Diseases', value: formData.medical_heart_disease, details: formData.medical_heart_disease_details },
    { key: 'medical_blood_pressure', label: 'Blood Pressure', value: formData.medical_blood_pressure, details: formData.medical_blood_pressure_details },
    { key: 'medical_allergy', label: 'Allergy', value: formData.medical_allergy, details: formData.medical_allergy_details },
    { key: 'medical_diabetes', label: 'Diabetes', value: formData.medical_diabetes, details: formData.medical_diabetes_details },
    { key: 'medical_other', label: 'Other (Please specify)', value: formData.medical_other, details: formData.medical_other_details },
  ];

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.full_name.trim()) newErrors.full_name = 'Full name is required';
    if (!formData.phone_number.trim()) newErrors.phone_number = 'Phone number is required';
    if (!formData.date_of_birth) newErrors.date_of_birth = 'Date of birth is required';
    if (!formData.nationality) newErrors.nationality = 'Nationality is required';
    if (!formData.gender) newErrors.gender = 'Gender is required';
    if (!formData.emergency_contact_name.trim()) newErrors.emergency_contact_name = 'Emergency contact name is required';
    if (!formData.emergency_contact_number.trim()) newErrors.emergency_contact_number = 'Emergency contact number is required';
    if (!formData.emergency_contact_relationship) newErrors.emergency_contact_relationship = 'Relationship is required';
    if (signatureRef.current?.isEmpty()) newErrors.signature = 'Signature is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const clearSignature = () => {
    signatureRef.current?.clear();
    if (errors.signature) setErrors(prev => ({ ...prev, signature: '' }));
  };

  const uploadSignature = async (): Promise<string | null> => {
    if (!signatureRef.current || signatureRef.current.isEmpty()) return null;
    const canvas = signatureRef.current.getCanvas();
    const dataUrl = canvas.toDataURL('image/png');
    const base64Data = dataUrl.split(',')[1];
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'image/png' });
    const fileName = `signatures/registration/${Date.now()}_${formData.phone_number.replace(/\D/g, '')}.png`;
    const { data, error } = await supabase.storage.from('clinic-documents').upload(fileName, blob, { contentType: 'image/png', upsert: false });
    if (error) { console.error('Signature upload error:', error); return null; }
    const { data: urlData } = supabase.storage.from('clinic-documents').getPublicUrl(data.path);
    return urlData.publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      toast({ title: 'Validation Error', description: 'Please fill in all required fields.', variant: 'destructive' });
      return;
    }
    setIsSubmitting(true);
    try {
      const { data: existingPatients, error: checkError } = await supabase
        .from('patients').select('id').eq('phone_number', formData.phone_number.trim());
      if (checkError) throw checkError;
      if (existingPatients && existingPatients.length > 0) {
        toast({ title: 'Patient Exists', description: 'A patient with this phone number already exists.', variant: 'destructive' });
        setIsSubmitting(false);
        return;
      }

      const canvas = signatureRef.current?.getCanvas();
      const signatureDataUrl = canvas?.toDataURL('image/png') || '';
      const signatureUrl = await uploadSignature();
      if (!signatureUrl) {
        toast({ title: 'Upload Error', description: 'Failed to upload signature. Please try again.', variant: 'destructive' });
        setIsSubmitting(false);
        return;
      }

      const { data: patient, error } = await supabase.from('patients').insert({
        full_name: formData.full_name.trim(),
        phone_number: formData.phone_number.trim(),
        email: formData.email.trim().toLowerCase() || null,
        date_of_birth: formData.date_of_birth,
        emirates_id: formData.emirates_id.trim() || null,
        nationality: formData.nationality || null,
        gender: formData.gender || null,
        country_of_residence: formData.country_of_residence,
        emirate: formData.emirate,
        emergency_contact_name: formData.emergency_contact_name.trim() || null,
        emergency_contact_number: formData.emergency_contact_number.trim() || null,
        emergency_contact_relationship: formData.emergency_contact_relationship || null,
        medical_heart_disease: formData.medical_heart_disease,
        medical_heart_disease_details: formData.medical_heart_disease_details.trim() || null,
        medical_blood_pressure: formData.medical_blood_pressure,
        medical_blood_pressure_details: formData.medical_blood_pressure_details.trim() || null,
        medical_allergy: formData.medical_allergy,
        medical_allergy_details: formData.medical_allergy_details.trim() || null,
        medical_diabetes: formData.medical_diabetes,
        medical_diabetes_details: formData.medical_diabetes_details.trim() || null,
        medical_other: formData.medical_other,
        medical_other_details: formData.medical_other_details.trim() || null,
        registration_signature_url: signatureUrl,
        language: language,
        status: 'active',
      } as any).select().single();

      if (error) throw error;

      toast({ title: 'Patient Registered', description: `${formData.full_name} has been successfully registered.` });
      setRegisteredPatient({ id: (patient as any).id, signatureDataUrl });

      if (frontIdImage) {
        try {
          const idPdfBlob = await generateEmiratesIdPDF({
            patientName: formData.full_name.trim(),
            patientPhone: formData.phone_number.trim(),
            emiratesId: formData.emirates_id.trim() || null,
            frontImage: frontIdImage,
            backImage: backIdImage || undefined,
          });
          const firstName = getFirstName(formData.full_name);
          const idFileName = getEmiratesIdFileName(firstName, formData.phone_number);
          downloadPDF(idPdfBlob, idFileName);
        } catch (err) {
          console.error('Error generating Emirates ID PDF:', err);
        }
      }
    } catch (error) {
      console.error('Registration error:', error);
      toast({ title: 'Registration Failed', description: 'An error occurred. Please try again.', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadRegistration = async () => {
    if (!registeredPatient) return;
    setIsDownloading(true);
    try {
      const pdfBlob = await generateRegistrationPDF({
        patientName: formData.full_name.trim(),
        patientDOB: formData.date_of_birth,
        patientPhone: formData.phone_number.trim(),
        patientEmail: formData.email.trim(),
        emiratesId: formData.emirates_id.trim() || null,
        nationality: formData.nationality || null,
        gender: formData.gender || null,
        countryOfResidence: formData.country_of_residence || null,
        emirate: formData.emirate || null,
        emergencyContactName: formData.emergency_contact_name.trim() || null,
        emergencyContactNumber: formData.emergency_contact_number.trim() || null,
        emergencyContactRelationship: formData.emergency_contact_relationship || null,
        medicalHistory: [
          { label: 'Heart Diseases', value: formData.medical_heart_disease, details: formData.medical_heart_disease_details },
          { label: 'Blood Pressure', value: formData.medical_blood_pressure, details: formData.medical_blood_pressure_details },
          { label: 'Allergy', value: formData.medical_allergy, details: formData.medical_allergy_details },
          { label: 'Diabetes', value: formData.medical_diabetes, details: formData.medical_diabetes_details },
          { label: 'Other', value: formData.medical_other, details: formData.medical_other_details },
        ],
        signatureDataUrl: registeredPatient.signatureDataUrl,
        registrationDate: new Date(),
      });
      const firstName = getFirstName(formData.full_name);
      const fileName = getRegistrationFileName(firstName, formData.phone_number);
      downloadPDF(pdfBlob, fileName);
      toast({ title: 'Download Started', description: 'Registration form PDF is downloading.' });
    } catch (error) {
      console.error('Error generating registration PDF:', error);
      toast({ title: 'Download Failed', description: 'Failed to generate PDF. Please try again.', variant: 'destructive' });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleContinueToPatient = () => {
    if (registeredPatient) {
      navigate(`/patient/${registeredPatient.id}/review`);
    }
  };

  // Success screen
  if (registeredPatient) {
    return (
      <PageContainer maxWidth="md">
        <div className="flex flex-col items-center justify-center py-12">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
            <Check className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-center mb-2">Registration Complete!</h1>
          <p className="text-muted-foreground text-center mb-8">
            {formData.full_name} has been successfully registered.
          </p>
          <div className="w-full max-w-sm space-y-4">
            <TabletButton fullWidth variant="outline" onClick={handleDownloadRegistration} disabled={isDownloading} leftIcon={<Download />}>
              {isDownloading ? 'Generating PDF...' : 'Download Registration Form'}
            </TabletButton>
            <TabletButton fullWidth onClick={handleContinueToPatient}>
              Continue to Doctor Review
            </TabletButton>
          </div>
        </div>
      </PageContainer>
    );
  }

  // Step 1: Language selection
  if (step === 'language') {
    return (
      <PageContainer maxWidth="md">
        <PageHeader
          title="New Patient Registration"
          backButton={
            <TabletButton variant="ghost" size="icon" onClick={() => navigate('/patients')} aria-label="Back to search">
              <ArrowLeft className="h-5 w-5" />
            </TabletButton>
          }
        />
        <LanguageSelector onSelect={handleLanguageSelect} />
      </PageContainer>
    );
  }

  // Step 2: Emirates ID capture
  if (step === 'id_capture') {
    return (
      <PageContainer maxWidth="md">
        <PageHeader
          title="New Patient Registration"
          backButton={
            <TabletButton variant="ghost" size="icon" onClick={() => setStep('language')} aria-label="Back to language">
              <ArrowLeft className="h-5 w-5" />
            </TabletButton>
          }
        />
        <EmiratesIdCapture onDataExtracted={handleIdDataExtracted} onSkip={handleSkipIdCapture} />
      </PageContainer>
    );
  }

  // Step 3: Full registration form
  return (
    <PageContainer maxWidth="md">
      <PageHeader
        title="New Patient Registration"
        backButton={
          <TabletButton variant="ghost" size="icon" onClick={() => setStep('id_capture')} aria-label="Back">
            <ArrowLeft className="h-5 w-5" />
          </TabletButton>
        }
      />

      <form onSubmit={handleSubmit}>
        <PatientInfoSection formData={formData} errors={errors} onChange={(f, v) => handleChange(f, v)} />

        {/* Emirates ID Photos */}
        {(frontIdImage || backIdImage) && (
          <TabletCard className="mb-6">
            <TabletCardHeader>
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                <TabletCardTitle>Emirates ID Photos</TabletCardTitle>
              </div>
            </TabletCardHeader>
            <TabletCardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {frontIdImage && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-2">Front Side</p>
                    <div className="rounded-xl overflow-hidden border">
                      <img src={frontIdImage} alt="Emirates ID Front" className="w-full h-auto object-cover" />
                    </div>
                  </div>
                )}
                {backIdImage && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-2">Back Side</p>
                    <div className="rounded-xl overflow-hidden border">
                      <img src={backIdImage} alt="Emirates ID Back" className="w-full h-auto object-cover" />
                    </div>
                  </div>
                )}
              </div>
            </TabletCardContent>
          </TabletCard>
        )}

        <EmergencyContactSection
          formData={formData}
          errors={errors}
          onChange={(f, v) => handleChange(f, v)}
        />

        <MedicalHistorySection
          conditions={medicalConditions}
          onChange={handleMedicalChange}
          onDetailsChange={handleMedicalDetailsChange}
        />

        {/* Patient Signature */}
        <TabletCard className="mb-6">
          <TabletCardHeader>
            <div className="flex items-center justify-between">
              <TabletCardTitle>Patient Signature *</TabletCardTitle>
              <TabletButton type="button" variant="ghost" size="sm" onClick={clearSignature} leftIcon={<Eraser className="h-4 w-4" />}>
                Clear
              </TabletButton>
            </div>
          </TabletCardHeader>
          <TabletCardContent>
            <div className={`signature-pad ${errors.signature ? 'border-destructive' : ''}`}>
              <SignatureCanvas
                ref={signatureRef}
                canvasProps={{ className: 'w-full h-[150px] rounded-xl', style: { width: '100%', height: '150px' } }}
                backgroundColor="white"
                penColor="black"
              />
            </div>
            {errors.signature && <p className="mt-2 text-sm text-destructive">{errors.signature}</p>}
            <p className="mt-2 text-sm text-muted-foreground">Please sign above to confirm registration</p>
          </TabletCardContent>
        </TabletCard>

        <TabletButton type="submit" fullWidth isLoading={isSubmitting} leftIcon={<UserPlus />}>
          Register Patient
        </TabletButton>
      </form>
    </PageContainer>
  );
}
