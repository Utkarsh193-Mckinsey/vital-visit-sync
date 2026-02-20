import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { TabletButton } from '@/components/ui/tablet-button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileSignature, Globe, Camera, Download, CheckCircle, ClipboardCheck } from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { generateConsentPDF } from '@/utils/generateConsentPDF';
import { format } from 'date-fns';
import type { Patient, ConsentTemplate } from '@/types/database';

interface InlineConsentModalProps {
  open: boolean;
  onClose: () => void;
  onConsentSigned: () => void;
  visitId: string;
  patient: Patient;
  treatmentId: string;
  treatmentName: string;
}

type Language = 'en' | 'ar';
type ConsentStep = 'language' | 'treatment' | 'photo_video' | 'complete' | 'physical_only';

// Helper function to replace placeholders in consent text
const replaceConsentPlaceholders = (
  consentText: string,
  patientName: string,
  treatmentName: string,
  date: Date
): string => {
  const formattedDate = format(date, 'd MMMM yyyy');
  return consentText
    .replace(/\[PATIENT_NAME\]/gi, patientName)
    .replace(/\[patient name\]/gi, patientName)
    .replace(/\[patient's name\]/gi, patientName)
    .replace(/\[DATE\]/gi, formattedDate)
    .replace(/\[TREATMENT_NAME\]/gi, treatmentName)
    .replace(/\[treatment name\]/gi, treatmentName)
    .replace(/\[treatment\]/gi, treatmentName);
};

export function InlineConsentModal({
  open,
  onClose,
  onConsentSigned,
  visitId,
  patient,
  treatmentId,
  treatmentName,
}: InlineConsentModalProps) {
  const [consentTemplate, setConsentTemplate] = useState<ConsentTemplate | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<Language | null>(null);
  const [currentStep, setCurrentStep] = useState<ConsentStep>('language');
  const [treatmentSignatureDataUrl, setTreatmentSignatureDataUrl] = useState<string | null>(null);
  const [photoVideoSignatureDataUrl, setPhotoVideoSignatureDataUrl] = useState<string | null>(null);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const signatureRef = useRef<SignatureCanvas>(null);
  const { toast } = useToast();

  // Reset state when modal opens/closes
  useEffect(() => {
    if (open) {
      setSelectedLanguage(null);
      setConsentTemplate(null);
      setCurrentStep('language');
      setTreatmentSignatureDataUrl(null);
      setPhotoVideoSignatureDataUrl(null);
      setPdfBlob(null);
      fetchConsentTemplate();
    } else {
      setSelectedLanguage(null);
      setConsentTemplate(null);
      setCurrentStep('language');
      setTreatmentSignatureDataUrl(null);
      setPhotoVideoSignatureDataUrl(null);
      setPdfBlob(null);
    }
  }, [open]);

  // Fetch consent template when modal opens
  const fetchConsentTemplate = async () => {
    setIsLoading(true);
    try {
      // First get the treatment to find the consent_template_id
      const { data: treatmentData, error: treatmentError } = await supabase
        .from('treatments')
        .select('consent_template_id')
        .eq('id', treatmentId)
        .single();

      if (treatmentError || !treatmentData?.consent_template_id) {
        toast({
          title: 'No Consent Template',
          description: 'This treatment does not have a consent template configured.',
          variant: 'destructive',
        });
        onClose();
        return;
      }

      // Fetch the consent template
      const { data: templateData, error: templateError } = await supabase
        .from('consent_templates')
        .select('*')
        .eq('id', treatmentData.consent_template_id)
        .single();

      if (templateError) throw templateError;
      setConsentTemplate(templateData as ConsentTemplate);
    } catch (error) {
      console.error('Error fetching consent template:', error);
      toast({
        title: 'Error',
        description: 'Failed to load consent template.',
        variant: 'destructive',
      });
      onClose();
    } finally {
      setIsLoading(false);
    }
  };

  const clearSignature = () => {
    signatureRef.current?.clear();
  };

  const handleLanguageSelect = (lang: Language) => {
    // If Arabic is selected but no Arabic text available, show error
    if (lang === 'ar' && !consentTemplate?.consent_text_ar) {
      toast({
        title: 'Arabic Not Available',
        description: 'This consent form is only available in English.',
        variant: 'destructive',
      });
      return;
    }
    setSelectedLanguage(lang);
    setCurrentStep('treatment');
  };

  const handleTreatmentConsentSign = async () => {
    if (!signatureRef.current || signatureRef.current.isEmpty()) {
      toast({
        title: 'Signature Required',
        description: 'Please sign the treatment consent form before continuing.',
        variant: 'destructive',
      });
      return;
    }

    // Save treatment signature and move to photo/video step
    const canvas = signatureRef.current.getCanvas();
    const signatureDataUrl = canvas.toDataURL('image/png');
    setTreatmentSignatureDataUrl(signatureDataUrl);
    signatureRef.current.clear();
    setCurrentStep('photo_video');
  };

  const handlePhotoVideoConsentSign = async () => {
    if (!signatureRef.current || signatureRef.current.isEmpty()) {
      toast({
        title: 'Signature Required',
        description: 'Please sign the photo/video consent before continuing.',
        variant: 'destructive',
      });
      return;
    }

    if (!consentTemplate || !selectedLanguage || !treatmentSignatureDataUrl) return;

    setIsSigning(true);

    try {
      // Get photo/video signature
      const canvas = signatureRef.current.getCanvas();
      const photoSigDataUrl = canvas.toDataURL('image/png');
      setPhotoVideoSignatureDataUrl(photoSigDataUrl);

      // Upload treatment signature
      const treatmentSigResponse = await fetch(treatmentSignatureDataUrl);
      const treatmentSigBlob = await treatmentSigResponse.blob();
      const signatureFileName = `consent-signatures/${patient.id}/${treatmentId}/${Date.now()}.png`;
      const { error: uploadError } = await supabase.storage
        .from('signatures')
        .upload(signatureFileName, treatmentSigBlob, { contentType: 'image/png' });

      if (uploadError) throw uploadError;

      const { data: signatureUrlData } = supabase.storage
        .from('signatures')
        .getPublicUrl(signatureFileName);

      // Generate PDF with both signatures
      const generatedPdfBlob = await generateConsentPDF({
        patientName: patient.full_name,
        patientDOB: patient.date_of_birth,
        patientPhone: patient.phone_number,
        treatmentName: treatmentName,
        consentFormName: consentTemplate.form_name,
        consentText: consentTemplate.consent_text,
        consentTextAr: consentTemplate.consent_text_ar,
        signatureDataUrl: treatmentSignatureDataUrl,
        signedDate: new Date(),
        language: selectedLanguage,
        photoVideoSignatureDataUrl: photoSigDataUrl,
      });

      setPdfBlob(generatedPdfBlob);

      // Upload PDF
      const pdfFileName = `consent-pdfs/${patient.id}/${treatmentId}/${Date.now()}.pdf`;
      const { error: pdfUploadError } = await supabase.storage
        .from('clinic-documents')
        .upload(pdfFileName, generatedPdfBlob, { contentType: 'application/pdf' });

      if (pdfUploadError) throw pdfUploadError;

      const { data: pdfUrlData } = supabase.storage
        .from('clinic-documents')
        .getPublicUrl(pdfFileName);

      // Create consent form record
      const { error: consentError } = await supabase
        .from('consent_forms')
        .insert({
          visit_id: visitId,
          treatment_id: treatmentId,
          consent_template_id: consentTemplate.id,
          signature_url: signatureUrlData.publicUrl,
          pdf_url: pdfUrlData.publicUrl,
          language: selectedLanguage,
        });

      if (consentError) throw consentError;

      // Update visit consent_signed flag
      await supabase
        .from('visits')
        .update({ consent_signed: true })
        .eq('id', visitId);

      setCurrentStep('complete');

      toast({
        title: 'Consent Forms Signed',
        description: 'Both consent forms have been signed successfully.',
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

  const handleDownloadPDF = () => {
    if (!pdfBlob) return;
    
    const url = URL.createObjectURL(pdfBlob);
    const a = document.createElement('a');
    a.href = url;
    const firstName = patient.full_name.split(' ')[0];
    a.download = `${firstName}_${treatmentName}_consent.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleComplete = () => {
    onConsentSigned();
    onClose();
  };

  const getConsentText = () => {
    if (!consentTemplate || !selectedLanguage) return '';
    const text = selectedLanguage === 'ar' && consentTemplate.consent_text_ar 
      ? consentTemplate.consent_text_ar 
      : consentTemplate.consent_text;
    return replaceConsentPlaceholders(text, patient.full_name, treatmentName, new Date());
  };

  const hasArabicVersion = !!consentTemplate?.consent_text_ar;

  const getStepTitle = () => {
    switch (currentStep) {
      case 'language':
        return 'Select Language';
      case 'treatment':
        return `Treatment Consent: ${treatmentName}`;
      case 'photo_video':
        return 'Photo & Video Consent';
      case 'complete':
        return 'Consent Complete';
    }
  };

  const getStepDescription = () => {
    switch (currentStep) {
      case 'language':
        return 'Please select your preferred language.';
      case 'treatment':
        return 'Please read and sign the treatment consent form.';
      case 'photo_video':
        return 'Please sign the photo/video consent form.';
      case 'complete':
        return 'All consent forms have been signed successfully.';
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {currentStep === 'photo_video' ? (
              <Camera className="h-5 w-5 text-primary" />
            ) : currentStep === 'complete' ? (
              <CheckCircle className="h-5 w-5 text-green-600" />
            ) : (
              <FileSignature className="h-5 w-5 text-primary" />
            )}
            {getStepTitle()}
          </DialogTitle>
          <DialogDescription>
            {getStepDescription()}
          </DialogDescription>
          {/* Step indicator */}
          {currentStep !== 'language' && currentStep !== 'complete' && (
            <div className="flex items-center gap-2 pt-2">
              <div className={`h-2 flex-1 rounded-full ${currentStep === 'treatment' ? 'bg-primary' : 'bg-muted'}`} />
              <div className={`h-2 flex-1 rounded-full ${currentStep === 'photo_video' ? 'bg-primary' : 'bg-muted'}`} />
            </div>
          )}
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <p className="text-muted-foreground">Loading consent form...</p>
            </div>
          </div>
        ) : currentStep === 'language' && consentTemplate ? (
          // Language Selection Step
          <div className="flex-1 flex flex-col items-center justify-center gap-6 py-8">
            <Globe className="h-16 w-16 text-primary/50" />
            <h3 className="text-xl font-semibold">Select Language / اختر اللغة</h3>
            <div className="flex gap-4">
              <TabletButton
                onClick={() => handleLanguageSelect('en')}
                className="h-20 w-40 text-lg"
                variant="outline"
              >
                🇬🇧 English
              </TabletButton>
              <TabletButton
                onClick={() => handleLanguageSelect('ar')}
                className="h-20 w-40 text-lg"
                variant="outline"
                disabled={!hasArabicVersion}
              >
                🇦🇪 العربية
              </TabletButton>
            </div>
            {!hasArabicVersion && (
              <p className="text-sm text-muted-foreground">
                Arabic version is not available for this consent form.
              </p>
            )}
          </div>
        ) : currentStep === 'treatment' && consentTemplate && selectedLanguage ? (
          // Treatment Consent Step
          <div className="flex-1 flex flex-col min-h-0 gap-4">
            {/* Consent Text */}
            <div className="flex-1 min-h-0">
              <ScrollArea className="h-[200px] rounded-lg border p-4 bg-muted/30">
                <div 
                  className={`prose prose-sm max-w-none text-sm whitespace-pre-wrap ${
                    selectedLanguage === 'ar' ? 'text-right' : ''
                  }`}
                  dir={selectedLanguage === 'ar' ? 'rtl' : 'ltr'}
                >
                  {getConsentText()}
                </div>
              </ScrollArea>
            </div>

            {/* Signature Area */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-sm font-medium">
                  {selectedLanguage === 'ar' ? 'توقيع المريض للعلاج' : 'Patient Signature (Treatment Consent)'}
                </label>
                <TabletButton
                  variant="ghost"
                  size="sm"
                  onClick={clearSignature}
                >
                  {selectedLanguage === 'ar' ? 'مسح' : 'Clear'}
                </TabletButton>
              </div>
              <div className="border-2 border-dashed border-muted-foreground/30 rounded-lg bg-white">
                <SignatureCanvas
                  ref={signatureRef}
                  penColor="black"
                  canvasProps={{
                    className: 'w-full h-32 rounded-lg',
                    style: { width: '100%', height: '128px' },
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground text-center">
                {selectedLanguage === 'ar' 
                  ? 'وقّع أعلاه باستخدام الإصبع أو القلم' 
                  : 'Sign above using finger or stylus'}
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <TabletButton
                variant="outline"
                onClick={() => setCurrentStep('language')}
                className="flex-1"
              >
                {selectedLanguage === 'ar' ? 'رجوع' : 'Back'}
              </TabletButton>
              <TabletButton
                onClick={handleTreatmentConsentSign}
                className="flex-1"
                leftIcon={<FileSignature />}
              >
                {selectedLanguage === 'ar' ? 'التالي: موافقة الصور' : 'Next: Photo Consent'}
              </TabletButton>
            </div>
          </div>
        ) : currentStep === 'photo_video' && selectedLanguage ? (
          // Photo/Video Consent Step
          <div className="flex-1 flex flex-col min-h-0 gap-4">
            {/* Photo/Video Consent Text */}
            <div className="flex-1 min-h-0">
              <ScrollArea className="h-[180px] rounded-lg border p-4 bg-muted/30">
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2">Video & Photographic Consent</h4>
                    <p className="text-sm text-muted-foreground">
                      I consent to the taking of photographs/videos during my {treatmentName} treatment 
                      for educational, promotional, or medical purposes. My identity will be kept 
                      confidential unless I give explicit consent to share.
                    </p>
                  </div>
                  <div dir="rtl" className="text-right">
                    <h4 className="font-semibold mb-2">الموافقة على التصوير والفيديو</h4>
                    <p className="text-sm text-muted-foreground">
                      أوافق على التقاط الصور/الفيديو أثناء علاجي لأغراض تعليمية أو ترويجية أو طبية. 
                      ستظل هويتي سرية إلا إذا منحت موافقة صريحة للمشاركة.
                    </p>
                  </div>
                </div>
              </ScrollArea>
            </div>

            {/* Signature Area */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-sm font-medium">
                  {selectedLanguage === 'ar' ? 'توقيع المريض للصور/الفيديو' : 'Patient Signature (Photo/Video Consent)'}
                </label>
                <TabletButton
                  variant="ghost"
                  size="sm"
                  onClick={clearSignature}
                >
                  {selectedLanguage === 'ar' ? 'مسح' : 'Clear'}
                </TabletButton>
              </div>
              <div className="border-2 border-dashed border-muted-foreground/30 rounded-lg bg-white">
                <SignatureCanvas
                  ref={signatureRef}
                  penColor="black"
                  canvasProps={{
                    className: 'w-full h-32 rounded-lg',
                    style: { width: '100%', height: '128px' },
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground text-center">
                {selectedLanguage === 'ar' 
                  ? 'وقّع أعلاه باستخدام الإصبع أو القلم' 
                  : 'Sign above using finger or stylus'}
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <TabletButton
                variant="outline"
                onClick={() => {
                  setCurrentStep('treatment');
                  signatureRef.current?.clear();
                }}
                className="flex-1"
                disabled={isSigning}
              >
                {selectedLanguage === 'ar' ? 'رجوع' : 'Back'}
              </TabletButton>
              <TabletButton
                onClick={handlePhotoVideoConsentSign}
                className="flex-1"
                isLoading={isSigning}
                leftIcon={<Camera />}
              >
                {selectedLanguage === 'ar' ? 'إنهاء وتحميل' : 'Complete & Download'}
              </TabletButton>
            </div>
          </div>
        ) : currentStep === 'complete' ? (
          // Complete Step - Download PDF
          <div className="flex-1 flex flex-col items-center justify-center gap-6 py-8">
            <div className="h-20 w-20 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle className="h-12 w-12 text-green-600" />
            </div>
            <div className="text-center">
              <h3 className="text-xl font-semibold mb-2">All Consents Signed!</h3>
              <p className="text-muted-foreground">
                Both treatment and photo/video consent forms have been signed and saved.
              </p>
            </div>
            
            <div className="flex gap-4">
              <TabletButton
                onClick={handleDownloadPDF}
                variant="outline"
                leftIcon={<Download />}
                className="min-w-[180px]"
              >
                Download PDF
              </TabletButton>
              <TabletButton
                onClick={handleComplete}
                className="min-w-[180px]"
              >
                Continue
              </TabletButton>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
