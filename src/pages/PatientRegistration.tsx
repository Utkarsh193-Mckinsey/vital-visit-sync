import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import SignatureCanvas from 'react-signature-canvas';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { TabletInput } from '@/components/ui/tablet-input';
import { TabletButton } from '@/components/ui/tablet-button';
import { TabletCard, TabletCardContent, TabletCardHeader, TabletCardTitle } from '@/components/ui/tablet-card';
import { PageContainer, PageHeader } from '@/components/layout/PageContainer';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, UserPlus, Eraser, Download, Check } from 'lucide-react';
import { generateRegistrationPDF, getRegistrationFileName } from '@/utils/generateRegistrationPDF';
import { downloadPDF, getFirstName } from '@/utils/pdfDownload';
import EmiratesIdCapture, { type ExtractedIdData } from '@/components/patient/EmiratesIdCapture';

export default function PatientRegistration() {
  const [formData, setFormData] = useState({
    full_name: '',
    phone_number: '',
    email: '',
    date_of_birth: '',
    emirates_id: '',
    address: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registeredPatient, setRegisteredPatient] = useState<{ id: string; signatureDataUrl: string } | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const signatureRef = useRef<SignatureCanvas>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { staff } = useAuth();

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.full_name.trim()) {
      newErrors.full_name = 'Full name is required';
    }
    if (!formData.phone_number.trim()) {
      newErrors.phone_number = 'Phone number is required';
    }
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }
    if (!formData.date_of_birth) {
      newErrors.date_of_birth = 'Date of birth is required';
    }
    if (signatureRef.current?.isEmpty()) {
      newErrors.signature = 'Signature is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const clearSignature = () => {
    signatureRef.current?.clear();
    if (errors.signature) {
      setErrors(prev => ({ ...prev, signature: '' }));
    }
  };

  const uploadSignature = async (): Promise<string | null> => {
    if (!signatureRef.current || signatureRef.current.isEmpty()) {
      return null;
    }

    // Use getCanvas().toDataURL() instead of getTrimmedCanvas() to avoid library bug
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
    
    const { data, error } = await supabase.storage
      .from('clinic-documents')
      .upload(fileName, blob, {
        contentType: 'image/png',
        upsert: false,
      });

    if (error) {
      console.error('Signature upload error:', error);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from('clinic-documents')
      .getPublicUrl(data.path);

    return urlData.publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Check if phone number already exists - use maybeSingle to handle 0 rows
      const { data: existingPatients, error: checkError } = await supabase
        .from('patients')
        .select('id')
        .eq('phone_number', formData.phone_number.trim());

      if (checkError) {
        throw checkError;
      }

      if (existingPatients && existingPatients.length > 0) {
        toast({
          title: 'Patient Exists',
          description: 'A patient with this phone number already exists.',
          variant: 'destructive',
        });
        setIsSubmitting(false);
        return;
      }

      // Capture signature data URL before upload
      const canvas = signatureRef.current?.getCanvas();
      const signatureDataUrl = canvas?.toDataURL('image/png') || '';

      // Upload signature
      const signatureUrl = await uploadSignature();
      
      if (!signatureUrl) {
        toast({
          title: 'Upload Error',
          description: 'Failed to upload signature. Please try again.',
          variant: 'destructive',
        });
        setIsSubmitting(false);
        return;
      }

      // Create patient record
      const { data: patient, error } = await supabase
        .from('patients')
        .insert({
          full_name: formData.full_name.trim(),
          phone_number: formData.phone_number.trim(),
          email: formData.email.trim().toLowerCase(),
          date_of_birth: formData.date_of_birth,
          emirates_id: formData.emirates_id.trim() || null,
          address: formData.address.trim() || null,
          registration_signature_url: signatureUrl,
          status: 'active',
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      toast({
        title: 'Patient Registered',
        description: `${formData.full_name} has been successfully registered.`,
      });

      // Store patient info and signature for download
      setRegisteredPatient({
        id: patient.id,
        signatureDataUrl,
      });
      
    } catch (error) {
      console.error('Registration error:', error);
      toast({
        title: 'Registration Failed',
        description: 'An error occurred. Please try again.',
        variant: 'destructive',
      });
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
        address: formData.address.trim() || null,
        signatureDataUrl: registeredPatient.signatureDataUrl,
        registrationDate: new Date(),
      });

      const firstName = getFirstName(formData.full_name);
      const fileName = getRegistrationFileName(firstName, formData.phone_number);
      downloadPDF(pdfBlob, fileName);

      toast({
        title: 'Download Started',
        description: 'Registration form PDF is downloading.',
      });
    } catch (error) {
      console.error('Error generating registration PDF:', error);
      toast({
        title: 'Download Failed',
        description: 'Failed to generate PDF. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleContinueToPatient = () => {
    if (registeredPatient) {
      navigate(`/patient/${registeredPatient.id}`);
    }
  };

  // Show success screen with download option
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
            <TabletButton
              fullWidth
              variant="outline"
              onClick={handleDownloadRegistration}
              disabled={isDownloading}
              leftIcon={<Download />}
            >
              {isDownloading ? 'Generating PDF...' : 'Download Registration Form'}
            </TabletButton>

            <TabletButton
              fullWidth
              onClick={handleContinueToPatient}
            >
              Continue to Patient Dashboard
            </TabletButton>
          </div>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer maxWidth="md">
      <PageHeader 
        title="New Patient Registration"
        backButton={
          <TabletButton 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate('/patients')}
            aria-label="Back to search"
          >
            <ArrowLeft className="h-5 w-5" />
          </TabletButton>
        }
      />

      <form onSubmit={handleSubmit}>
        <TabletCard className="mb-6">
          <TabletCardHeader>
            <TabletCardTitle>Patient Information</TabletCardTitle>
          </TabletCardHeader>
          <TabletCardContent className="space-y-4">
            <TabletInput
              label="Full Name *"
              placeholder="Enter patient's full name"
              value={formData.full_name}
              onChange={(e) => handleChange('full_name', e.target.value)}
              error={errors.full_name}
            />

            <div className="grid gap-4 md:grid-cols-2">
              <TabletInput
                label="Phone Number *"
                type="tel"
                placeholder="e.g., +971 50 123 4567"
                value={formData.phone_number}
                onChange={(e) => handleChange('phone_number', e.target.value)}
                error={errors.phone_number}
              />

              <TabletInput
                label="Email *"
                type="email"
                placeholder="patient@example.com"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                error={errors.email}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <TabletInput
                label="Date of Birth *"
                type="date"
                value={formData.date_of_birth}
                onChange={(e) => handleChange('date_of_birth', e.target.value)}
                error={errors.date_of_birth}
              />

              <TabletInput
                label="Emirates ID"
                placeholder="784-XXXX-XXXXXXX-X"
                value={formData.emirates_id}
                onChange={(e) => handleChange('emirates_id', e.target.value)}
              />
            </div>

            <TabletInput
              label="Address"
              placeholder="Enter full address"
              value={formData.address}
              onChange={(e) => handleChange('address', e.target.value)}
            />
          </TabletCardContent>
        </TabletCard>

        <TabletCard className="mb-6">
          <TabletCardHeader>
            <div className="flex items-center justify-between">
              <TabletCardTitle>Signature *</TabletCardTitle>
              <TabletButton
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearSignature}
                leftIcon={<Eraser className="h-4 w-4" />}
              >
                Clear
              </TabletButton>
            </div>
          </TabletCardHeader>
          <TabletCardContent>
            <div className={`signature-pad ${errors.signature ? 'border-destructive' : ''}`}>
              <SignatureCanvas
                ref={signatureRef}
                canvasProps={{
                  className: 'w-full h-[150px] rounded-xl',
                  style: { width: '100%', height: '150px' },
                }}
                backgroundColor="white"
                penColor="black"
              />
            </div>
            {errors.signature && (
              <p className="mt-2 text-sm text-destructive">{errors.signature}</p>
            )}
            <p className="mt-2 text-sm text-muted-foreground">
              Please sign above to confirm registration
            </p>
          </TabletCardContent>
        </TabletCard>

        <TabletButton
          type="submit"
          fullWidth
          isLoading={isSubmitting}
          leftIcon={<UserPlus />}
        >
          Register Patient
        </TabletButton>
      </form>
    </PageContainer>
  );
}
