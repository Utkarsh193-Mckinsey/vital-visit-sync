import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { TabletButton } from '@/components/ui/tablet-button';
import { TabletCard, TabletCardContent, TabletCardHeader, TabletCardTitle } from '@/components/ui/tablet-card';
import { PageContainer, PageHeader } from '@/components/layout/PageContainer';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Check, FileSignature, AlertCircle, Download, Camera, Syringe } from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';
import type { Patient, Package, Treatment, ConsentTemplate } from '@/types/database';
import { generateConsentPDF } from '@/utils/generateConsentPDF';
import { downloadPDF, getFirstName, getConsentFileName } from '@/utils/pdfDownload';
import { format } from 'date-fns';
import { Checkbox } from '@/components/ui/checkbox';

// Helper function to replace placeholders in consent text
const replaceConsentPlaceholders = (
  consentText: string,
  patientName: string,
  treatmentName: string,
  date: Date
): string => {
  const formattedDate = format(date, 'd MMMM yyyy');
  return consentText
    .replace(/\[PATIENT_NAME\]/g, patientName)
    .replace(/\[patient_name\]/gi, patientName)
    .replace(/\[patient name\]/gi, patientName)
    .replace(/\[patient's name\]/gi, patientName)
    .replace(/\[DATE\]/g, formattedDate)
    .replace(/\[date\]/gi, formattedDate)
    .replace(/\[TREATMENT_NAME\]/g, treatmentName)
    .replace(/\[treatment_name\]/gi, treatmentName)
    .replace(/\[treatment name\]/gi, treatmentName)
    .replace(/\[treatment\]/gi, treatmentName);
};

interface PackageWithTreatment extends Package {
  treatment: Treatment & {
    consent_template?: ConsentTemplate;
  };
}

interface SignedConsentData {
  packageId: string;
  treatmentName: string;
  pdfBlob: Blob;
  visitNumber: number;
}

interface TreatmentSignatureData {
  packageId: string;
  treatmentId: string;
  signatureDataUrl: string;
  consentTemplate: ConsentTemplate;
  treatmentName: string;
}

type ConsentStep = 'select_treatments' | 'treatment' | 'photo_video' | 'complete';

export default function ConsentSigning() {
  const { patientId } = useParams<{ patientId: string }>();
  const [searchParams] = useSearchParams();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [allPackages, setAllPackages] = useState<PackageWithTreatment[]>([]);
  const [packages, setPackages] = useState<PackageWithTreatment[]>([]);
  const [chosenPackageIds, setChosenPackageIds] = useState<Set<string>>(new Set());
  const [currentPackageIndex, setCurrentPackageIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSigning, setIsSigning] = useState(false);
  const [signedPackages, setSignedPackages] = useState<Set<string>>(new Set());
  const [treatmentSignatures, setTreatmentSignatures] = useState<TreatmentSignatureData[]>([]);
  const [signedConsents, setSignedConsents] = useState<SignedConsentData[]>([]);
  const [allConsentsSigned, setAllConsentsSigned] = useState(false);
  const [createdVisitNumber, setCreatedVisitNumber] = useState<number | null>(null);
  const [currentStep, setCurrentStep] = useState<ConsentStep>('select_treatments');
  const signatureRef = useRef<SignatureCanvas>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { staff } = useAuth();

  // Get pre-selected package IDs from URL (from patient dashboard)
  const urlPackageIds = searchParams.get('packages')?.split(',').filter(Boolean) || [];

  useEffect(() => {
    fetchData();
  }, [patientId]);

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

  const handleSignTreatmentConsent = async () => {
    if (!signatureRef.current || signatureRef.current.isEmpty()) {
      toast({
        title: 'Signature Required',
        description: 'Please sign the consent form before continuing.',
        variant: 'destructive',
      });
      return;
    }

    const currentPackage = packages[currentPackageIndex];
    if (!currentPackage || !patient) return;

    // Get signature as data URL
    const canvas = signatureRef.current.getCanvas();
    const signatureDataUrl = canvas.toDataURL('image/png');
    
    const consentTemplate = currentPackage.treatment?.consent_template;
    if (!consentTemplate) return;

    // Store treatment signature
    setTreatmentSignatures(prev => [...prev, {
      packageId: currentPackage.id,
      treatmentId: currentPackage.treatment_id,
      signatureDataUrl,
      consentTemplate,
      treatmentName: currentPackage.treatment.treatment_name,
    }]);
    
    // Mark this package as signed
    setSignedPackages(prev => new Set([...prev, currentPackage.id]));
    
    // Move to next package or to photo/video consent step
    if (currentPackageIndex < packages.length - 1) {
      setCurrentPackageIndex(prev => prev + 1);
      clearSignature();
      toast({
        title: 'Consent Signed',
        description: `Signed for ${currentPackage.treatment.treatment_name}. Please sign the next consent.`,
      });
    } else {
      // All treatment consents signed - move to photo/video consent
      setCurrentStep('photo_video');
      clearSignature();
      toast({
        title: 'Treatment Consents Complete',
        description: 'Please sign the photo/video consent form.',
      });
    }
  };

  const handleSignPhotoVideoConsent = async () => {
    if (!signatureRef.current || signatureRef.current.isEmpty()) {
      toast({
        title: 'Signature Required',
        description: 'Please sign the photo/video consent form.',
        variant: 'destructive',
      });
      return;
    }

    if (!patient || !staff) return;

    setIsSigning(true);

    try {
      // Check for existing active visit first
      const { data: existingActiveVisit } = await supabase
        .from('visits')
        .select('id, visit_number, current_status')
        .eq('patient_id', patientId!)
        .in('current_status', ['waiting', 'in_progress'])
        .limit(1)
        .maybeSingle();

      if (existingActiveVisit) {
        toast({
          title: 'Active Visit Exists',
          description: `Visit #${existingActiveVisit.visit_number} is still ${existingActiveVisit.current_status === 'waiting' ? 'waiting' : 'in progress'}. Please complete it first.`,
          variant: 'destructive',
        });
        setIsSigning(false);
        return;
      }

      // Get photo/video signature
      const canvas = signatureRef.current.getCanvas();
      const photoVideoSignatureDataUrl = canvas.toDataURL('image/png');

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

      // Generate PDFs and upload for each treatment
      const consentFormsToInsert = [];
      const signedConsentsList: SignedConsentData[] = [];

      for (const treatmentSig of treatmentSignatures) {
        // Upload treatment signature
        const signatureResponse = await fetch(treatmentSig.signatureDataUrl);
        const signatureBlob = await signatureResponse.blob();

        const signatureFileName = `consent-signatures/${patientId}/${treatmentSig.treatmentId}/${Date.now()}.png`;
        const { error: uploadError } = await supabase.storage
          .from('signatures')
          .upload(signatureFileName, signatureBlob, { contentType: 'image/png' });

        if (uploadError) throw uploadError;

        const { data: signatureUrlData } = supabase.storage
          .from('signatures')
          .getPublicUrl(signatureFileName);

        // Generate PDF with BOTH English and Arabic text, plus photo/video signature
        const pdfBlob = await generateConsentPDF({
          patientName: patient.full_name,
          patientDOB: patient.date_of_birth,
          patientPhone: patient.phone_number,
          treatmentName: treatmentSig.treatmentName,
          consentFormName: treatmentSig.consentTemplate.form_name,
          consentText: treatmentSig.consentTemplate.consent_text,
          consentTextAr: treatmentSig.consentTemplate.consent_text_ar || undefined,
          signatureDataUrl: treatmentSig.signatureDataUrl,
          signedDate: new Date(),
          photoVideoSignatureDataUrl: photoVideoSignatureDataUrl,
        });

        // Upload PDF
        const pdfFileName = `consent-pdfs/${patientId}/${treatmentSig.treatmentId}/${Date.now()}.pdf`;
        const { error: pdfUploadError } = await supabase.storage
          .from('clinic-documents')
          .upload(pdfFileName, pdfBlob, { contentType: 'application/pdf' });

        if (pdfUploadError) throw pdfUploadError;

        const { data: pdfUrlData } = supabase.storage
          .from('clinic-documents')
          .getPublicUrl(pdfFileName);

        consentFormsToInsert.push({
          visit_id: newVisit.id,
          treatment_id: treatmentSig.treatmentId,
          consent_template_id: treatmentSig.consentTemplate.id,
          signature_url: signatureUrlData.publicUrl,
          pdf_url: pdfUrlData.publicUrl,
        });

        signedConsentsList.push({
          packageId: treatmentSig.packageId,
          treatmentName: treatmentSig.treatmentName,
          pdfBlob: pdfBlob,
          visitNumber: nextVisitNumber,
        });
      }

      // Insert all consent forms
      const { error: consentError } = await supabase
        .from('consent_forms')
        .insert(consentFormsToInsert);

      if (consentError) throw consentError;

      setSignedConsents(signedConsentsList);
      setCreatedVisitNumber(nextVisitNumber);
      setCurrentStep('complete');
      setAllConsentsSigned(true);

      // Auto-download all consent PDFs
      for (const consent of signedConsentsList) {
        const firstName = getFirstName(patient.full_name);
        const fileName = getConsentFileName(firstName, consent.treatmentName, consent.visitNumber);
        downloadPDF(consent.pdfBlob, fileName);
      }

      toast({
        title: 'All Consents Signed',
        description: `Visit #${nextVisitNumber} has been created. Consent forms are downloading.`,
      });

    } catch (error) {
      console.error('Error signing consent:', error);
      toast({
        title: 'Error',
        description: 'Failed to save consent signatures.',
        variant: 'destructive',
      });
    } finally {
      setIsSigning(false);
    }
  };

  const handleSkipConsent = async () => {
    // Create visit without consent forms (for packages without consent templates)
    if (!patient || !staff) return;

    setIsSigning(true);
    try {
      // Check for existing active visit first
      const { data: existingActiveVisit } = await supabase
        .from('visits')
        .select('id, visit_number, current_status')
        .eq('patient_id', patientId!)
        .in('current_status', ['waiting', 'in_progress'])
        .limit(1)
        .maybeSingle();

      if (existingActiveVisit) {
        toast({
          title: 'Active Visit Exists',
          description: `Visit #${existingActiveVisit.visit_number} is still ${existingActiveVisit.current_status === 'waiting' ? 'waiting' : 'in progress'}. Please complete it first.`,
          variant: 'destructive',
        });
        setIsSigning(false);
        return;
      }

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

  const handleDownloadConsent = (consent: SignedConsentData) => {
    if (!patient) return;
    const firstName = getFirstName(patient.full_name);
    const fileName = getConsentFileName(firstName, consent.treatmentName, consent.visitNumber);
    downloadPDF(consent.pdfBlob, fileName);
    toast({
      title: 'Download Started',
      description: `Downloading consent form for ${consent.treatmentName}.`,
    });
  };

  const handleContinueToWaiting = () => {
    navigate('/waiting');
  };

  // Show success screen with download options after all consents are signed
  if (currentStep === 'complete' && allConsentsSigned && patient) {
    return (
      <PageContainer maxWidth="md">
        <div className="flex flex-col items-center justify-center py-12">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
            <Check className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-center mb-2">All Consents Signed!</h1>
          <p className="text-muted-foreground text-center mb-2">
            Visit #{createdVisitNumber} has been created for {patient.full_name}.
          </p>
          <p className="text-muted-foreground text-center mb-8">
            Patient is now in the waiting area.
          </p>

          <div className="w-full max-w-sm space-y-4">
            <p className="text-sm font-medium text-center mb-2">Download Consent Forms</p>
            {signedConsents.map((consent) => (
              <TabletButton
                key={consent.packageId}
                fullWidth
                variant="outline"
                onClick={() => handleDownloadConsent(consent)}
                leftIcon={<Download />}
              >
                {consent.treatmentName} Consent
              </TabletButton>
            ))}

            <div className="pt-4">
              <TabletButton
                fullWidth
                onClick={handleContinueToWaiting}
              >
                Continue to Waiting Area
              </TabletButton>
            </div>
          </div>
        </div>
      </PageContainer>
    );
  }

  // Show photo/video consent step
  if (currentStep === 'photo_video') {
    return (
      <PageContainer maxWidth="lg">
        <PageHeader 
          title="Photo & Video Consent"
          subtitle={patient.full_name}
          backButton={
            <TabletButton 
              variant="ghost" 
              size="icon" 
              onClick={() => {
                setCurrentStep('treatment');
                setCurrentPackageIndex(packages.length - 1);
              }}
              aria-label="Back"
            >
              <ArrowLeft className="h-5 w-5" />
            </TabletButton>
          }
        />

        {/* Progress indicator */}
        <div className="mb-6 flex items-center gap-2">
          <div className="flex-1 h-2 rounded-full bg-primary" />
          <div className="flex-1 h-2 rounded-full bg-primary/50" />
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Step 2 of 2: Photo & Video Consent
        </p>

        {/* Photo/Video consent text */}
        <TabletCard className="mb-6">
          <TabletCardHeader>
            <TabletCardTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Video & Photographic Consent / الموافقة على التصوير والفيديو
            </TabletCardTitle>
          </TabletCardHeader>
          <TabletCardContent>
            <div className="prose prose-sm max-w-none text-foreground space-y-4">
              <div className="whitespace-pre-wrap bg-muted/50 p-4 rounded-lg">
                <p className="font-medium mb-2">English:</p>
                <p>
                  I consent to the taking of photographs/videos during my treatment for educational, 
                  promotional, or medical purposes. My identity will be kept confidential unless I give 
                  explicit consent to share.
                </p>
              </div>
              <div className="whitespace-pre-wrap bg-muted/50 p-4 rounded-lg" dir="rtl">
                <p className="font-medium mb-2 text-right">العربية:</p>
                <p className="text-right">
                  أوافق على التقاط الصور/الفيديو أثناء علاجي لأغراض تعليمية أو ترويجية أو طبية. 
                  ستظل هويتي سرية إلا إذا منحت موافقة صريحة للمشاركة.
                </p>
              </div>
            </div>
          </TabletCardContent>
        </TabletCard>

        {/* Signature pad */}
        <TabletCard className="mb-6">
          <TabletCardHeader>
            <div className="flex items-center justify-between">
              <TabletCardTitle>Patient Signature (Photo/Video Consent)</TabletCardTitle>
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
              Please sign above to confirm you consent to photos/videos
            </p>
          </TabletCardContent>
        </TabletCard>

        {/* Actions */}
        <div className="flex gap-4">
          <TabletButton
            variant="outline"
            fullWidth
            onClick={() => {
              setCurrentStep('treatment');
              setCurrentPackageIndex(packages.length - 1);
            }}
            disabled={isSigning}
          >
            Back
          </TabletButton>
          <TabletButton
            fullWidth
            onClick={handleSignPhotoVideoConsent}
            disabled={isSigning}
            leftIcon={<Camera />}
          >
            {isSigning ? 'Processing...' : 'Complete & Download'}
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
            {/* Photo/video consent indicator */}
            <div className="flex-1 h-2 rounded-full bg-muted" />
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Step 1: Treatment Consent {currentPackageIndex + 1} of {packages.length} - {currentPackage?.treatment.treatment_name}
          </p>

          {/* Consent text - English */}
          <TabletCard className="mb-4">
            <TabletCardHeader>
              <TabletCardTitle className="flex items-center gap-2">
                <FileSignature className="h-5 w-5" />
                {consentTemplate?.form_name || 'Consent Form'} (English)
              </TabletCardTitle>
            </TabletCardHeader>
            <TabletCardContent>
              <div className="prose prose-sm max-w-none text-foreground">
                <div className="whitespace-pre-wrap bg-muted/50 p-4 rounded-lg max-h-48 overflow-y-auto">
                  {patient && consentTemplate?.consent_text 
                    ? replaceConsentPlaceholders(
                        consentTemplate.consent_text,
                        patient.full_name,
                        currentPackage?.treatment.treatment_name || '',
                        new Date()
                      )
                    : 'No consent text available.'}
                </div>
              </div>
            </TabletCardContent>
          </TabletCard>

          {/* Consent text - Arabic */}
          {consentTemplate?.consent_text_ar && (
            <TabletCard className="mb-6">
              <TabletCardHeader>
                <TabletCardTitle className="flex items-center gap-2">
                  <FileSignature className="h-5 w-5" />
                  {consentTemplate?.form_name || 'Consent Form'} (العربية)
                </TabletCardTitle>
              </TabletCardHeader>
              <TabletCardContent>
                <div className="prose prose-sm max-w-none text-foreground">
                  <div className="whitespace-pre-wrap bg-muted/50 p-4 rounded-lg max-h-48 overflow-y-auto text-right" dir="rtl">
                    {patient && consentTemplate?.consent_text_ar 
                      ? replaceConsentPlaceholders(
                          consentTemplate.consent_text_ar,
                          patient.full_name,
                          currentPackage?.treatment.treatment_name || '',
                          new Date()
                        )
                      : 'لا يوجد نص موافقة متاح.'}
                  </div>
                </div>
              </TabletCardContent>
            </TabletCard>
          )}

          {/* Signature pad */}
          <TabletCard className="mb-6">
            <TabletCardHeader>
              <div className="flex items-center justify-between">
                <TabletCardTitle>Patient Signature (Treatment Consent)</TabletCardTitle>
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
              onClick={handleSignTreatmentConsent}
              disabled={isSigning}
              leftIcon={<Check />}
            >
              {currentPackageIndex < packages.length - 1 
                ? 'Sign & Continue' 
                : 'Next: Photo Consent'
              }
            </TabletButton>
          </div>
        </>
      )}
    </PageContainer>
  );
}
