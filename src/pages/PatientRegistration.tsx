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
import { ArrowLeft, UserPlus, Eraser } from 'lucide-react';

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

    const dataUrl = signatureRef.current.getTrimmedCanvas().toDataURL('image/png');
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
      // Check if phone number already exists
      const { data: existingPatient } = await supabase
        .from('patients')
        .select('id')
        .eq('phone_number', formData.phone_number.trim())
        .single();

      if (existingPatient) {
        toast({
          title: 'Patient Exists',
          description: 'A patient with this phone number already exists.',
          variant: 'destructive',
        });
        setIsSubmitting(false);
        return;
      }

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

      // Navigate to patient dashboard
      navigate(`/patient/${patient.id}`);
      
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
