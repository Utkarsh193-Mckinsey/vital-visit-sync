import { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import SignatureCanvas from 'react-signature-canvas';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { TabletButton } from '@/components/ui/tablet-button';
import { TabletCard, TabletCardContent, TabletCardHeader, TabletCardTitle } from '@/components/ui/tablet-card';
import { PageContainer, PageHeader } from '@/components/layout/PageContainer';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Eraser, CheckCircle, Loader2, User, Phone, HeartPulse, AlertCircle, Download, Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { WhatsAppLink } from '@/components/ui/whatsapp-link';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { generateRegistrationPDF, getRegistrationFileName } from '@/utils/generateRegistrationPDF';
import { downloadPDF, getFirstName } from '@/utils/pdfDownload';

export default function PatientReview() {
  const { patientId } = useParams<{ patientId: string }>();
  const [patient, setPatient] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [approved, setApproved] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [doctorSignatureDataUrl, setDoctorSignatureDataUrl] = useState('');
  const [signatureError, setSignatureError] = useState('');
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [doctors, setDoctors] = useState<{ id: string; full_name: string }[]>([]);
  const signatureRef = useRef<SignatureCanvas>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { staff } = useAuth();

  useEffect(() => {
    const fetchPatient = async () => {
      if (!patientId) return;
      const { data, error } = await supabase.from('patients').select('*').eq('id', patientId).single();
      if (error) {
        console.error('Error fetching patient:', error);
        toast({ title: 'Error', description: 'Could not load patient data.', variant: 'destructive' });
        navigate('/patients');
        return;
      }
      setPatient(data);
      setLoading(false);
    };
    const fetchDoctors = async () => {
      const { data } = await supabase
        .from('staff')
        .select('id, full_name')
        .eq('status', 'active')
        .eq('role', 'doctor')
        .order('full_name');
      if (data) setDoctors(data);
    };
    fetchPatient();
    fetchDoctors();
  }, [patientId]);

  const clearSignature = () => {
    signatureRef.current?.clear();
    setSignatureError('');
  };

  const handleApprove = async () => {
    if (!selectedDoctorId) {
      toast({ title: 'Select Doctor', description: 'Please select which doctor is reviewing.', variant: 'destructive' });
      return;
    }
    if (signatureRef.current?.isEmpty()) {
      setSignatureError('Doctor signature is required');
      return;
    }
    setIsSubmitting(true);
    try {
      // Upload doctor signature
      const canvas = signatureRef.current!.getCanvas();
      const dataUrl = canvas.toDataURL('image/png');
      setDoctorSignatureDataUrl(dataUrl);
      const base64Data = dataUrl.split(',')[1];
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'image/png' });
      const fileName = `signatures/doctor-review/${Date.now()}_${patientId}.png`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('clinic-documents')
        .upload(fileName, blob, { contentType: 'image/png', upsert: false });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('clinic-documents').getPublicUrl(uploadData.path);

      // Update patient record
      const { error: updateError } = await supabase.from('patients').update({
        doctor_signature_url: urlData.publicUrl,
        doctor_reviewed: true,
        doctor_reviewed_by: selectedDoctorId,
        doctor_reviewed_date: new Date().toISOString(),
        consultation_status: 'awaiting_consultation',
      } as any).eq('id', patientId!);

      if (updateError) throw updateError;

      toast({ title: 'Patient Approved', description: 'Registration has been reviewed and approved.' });
      setApproved(true);

      // Auto-download registration PDF
      try {
        const pdfBlob = await generateRegistrationPDF({
          patientName: patient.full_name,
          patientDOB: patient.date_of_birth,
          patientPhone: patient.phone_number,
          patientEmail: patient.email || '',
          emiratesId: patient.emirates_id || null,
          nationality: patient.nationality || null,
          gender: patient.gender || null,
          countryOfResidence: patient.country_of_residence || null,
          emirate: patient.emirate || null,
          emergencyContactName: patient.emergency_contact_name || null,
          emergencyContactNumber: patient.emergency_contact_number || null,
          emergencyContactRelationship: patient.emergency_contact_relationship || null,
          medicalHistory: [
            { label: 'Heart Diseases', value: patient.medical_heart_disease, details: patient.medical_heart_disease_details },
            { label: 'Blood Pressure', value: patient.medical_blood_pressure, details: patient.medical_blood_pressure_details },
            { label: 'Allergy', value: patient.medical_allergy, details: patient.medical_allergy_details },
            { label: 'Diabetes', value: patient.medical_diabetes, details: patient.medical_diabetes_details },
            { label: 'Other', value: patient.medical_other, details: patient.medical_other_details },
          ],
          signatureDataUrl: patient.registration_signature_url || '',
          doctorSignatureDataUrl: dataUrl,
          registrationDate: new Date(patient.registration_date),
        });
        const firstName = getFirstName(patient.full_name);
        const fileName = getRegistrationFileName(firstName, patient.phone_number);
        downloadPDF(pdfBlob, fileName);
      } catch (pdfErr) {
        console.error('Auto-download registration PDF error:', pdfErr);
      }
    } catch (error) {
      console.error('Error approving patient:', error);
      toast({ title: 'Error', description: 'Failed to save approval. Please try again.', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadRegistration = async () => {
    if (!patient) return;
    setIsDownloading(true);
    try {
      const pdfBlob = await generateRegistrationPDF({
        patientName: patient.full_name,
        patientDOB: patient.date_of_birth,
        patientPhone: patient.phone_number,
        patientEmail: patient.email || '',
        emiratesId: patient.emirates_id || null,
        nationality: patient.nationality || null,
        gender: patient.gender || null,
        countryOfResidence: patient.country_of_residence || null,
        emirate: patient.emirate || null,
        emergencyContactName: patient.emergency_contact_name || null,
        emergencyContactNumber: patient.emergency_contact_number || null,
        emergencyContactRelationship: patient.emergency_contact_relationship || null,
        medicalHistory: [
          { label: 'Heart Diseases', value: patient.medical_heart_disease, details: patient.medical_heart_disease_details },
          { label: 'Blood Pressure', value: patient.medical_blood_pressure, details: patient.medical_blood_pressure_details },
          { label: 'Allergy', value: patient.medical_allergy, details: patient.medical_allergy_details },
          { label: 'Diabetes', value: patient.medical_diabetes, details: patient.medical_diabetes_details },
          { label: 'Other', value: patient.medical_other, details: patient.medical_other_details },
        ],
        signatureDataUrl: patient.registration_signature_url || '',
        doctorSignatureDataUrl: doctorSignatureDataUrl || patient.doctor_signature_url || '',
        registrationDate: new Date(patient.registration_date),
      });
      const firstName = getFirstName(patient.full_name);
      const fileName = getRegistrationFileName(firstName, patient.phone_number);
      downloadPDF(pdfBlob, fileName);
      toast({ title: 'Download Started', description: 'Registration form PDF is downloading.' });
    } catch (error) {
      console.error('Error generating registration PDF:', error);
      toast({ title: 'Download Failed', description: 'Failed to generate PDF.', variant: 'destructive' });
    } finally {
      setIsDownloading(false);
    }
  };

  if (loading) {
    return (
      <PageContainer maxWidth="md">
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </PageContainer>
    );
  }

  if (!patient) return null;

  // Show approval success screen
  if (approved) {
    return (
      <PageContainer maxWidth="md">
        <div className="flex flex-col items-center justify-center py-12">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
            <Check className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-center mb-2">Registration Approved!</h1>
          <p className="text-muted-foreground text-center mb-8">
            {patient.full_name}'s registration has been reviewed and approved.
          </p>
          <div className="w-full max-w-sm space-y-4">
            <TabletButton fullWidth variant="outline" onClick={handleDownloadRegistration} disabled={isDownloading} leftIcon={<Download />}>
              {isDownloading ? 'Generating PDF...' : 'Download Registration Form'}
            </TabletButton>
            <TabletButton fullWidth onClick={() => navigate('/new-patients')}>
              Back to New Patients
            </TabletButton>
          </div>
        </div>
      </PageContainer>
    );
  }

  const medicalItems = [
    { label: 'Heart Diseases', value: patient.medical_heart_disease, details: patient.medical_heart_disease_details },
    { label: 'Blood Pressure', value: patient.medical_blood_pressure, details: patient.medical_blood_pressure_details },
    { label: 'Allergy', value: patient.medical_allergy, details: patient.medical_allergy_details },
    { label: 'Diabetes', value: patient.medical_diabetes, details: patient.medical_diabetes_details },
    { label: 'Other', value: patient.medical_other, details: patient.medical_other_details },
  ];

  const hasMedicalConditions = medicalItems.some(m => m.value);

  return (
    <PageContainer maxWidth="md">
      <PageHeader
        title="New Patient Review"
        backButton={
          <TabletButton variant="ghost" size="icon" onClick={() => navigate('/patients')} aria-label="Back">
            <ArrowLeft className="h-5 w-5" />
          </TabletButton>
        }
      />

      {/* Patient Info */}
      <TabletCard className="mb-6">
        <TabletCardHeader>
          <div className="flex items-center gap-2">
            <User className="h-5 w-5" />
            <TabletCardTitle>Patient Information</TabletCardTitle>
          </div>
        </TabletCardHeader>
        <TabletCardContent>
          <div className="grid gap-3 text-sm">
            <InfoRow label="Full Name" value={patient.full_name} />
            <InfoRow label="Date of Birth" value={patient.date_of_birth ? new Date(patient.date_of_birth).toLocaleDateString('en-AE', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'} />
            <div className="flex justify-between items-start">
              <span className="text-muted-foreground">Mobile</span>
              <span className="text-right font-medium flex items-center gap-2">{patient.phone_number} <WhatsAppLink phone={patient.phone_number} /></span>
            </div>
            <InfoRow label="Nationality" value={patient.nationality || '—'} />
            <InfoRow label="Gender" value={patient.gender || '—'} />
            <InfoRow label="Country" value={patient.country_of_residence || '—'} />
            <InfoRow label="Emirate" value={patient.emirate || '—'} />
            <InfoRow label="Emirates ID" value={patient.emirates_id || '—'} />
          </div>
        </TabletCardContent>
      </TabletCard>

      {/* Emergency Contact */}
      <TabletCard className="mb-6">
        <TabletCardHeader>
          <div className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            <TabletCardTitle>Emergency Contact</TabletCardTitle>
          </div>
        </TabletCardHeader>
        <TabletCardContent>
          <div className="grid gap-3 text-sm">
            <InfoRow label="Name" value={patient.emergency_contact_name || '—'} />
            <InfoRow label="Number" value={patient.emergency_contact_number || '—'} />
            <InfoRow label="Relationship" value={patient.emergency_contact_relationship || '—'} />
          </div>
        </TabletCardContent>
      </TabletCard>

      {/* Medical History */}
      <TabletCard className="mb-6">
        <TabletCardHeader>
          <div className="flex items-center gap-2">
            <HeartPulse className="h-5 w-5" />
            <TabletCardTitle>Medical History</TabletCardTitle>
          </div>
        </TabletCardHeader>
        <TabletCardContent>
          {!hasMedicalConditions ? (
            <p className="text-sm text-muted-foreground">No medical conditions declared.</p>
          ) : (
            <div className="space-y-3">
              {medicalItems.filter(m => m.value).map((item) => (
                <div key={item.label} className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-warning" />
                    <span className="text-sm font-medium">{item.label}</span>
                    <Badge variant="outline" className="text-xs">Yes</Badge>
                  </div>
                  {item.details && (
                    <p className="text-sm text-muted-foreground ml-6">{item.details}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabletCardContent>
      </TabletCard>

      {/* Patient Signature (read-only) */}
      {patient.registration_signature_url && (
        <TabletCard className="mb-6">
          <TabletCardHeader>
            <TabletCardTitle>Patient Signature</TabletCardTitle>
          </TabletCardHeader>
          <TabletCardContent>
            <div className="bg-white rounded-xl border p-2 inline-block">
              <img src={patient.registration_signature_url} alt="Patient Signature" className="h-20 object-contain" />
            </div>
          </TabletCardContent>
        </TabletCard>
      )}

      {/* Doctor Selection & Signature */}
      {!patient.doctor_reviewed ? (
        <>
          <TabletCard className="mb-6">
            <TabletCardHeader>
              <TabletCardTitle>Reviewing Doctor *</TabletCardTitle>
            </TabletCardHeader>
            <TabletCardContent>
              <Select value={selectedDoctorId} onValueChange={setSelectedDoctorId}>
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Select your name" />
                </SelectTrigger>
                <SelectContent>
                  {doctors.map(d => (
                    <SelectItem key={d.id} value={d.id} className="py-3">
                      {d.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </TabletCardContent>
          </TabletCard>

          <TabletCard className="mb-6">
            <TabletCardHeader>
              <div className="flex items-center justify-between">
                <TabletCardTitle>Doctor Signature *</TabletCardTitle>
                <TabletButton type="button" variant="ghost" size="sm" onClick={clearSignature} leftIcon={<Eraser className="h-4 w-4" />}>
                  Clear
                </TabletButton>
              </div>
            </TabletCardHeader>
            <TabletCardContent>
              <div className={`signature-pad ${signatureError ? 'border-destructive' : ''}`}>
                <SignatureCanvas
                  ref={signatureRef}
                  canvasProps={{ className: 'w-full h-[150px] rounded-xl', style: { width: '100%', height: '150px' } }}
                  backgroundColor="white"
                  penColor="black"
                />
              </div>
              {signatureError && <p className="mt-2 text-sm text-destructive">{signatureError}</p>}
            </TabletCardContent>
          </TabletCard>

          <TabletButton fullWidth isLoading={isSubmitting} onClick={handleApprove} leftIcon={<CheckCircle />}>
            Approve & Complete Review
          </TabletButton>
        </>
      ) : (
        <TabletCard className="mb-6">
          <TabletCardHeader>
            <TabletCardTitle>Doctor Approval</TabletCardTitle>
          </TabletCardHeader>
          <TabletCardContent>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle className="h-5 w-5 text-primary" />
              <span>Reviewed and approved</span>
            </div>
            {patient.doctor_signature_url && (
              <div className="mt-3 bg-white rounded-xl border p-2 inline-block">
                <img src={patient.doctor_signature_url} alt="Doctor Signature" className="h-20 object-contain" />
              </div>
            )}
          </TabletCardContent>
        </TabletCard>
      )}
    </PageContainer>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right max-w-[60%]">{value}</span>
    </div>
  );
}
