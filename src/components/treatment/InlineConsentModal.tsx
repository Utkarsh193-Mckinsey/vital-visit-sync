import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { TabletButton } from '@/components/ui/tablet-button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileSignature, Globe } from 'lucide-react';
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
  const signatureRef = useRef<SignatureCanvas>(null);
  const { toast } = useToast();

  // Reset state when modal opens/closes
  useEffect(() => {
    if (open) {
      setSelectedLanguage(null);
      setConsentTemplate(null);
      fetchConsentTemplate();
    } else {
      setSelectedLanguage(null);
      setConsentTemplate(null);
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

    if (!consentTemplate || !selectedLanguage) return;

    setIsSigning(true);

    try {
      // Get signature as data URL
      const canvas = signatureRef.current.getCanvas();
      const signatureDataUrl = canvas.toDataURL('image/png');
      
      // Convert to blob for signature upload
      const signatureResponse = await fetch(signatureDataUrl);
      const signatureBlob = await signatureResponse.blob();

      // Upload signature
      const signatureFileName = `consent-signatures/${patient.id}/${treatmentId}/${Date.now()}.png`;
      const { error: uploadError } = await supabase.storage
        .from('signatures')
        .upload(signatureFileName, signatureBlob, { contentType: 'image/png' });

      if (uploadError) throw uploadError;

      const { data: signatureUrlData } = supabase.storage
        .from('signatures')
        .getPublicUrl(signatureFileName);

      // Get the consent text based on selected language
      const consentText = selectedLanguage === 'ar' && consentTemplate.consent_text_ar 
        ? consentTemplate.consent_text_ar 
        : consentTemplate.consent_text;

      // Generate PDF with full consent form
      const pdfBlob = await generateConsentPDF({
        patientName: patient.full_name,
        patientDOB: patient.date_of_birth,
        patientPhone: patient.phone_number,
        treatmentName: treatmentName,
        consentFormName: consentTemplate.form_name,
        consentText: consentText,
        signatureDataUrl: signatureDataUrl,
        signedDate: new Date(),
        language: selectedLanguage,
      });

      // Upload PDF
      const pdfFileName = `consent-pdfs/${patient.id}/${treatmentId}/${Date.now()}.pdf`;
      const { error: pdfUploadError } = await supabase.storage
        .from('clinic-documents')
        .upload(pdfFileName, pdfBlob, { contentType: 'application/pdf' });

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

      // Update visit consent_signed flag if not already true
      await supabase
        .from('visits')
        .update({ consent_signed: true })
        .eq('id', visitId);

      toast({
        title: 'Consent Signed',
        description: `${treatmentName} consent form has been signed successfully.`,
      });

      onConsentSigned();
      onClose();
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

  const getConsentText = () => {
    if (!consentTemplate || !selectedLanguage) return '';
    const text = selectedLanguage === 'ar' && consentTemplate.consent_text_ar 
      ? consentTemplate.consent_text_ar 
      : consentTemplate.consent_text;
    return replaceConsentPlaceholders(text, patient.full_name, treatmentName, new Date());
  };

  const hasArabicVersion = !!consentTemplate?.consent_text_ar;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSignature className="h-5 w-5 text-primary" />
            Sign Consent: {treatmentName}
          </DialogTitle>
          <DialogDescription>
            {!selectedLanguage 
              ? 'Please select your preferred language.' 
              : 'Please read the consent form carefully and sign below.'}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <p className="text-muted-foreground">Loading consent form...</p>
            </div>
          </div>
        ) : consentTemplate && !selectedLanguage ? (
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
        ) : consentTemplate && selectedLanguage ? (
          <div className="flex-1 flex flex-col min-h-0 gap-4">
            {/* Language Indicator */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Language: {selectedLanguage === 'ar' ? 'العربية (Arabic)' : 'English'}
              </span>
              <TabletButton
                variant="ghost"
                size="sm"
                onClick={() => setSelectedLanguage(null)}
              >
                Change Language
              </TabletButton>
            </div>

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
                  {selectedLanguage === 'ar' ? 'توقيع المريض' : 'Patient Signature'}
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
                onClick={onClose}
                className="flex-1"
                disabled={isSigning}
              >
                {selectedLanguage === 'ar' ? 'إلغاء' : 'Cancel'}
              </TabletButton>
              <TabletButton
                onClick={handleSignConsent}
                className="flex-1"
                isLoading={isSigning}
                leftIcon={<FileSignature />}
              >
                {selectedLanguage === 'ar' ? 'توقيع ومتابعة' : 'Sign & Continue'}
              </TabletButton>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
