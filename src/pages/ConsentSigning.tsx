import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { TabletButton } from '@/components/ui/tablet-button';
import { TabletCard, TabletCardContent, TabletCardHeader, TabletCardTitle } from '@/components/ui/tablet-card';
import { PageContainer, PageHeader } from '@/components/layout/PageContainer';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Check, FileSignature, AlertCircle } from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';
import type { Patient, Package, Treatment, ConsentTemplate } from '@/types/database';
import { generateConsentPDF } from '@/utils/generateConsentPDF';

interface PackageWithTreatment extends Package {
  treatment: Treatment & {
    consent_template?: ConsentTemplate;
  };
}

export default function ConsentSigning() {
  const { patientId } = useParams<{ patientId: string }>();
  const [searchParams] = useSearchParams();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [packages, setPackages] = useState<PackageWithTreatment[]>([]);
  const [currentPackageIndex, setCurrentPackageIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSigning, setIsSigning] = useState(false);
  const [signedPackages, setSignedPackages] = useState<Set<string>>(new Set());
  const [signatureData, setSignatureData] = useState<Map<string, { signatureUrl: string; pdfUrl: string }>>(new Map());
  const signatureRef = useRef<SignatureCanvas>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { staff } = useAuth();

  // Get selected package IDs from URL
  const selectedPackageIds = searchParams.get('packages')?.split(',').filter(Boolean) || [];

  useEffect(() => {
    fetchData();
  }, [patientId, selectedPackageIds.join(',')]);

  const fetchData = async () => {
    if (!patientId) return;

    try {
      // Fetch patient
      const { data: patientData, error: patientError } = await supabase
        .from('patients')
        .select('*')
        .eq('id', patientId)
        .single();

      if (patientError) throw patientError;
      setPatient(patientData as Patient);

      // Fetch selected packages with treatments and their consent templates
      let query = supabase
        .from('packages')
        .select(`
          *,
          treatment:treatments (
            *,
            consent_template:consent_templates!fk_consent_template (*)
          )
        `)
        .eq('patient_id', patientId)
        .eq('status', 'active')
        .order('purchase_date', { ascending: true });

      // Filter by selected package IDs if provided
      if (selectedPackageIds.length > 0) {
        query = query.in('id', selectedPackageIds);
      }

      const { data: packagesData, error: packagesError } = await query;

      if (packagesError) throw packagesError;
      
      // Filter packages that have consent templates
      const packagesWithConsent = (packagesData as unknown as PackageWithTreatment[])
        .filter(pkg => pkg.treatment?.consent_template_id);
      
      setPackages(packagesWithConsent);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load consent data.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const clearSignature = () => {
    signatureRef.current?.clear();
  };

  const handleSignConsent = async () => {
    if (!signatureRef.current || signatureRef.current.isEmpty()) {
      toast({
        title: 'Signature Required',
        description: 'Please sign the consent form before continuing.',
        variant: 'destructive',
      });
      return;
    }

    const currentPackage = packages[currentPackageIndex];
    if (!currentPackage || !patient || !staff) return;

    setIsSigning(true);

    try {
      // Get signature as data URL
      const canvas = signatureRef.current.getCanvas();
      const signatureDataUrl = canvas.toDataURL('image/png');
      
      // Convert to blob for signature upload
      const signatureResponse = await fetch(signatureDataUrl);
      const signatureBlob = await signatureResponse.blob();

      // Upload signature
      const signatureFileName = `consent-signatures/${patientId}/${currentPackage.treatment_id}/${Date.now()}.png`;
      const { error: uploadError } = await supabase.storage
        .from('signatures')
        .upload(signatureFileName, signatureBlob, { contentType: 'image/png' });

      if (uploadError) throw uploadError;

      const { data: signatureUrlData } = supabase.storage
        .from('signatures')
        .getPublicUrl(signatureFileName);

      // Generate PDF with full consent form
      const consentTemplate = currentPackage.treatment?.consent_template;
      const pdfBlob = await generateConsentPDF({
        patientName: patient.full_name,
        patientDOB: patient.date_of_birth,
        patientPhone: patient.phone_number,
        treatmentName: currentPackage.treatment.treatment_name,
        consentFormName: consentTemplate?.form_name || 'Consent Form',
        consentText: consentTemplate?.consent_text || '',
        signatureDataUrl: signatureDataUrl,
        signedDate: new Date(),
      });

      // Upload PDF
      const pdfFileName = `consent-pdfs/${patientId}/${currentPackage.treatment_id}/${Date.now()}.pdf`;
      const { error: pdfUploadError } = await supabase.storage
        .from('clinic-documents')
        .upload(pdfFileName, pdfBlob, { contentType: 'application/pdf' });

      if (pdfUploadError) throw pdfUploadError;

      const { data: pdfUrlData } = supabase.storage
        .from('clinic-documents')
        .getPublicUrl(pdfFileName);

      // Store both URLs for this package
      setSignatureData(prev => new Map(prev).set(currentPackage.id, {
        signatureUrl: signatureUrlData.publicUrl,
        pdfUrl: pdfUrlData.publicUrl,
      }));
      
      // Mark this package as signed
      setSignedPackages(prev => new Set([...prev, currentPackage.id]));
      
      // Move to next package or finish
      if (currentPackageIndex < packages.length - 1) {
        setCurrentPackageIndex(prev => prev + 1);
        clearSignature();
        toast({
          title: 'Consent Signed',
          description: `Signed for ${currentPackage.treatment.treatment_name}. Please sign the next consent.`,
        });
      } else {
        // All consents signed - create visit
        await createVisit({
          signatureUrl: signatureUrlData.publicUrl,
          pdfUrl: pdfUrlData.publicUrl,
        });
      }
    } catch (error) {
      console.error('Error signing consent:', error);
      toast({
        title: 'Error',
        description: 'Failed to save consent signature.',
        variant: 'destructive',
      });
    } finally {
      setIsSigning(false);
    }
  };

  const createVisit = async (lastData: { signatureUrl: string; pdfUrl: string }) => {
    if (!patient || !staff) return;

    try {
      // Get next visit number
      const { data: visitData } = await supabase
        .from('visits')
        .select('visit_number')
        .eq('patient_id', patientId)
        .order('visit_number', { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextVisitNumber = (visitData?.visit_number || 0) + 1;

      // Create visit
      const { data: newVisit, error: visitError } = await supabase
        .from('visits')
        .insert({
          patient_id: patientId!,
          visit_number: nextVisitNumber,
          current_status: 'waiting',
          consent_signed: true,
          reception_staff_id: staff.id,
        })
        .select()
        .single();

      if (visitError) throw visitError;

      // Create consent forms for each signed package with their respective signatures and PDFs
      const consentFormsToInsert = packages.map(pkg => {
        const data = signatureData.get(pkg.id) || lastData;
        return {
          visit_id: newVisit.id,
          treatment_id: pkg.treatment_id,
          consent_template_id: pkg.treatment.consent_template_id!,
          signature_url: data.signatureUrl,
          pdf_url: data.pdfUrl,
        };
      });

      const { error: consentError } = await supabase
        .from('consent_forms')
        .insert(consentFormsToInsert);

      if (consentError) throw consentError;

      toast({
        title: 'Visit Created',
        description: `Visit #${nextVisitNumber} has been created. Patient is now in the waiting area.`,
      });

      navigate('/waiting');
    } catch (error) {
      console.error('Error creating visit:', error);
      toast({
        title: 'Error',
        description: 'Failed to create visit.',
        variant: 'destructive',
      });
    }
  };

  const handleSkipConsent = async () => {
    // Create visit without consent forms (for packages without consent templates)
    if (!patient || !staff) return;

    setIsSigning(true);
    try {
      const { data: visitData } = await supabase
        .from('visits')
        .select('visit_number')
        .eq('patient_id', patientId)
        .order('visit_number', { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextVisitNumber = (visitData?.visit_number || 0) + 1;

      const { error: visitError } = await supabase
        .from('visits')
        .insert({
          patient_id: patientId!,
          visit_number: nextVisitNumber,
          current_status: 'waiting',
          consent_signed: false,
          reception_staff_id: staff.id,
        });

      if (visitError) throw visitError;

      toast({
        title: 'Visit Created',
        description: `Visit #${nextVisitNumber} has been created without consent forms.`,
      });

      navigate('/waiting');
    } catch (error) {
      console.error('Error creating visit:', error);
      toast({
        title: 'Error',
        description: 'Failed to create visit.',
        variant: 'destructive',
      });
    } finally {
      setIsSigning(false);
    }
  };

  if (isLoading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-muted-foreground">Loading consent forms...</p>
          </div>
        </div>
      </PageContainer>
    );
  }

  if (!patient) {
    return (
      <PageContainer>
        <div className="text-center py-16">
          <h2 className="text-xl font-semibold">Patient not found</h2>
          <TabletButton className="mt-4" onClick={() => navigate('/patients')}>
            Back to Search
          </TabletButton>
        </div>
      </PageContainer>
    );
  }

  const currentPackage = packages[currentPackageIndex];
  const consentTemplate = currentPackage?.treatment?.consent_template;

  return (
    <PageContainer maxWidth="lg">
      <PageHeader 
        title="Sign Consent Forms"
        subtitle={patient.full_name}
        backButton={
          <TabletButton 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate(`/patient/${patientId}`)}
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </TabletButton>
        }
      />

      {/* Selected treatments summary */}
      {selectedPackageIds.length > 0 && (
        <div className="mb-4 p-3 bg-primary/5 rounded-lg border border-primary/20">
          <p className="text-sm text-muted-foreground">
            Selected treatments for today: <strong>{selectedPackageIds.length}</strong>
          </p>
        </div>
      )}

      {packages.length === 0 ? (
        <TabletCard>
          <TabletCardContent className="p-8 text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Consent Forms Required</h3>
            <p className="text-muted-foreground mb-6">
              The selected treatments don't have consent forms configured.
            </p>
            <div className="flex gap-4 justify-center">
              <TabletButton
                variant="outline"
                onClick={() => navigate(`/patient/${patientId}`)}
              >
                Go Back
              </TabletButton>
              <TabletButton onClick={handleSkipConsent} disabled={isSigning}>
                {isSigning ? 'Creating...' : 'Start Visit Without Consent'}
              </TabletButton>
            </div>
          </TabletCardContent>
        </TabletCard>
      ) : (
        <>
          {/* Progress indicator */}
          <div className="mb-6 flex items-center gap-2">
            {packages.map((pkg, index) => (
              <div
                key={pkg.id}
                className={`flex-1 h-2 rounded-full transition-colors ${
                  index < currentPackageIndex
                    ? 'bg-primary'
                    : index === currentPackageIndex
                    ? 'bg-primary/50'
                    : 'bg-muted'
                }`}
              />
            ))}
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Consent {currentPackageIndex + 1} of {packages.length}: {currentPackage?.treatment.treatment_name}
          </p>

          {/* Consent text */}
          <TabletCard className="mb-6">
            <TabletCardHeader>
              <TabletCardTitle className="flex items-center gap-2">
                <FileSignature className="h-5 w-5" />
                {consentTemplate?.form_name || 'Consent Form'}
              </TabletCardTitle>
            </TabletCardHeader>
            <TabletCardContent>
              <div className="prose prose-sm max-w-none text-foreground">
                <div className="whitespace-pre-wrap bg-muted/50 p-4 rounded-lg max-h-64 overflow-y-auto">
                  {consentTemplate?.consent_text || 'No consent text available.'}
                </div>
              </div>
            </TabletCardContent>
          </TabletCard>

          {/* Signature pad */}
          <TabletCard className="mb-6">
            <TabletCardHeader>
              <div className="flex items-center justify-between">
                <TabletCardTitle>Patient Signature</TabletCardTitle>
                <TabletButton variant="ghost" size="sm" onClick={clearSignature}>
                  Clear
                </TabletButton>
              </div>
            </TabletCardHeader>
            <TabletCardContent>
              <div className="border-2 border-dashed border-border rounded-lg overflow-hidden bg-white">
                <SignatureCanvas
                  ref={signatureRef}
                  canvasProps={{
                    className: 'w-full h-48',
                    style: { width: '100%', height: '192px' }
                  }}
                  backgroundColor="white"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2 text-center">
                Please sign above to confirm you have read and agree to the consent terms
              </p>
            </TabletCardContent>
          </TabletCard>

          {/* Actions */}
          <div className="flex gap-4">
            <TabletButton
              variant="outline"
              fullWidth
              onClick={() => navigate(`/patient/${patientId}`)}
            >
              Cancel
            </TabletButton>
            <TabletButton
              fullWidth
              onClick={handleSignConsent}
              disabled={isSigning}
              leftIcon={<Check />}
            >
              {isSigning 
                ? 'Signing...' 
                : currentPackageIndex < packages.length - 1 
                  ? 'Sign & Continue' 
                  : 'Sign & Start Visit'
              }
            </TabletButton>
          </div>
        </>
      )}
    </PageContainer>
  );
}
