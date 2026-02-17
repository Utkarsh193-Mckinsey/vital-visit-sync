import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import SignatureCanvas from 'react-signature-canvas';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { TabletButton } from '@/components/ui/tablet-button';
import { TabletCard, TabletCardContent, TabletCardHeader, TabletCardTitle } from '@/components/ui/tablet-card';
import { TabletInput } from '@/components/ui/tablet-input';
import { PageContainer, PageHeader } from '@/components/layout/PageContainer';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Check, Eraser, Plus, Trash2, Gift, Package as PackageIcon, CreditCard } from 'lucide-react';
import EmiratesIdCapture, { ExtractedIdData } from '@/components/patient/EmiratesIdCapture';
import { generateEmiratesIdPDF, getEmiratesIdFileName } from '@/utils/generateEmiratesIdPDF';
import { downloadPDF } from '@/utils/pdfDownload';
import PatientInfoSection from '@/components/patient/registration/PatientInfoSection';
import EmergencyContactSection from '@/components/patient/registration/EmergencyContactSection';
import MedicalHistorySection from '@/components/patient/registration/MedicalHistorySection';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Treatment } from '@/types/database';

const PAYMENT_METHODS = ['Cash', 'Card', 'Tabby', 'Tamara', 'Toothpick'] as const;
const SESSION_OPTIONS = Array.from({ length: 20 }, (_, i) => i + 1);

interface TreatmentLine {
  treatmentId: string;
  sessions: number;
  sessionsUsed: number;
}

interface ComplementaryLine {
  treatmentId: string;
  sessions: number;
  sessionsUsed: number;
}

interface PaymentSplit {
  method: string;
  amount: number;
}

export default function AddExistingPatient() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { staff } = useAuth();
  const signatureRef = useRef<SignatureCanvas>(null);

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
    file_number: '',
  });

  const [showIdScan, setShowIdScan] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [treatments, setTreatments] = useState<Treatment[]>([]);

  // Package fields
  const [treatmentLines, setTreatmentLines] = useState<TreatmentLine[]>([]);
  const [compLines, setCompLines] = useState<ComplementaryLine[]>([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'pending'>('paid');
  const [paymentSplits, setPaymentSplits] = useState<PaymentSplit[]>([
    { method: 'Cash', amount: 0 },
  ]);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [nextPaymentDate, setNextPaymentDate] = useState('');
  const [nextPaymentAmount, setNextPaymentAmount] = useState(0);

  useEffect(() => {
    const fetchTreatments = async () => {
      const { data } = await supabase
        .from('treatments')
        .select('*')
        .eq('status', 'active')
        .order('treatment_name');
      if (data) setTreatments(data as Treatment[]);
    };
    fetchTreatments();
  }, []);

  const handleChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
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

  // Treatment lines
  const addTreatmentLine = () => setTreatmentLines(prev => [...prev, { treatmentId: '', sessions: 4, sessionsUsed: 0 }]);
  const removeTreatmentLine = (i: number) => setTreatmentLines(prev => prev.filter((_, idx) => idx !== i));
  const updateLine = (i: number, field: keyof TreatmentLine, val: string | number) => {
    setTreatmentLines(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: val } : l));
  };

  // Comp lines
  const addCompLine = () => setCompLines(prev => [...prev, { treatmentId: '', sessions: 1, sessionsUsed: 0 }]);
  const removeCompLine = (i: number) => setCompLines(prev => prev.filter((_, idx) => idx !== i));
  const updateCompLine = (i: number, field: keyof ComplementaryLine, val: string | number) => {
    setCompLines(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: val } : l));
  };

  // Payment
  const totalPaid = paymentSplits.reduce((sum, s) => sum + (s.amount || 0), 0);
  const remaining = totalAmount - totalPaid;
  const addPaymentSplit = () => setPaymentSplits(prev => [...prev, { method: 'Card', amount: 0 }]);
  const removePaymentSplit = (i: number) => { if (paymentSplits.length > 1) setPaymentSplits(prev => prev.filter((_, idx) => idx !== i)); };
  const updateSplit = (i: number, field: keyof PaymentSplit, val: string | number) => {
    setPaymentSplits(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: val } : s));
  };

  const handleIdDataExtracted = (data: ExtractedIdData, frontImage: string, backImage: string) => {
    setShowIdScan(false);
    if (data.full_name) handleChange('full_name', data.full_name);
    if (data.date_of_birth) handleChange('date_of_birth', data.date_of_birth);
    if (data.emirates_id) handleChange('emirates_id', data.emirates_id);
    if (data.nationality) handleChange('nationality', data.nationality);
    if (data.gender) handleChange('gender', data.gender);

    // Auto-download ID PDF
    try {
      const name = data.full_name || formData.full_name || 'Patient';
      const phone = formData.phone_number || 'unknown';
      generateEmiratesIdPDF({ patientName: name, patientPhone: phone, emiratesId: data.emirates_id, frontImage, backImage }).then(blob => {
        downloadPDF(blob, getEmiratesIdFileName(name, phone));
      });
    } catch (err) {
      console.error('ID PDF download error:', err);
    }

    toast({ title: 'ID Scanned', description: 'Details have been filled from Emirates ID.' });
  };

  const clearSignature = () => signatureRef.current?.clear();

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.full_name.trim()) newErrors.full_name = 'Full name is required';
    if (!formData.phone_number.trim()) newErrors.phone_number = 'Phone number is required';
    if (!formData.date_of_birth) newErrors.date_of_birth = 'Date of birth is required';
    if (!formData.nationality) newErrors.nationality = 'Nationality is required';
    if (!formData.gender) newErrors.gender = 'Gender is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
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
    if (error) return null;
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
      // Check duplicate
      const { data: existingPatients } = await supabase
        .from('patients').select('id').eq('phone_number', formData.phone_number.trim());
      if (existingPatients && existingPatients.length > 0) {
        toast({ title: 'Patient Exists', description: 'A patient with this phone number already exists.', variant: 'destructive' });
        setIsSubmitting(false);
        return;
      }

      let signatureUrl: string | null = null;
      if (signatureRef.current && !signatureRef.current.isEmpty()) {
        signatureUrl = await uploadSignature();
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
        file_number: formData.file_number.trim() || null,
        language: 'en',
        status: 'active',
      } as any).select().single();

      if (error) throw error;

      const patientId = (patient as any).id;

      // Create packages if any treatment lines
      const validLines = treatmentLines.filter(l => l.treatmentId && l.sessions > 0);
      if (validLines.length > 0 && totalAmount > 0) {
        const effectiveStatus = totalPaid >= totalAmount ? 'paid' : 'pending';
        const allPackageIds: string[] = [];

        for (const line of validLines) {
          const sessionsRemaining = Math.max(0, line.sessions - line.sessionsUsed);
          const status = sessionsRemaining <= 0 ? 'depleted' : 'active';
          
          const { data: pkg, error: pkgErr } = await supabase
            .from('packages')
            .insert({
              patient_id: patientId,
              treatment_id: line.treatmentId,
              sessions_purchased: line.sessions,
              sessions_remaining: sessionsRemaining,
              payment_status: effectiveStatus,
              status,
              created_by: staff?.id,
              total_amount: totalAmount,
              amount_paid: totalPaid,
              next_payment_date: paymentStatus === 'pending' && nextPaymentDate ? nextPaymentDate : null,
              next_payment_amount: paymentStatus === 'pending' && nextPaymentAmount > 0 ? nextPaymentAmount : null,
            })
            .select('id')
            .single();
          if (pkgErr) throw pkgErr;
          allPackageIds.push(pkg.id);
        }

        // Comp lines
        const validCompLines = compLines.filter(l => l.treatmentId && l.sessions > 0);
        for (const line of validCompLines) {
          const sessionsRemaining = Math.max(0, line.sessions - line.sessionsUsed);
          const status = sessionsRemaining <= 0 ? 'depleted' : 'active';
          
          await supabase.from('packages').insert({
            patient_id: patientId,
            treatment_id: line.treatmentId,
            sessions_purchased: line.sessions,
            sessions_remaining: sessionsRemaining,
            payment_status: 'paid',
            status,
            created_by: staff?.id,
            total_amount: 0,
            amount_paid: 0,
          });
        }

        // Payment splits
        if (allPackageIds.length > 0) {
          const validSplits = paymentSplits.filter(s => s.amount > 0);
          if (validSplits.length > 0) {
            await supabase.from('package_payments').insert(
              validSplits.map(s => ({
                package_id: allPackageIds[0],
                amount: s.amount,
                payment_method: s.method.toLowerCase(),
                payment_date: paymentDate ? new Date(paymentDate).toISOString() : new Date().toISOString(),
              }))
            );
          }
        }
      }

      toast({ title: 'Patient Added', description: `${formData.full_name} has been added successfully.` });
      navigate(`/patient/${patientId}/review`);
    } catch (error) {
      console.error('Error adding existing patient:', error);
      toast({ title: 'Error', description: 'Failed to add patient. Please try again.', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderTreatmentSelect = (value: string, onChange: (val: string) => void) => (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-12 text-base">
        <SelectValue placeholder="Select treatment" />
      </SelectTrigger>
      <SelectContent>
        {treatments.map((t) => (
          <SelectItem key={t.id} value={t.id} className="py-2">
            <span className="font-medium">{t.treatment_name}</span>
            <span className="text-xs text-muted-foreground ml-2">{t.category}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <PageContainer maxWidth="md">
      <PageHeader
        title="Add Existing Patient"
        subtitle="Add a patient with existing history"
        backButton={
          <TabletButton variant="ghost" size="icon" onClick={() => navigate('/patients')} aria-label="Back">
            <ArrowLeft className="h-5 w-5" />
          </TabletButton>
        }
      />

      <form onSubmit={handleSubmit}>
        {/* File Number */}
        <TabletCard className="mb-6">
          <TabletCardHeader>
            <TabletCardTitle>Patient File Number</TabletCardTitle>
          </TabletCardHeader>
          <TabletCardContent>
            <TabletInput
              label="File Number"
              placeholder="Enter patient file number"
              value={formData.file_number}
              onChange={(e) => handleChange('file_number', e.target.value)}
            />
          </TabletCardContent>
        </TabletCard>

        {/* Scan Emirates ID */}
        {showIdScan ? (
          <TabletCard className="mb-6">
            <TabletCardHeader>
              <div className="flex items-center justify-between">
                <TabletCardTitle>Scan Emirates ID</TabletCardTitle>
                <TabletButton type="button" variant="ghost" size="sm" onClick={() => setShowIdScan(false)}>
                  Cancel
                </TabletButton>
              </div>
            </TabletCardHeader>
            <TabletCardContent>
              <EmiratesIdCapture
                onDataExtracted={handleIdDataExtracted}
                onSkip={() => setShowIdScan(false)}
                showSkip={false}
              />
            </TabletCardContent>
          </TabletCard>
        ) : (
          <TabletButton
            type="button"
            variant="outline"
            fullWidth
            className="mb-6"
            onClick={() => setShowIdScan(true)}
            leftIcon={<CreditCard />}
          >
            Scan Emirates ID
          </TabletButton>
        )}

        {/* Patient Info */}
        <PatientInfoSection formData={formData} errors={errors} onChange={(f, v) => handleChange(f, v)} />

        {/* Emergency Contact */}
        <EmergencyContactSection formData={formData} errors={errors} onChange={(f, v) => handleChange(f, v)} />

        {/* Medical History */}
        <MedicalHistorySection
          conditions={medicalConditions}
          onChange={handleMedicalChange}
          onDetailsChange={handleMedicalDetailsChange}
        />

        {/* Signature (optional) */}
        <TabletCard className="mb-6">
          <TabletCardHeader>
            <div className="flex items-center justify-between">
              <TabletCardTitle>Patient Signature (Optional)</TabletCardTitle>
              <TabletButton type="button" variant="ghost" size="sm" onClick={clearSignature} leftIcon={<Eraser className="h-4 w-4" />}>
                Clear
              </TabletButton>
            </div>
          </TabletCardHeader>
          <TabletCardContent>
            <div className="rounded-xl border-2 border-dashed border-input bg-background">
              <SignatureCanvas
                ref={signatureRef}
                canvasProps={{
                  className: 'w-full h-40 touch-none',
                  style: { width: '100%', height: '160px' },
                }}
                dotSize={2}
                minWidth={1.5}
                maxWidth={3}
              />
            </div>
          </TabletCardContent>
        </TabletCard>

        {/* Package Section */}
        <TabletCard className="mb-6">
          <TabletCardHeader>
            <div className="flex items-center gap-2">
              <PackageIcon className="h-5 w-5" />
              <TabletCardTitle>Packages (Optional)</TabletCardTitle>
            </div>
          </TabletCardHeader>
          <TabletCardContent className="space-y-5">
            {/* Treatment Lines */}
            <div className="space-y-3">
              <label className="block text-sm font-medium">Treatments</label>
              {treatmentLines.map((line, index) => (
                <div key={index} className="space-y-2 p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      {renderTreatmentSelect(line.treatmentId, (val) => updateLine(index, 'treatmentId', val))}
                    </div>
                    <button type="button" onClick={() => removeTreatmentLine(index)} className="p-2 text-destructive hover:bg-destructive/10 rounded">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Sessions Purchased</label>
                      <Select value={String(line.sessions)} onValueChange={(v) => updateLine(index, 'sessions', parseInt(v))}>
                        <SelectTrigger className="h-10 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SESSION_OPTIONS.map((n) => (
                            <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Sessions Used</label>
                      <Select value={String(line.sessionsUsed)} onValueChange={(v) => updateLine(index, 'sessionsUsed', parseInt(v))}>
                        <SelectTrigger className="h-10 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: line.sessions + 1 }, (_, i) => i).map((n) => (
                            <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              ))}
              <TabletButton type="button" variant="outline" size="sm" onClick={addTreatmentLine} className="w-full">
                <Plus className="h-4 w-4 mr-1" /> Add Treatment
              </TabletButton>
            </div>

            {/* Complimentary */}
            <div className="space-y-3 border-t pt-4">
              <label className="block text-sm font-medium flex items-center gap-2">
                <Gift className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Complimentary Treatments
              </label>
              {compLines.map((line, index) => (
                <div key={index} className="space-y-2 p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      {renderTreatmentSelect(line.treatmentId, (val) => updateCompLine(index, 'treatmentId', val))}
                    </div>
                    <button type="button" onClick={() => removeCompLine(index)} className="p-2 text-destructive hover:bg-destructive/10 rounded">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Sessions</label>
                      <Select value={String(line.sessions)} onValueChange={(v) => updateCompLine(index, 'sessions', parseInt(v))}>
                        <SelectTrigger className="h-10 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SESSION_OPTIONS.map((n) => (
                            <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Sessions Used</label>
                      <Select value={String(line.sessionsUsed)} onValueChange={(v) => updateCompLine(index, 'sessionsUsed', parseInt(v))}>
                        <SelectTrigger className="h-10 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: line.sessions + 1 }, (_, i) => i).map((n) => (
                            <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              ))}
              <TabletButton type="button" variant="outline" size="sm" onClick={addCompLine} className="w-full">
                <Plus className="h-4 w-4 mr-1" /> Add Complimentary Treatment
              </TabletButton>
            </div>

            {/* Payment section - only show if treatment lines exist */}
            {treatmentLines.length > 0 && (
              <>
                <div className="space-y-2 border-t pt-4">
                  <label className="block text-sm font-medium">Total Bill Amount (AED)</label>
                  <TabletInput
                    type="number"
                    min={0}
                    step="0.01"
                    value={totalAmount === 0 ? '' : totalAmount}
                    onChange={(e) => setTotalAmount(e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                    placeholder="e.g. 2500"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium">Payment Date</label>
                  <TabletInput
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium">Payment Status</label>
                  <div className="flex gap-2">
                    <TabletButton type="button" variant={paymentStatus === 'paid' ? 'success' : 'outline'} fullWidth onClick={() => setPaymentStatus('paid')}>
                      Fully Paid
                    </TabletButton>
                    <TabletButton type="button" variant={paymentStatus === 'pending' ? 'warning' : 'outline'} fullWidth onClick={() => setPaymentStatus('pending')}>
                      Partial / Pending
                    </TabletButton>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="block text-sm font-medium">Payment Breakdown</label>
                  {paymentSplits.map((split, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Select value={split.method} onValueChange={(val) => updateSplit(index, 'method', val)}>
                        <SelectTrigger className="h-12 w-[130px] text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PAYMENT_METHODS.map((m) => (
                            <SelectItem key={m} value={m}>{m}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <TabletInput
                        type="number"
                        min={0}
                        step="0.01"
                        value={split.amount === 0 ? '' : split.amount}
                        onChange={(e) => updateSplit(index, 'amount', e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                        placeholder="Amount"
                        className="flex-1"
                      />
                      {paymentSplits.length > 1 && (
                        <TabletButton type="button" variant="ghost" size="sm" onClick={() => removePaymentSplit(index)} className="px-2">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </TabletButton>
                      )}
                    </div>
                  ))}
                  <TabletButton type="button" variant="outline" size="sm" onClick={addPaymentSplit} className="w-full">
                    <Plus className="h-4 w-4 mr-1" /> Add Split Payment
                  </TabletButton>

                  {totalAmount > 0 && (
                    <div className="rounded-lg bg-muted p-3 text-sm space-y-1">
                      <div className="flex justify-between"><span>Total Bill:</span><span className="font-medium">AED {totalAmount.toFixed(2)}</span></div>
                      <div className="flex justify-between"><span>Paid:</span><span className="font-medium text-emerald-600 dark:text-emerald-400">AED {totalPaid.toFixed(2)}</span></div>
                      {remaining > 0 && (
                        <div className="flex justify-between text-orange-600 dark:text-orange-400"><span>Remaining:</span><span className="font-medium">AED {remaining.toFixed(2)}</span></div>
                      )}
                    </div>
                  )}
                </div>

                {paymentStatus === 'pending' && (
                  <div className="space-y-3 border-t pt-4">
                    <label className="block text-sm font-medium">Next Payment Details</label>
                    <div className="grid grid-cols-2 gap-3">
                      <TabletInput type="date" label="Next Payment Date" value={nextPaymentDate} onChange={(e) => setNextPaymentDate(e.target.value)} />
                      <TabletInput
                        type="number"
                        label="Amount (AED)"
                        min={0}
                        step="0.01"
                        value={nextPaymentAmount === 0 ? '' : nextPaymentAmount}
                        onChange={(e) => setNextPaymentAmount(e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                        placeholder="e.g. 500"
                      />
                    </div>
                  </div>
                )}
              </>
            )}
          </TabletCardContent>
        </TabletCard>

        {/* Submit */}
        <TabletButton
          type="submit"
          fullWidth
          size="lg"
          isLoading={isSubmitting}
          leftIcon={<Check />}
          className="mb-8"
        >
          Add Existing Patient
        </TabletButton>
      </form>
    </PageContainer>
  );
}
