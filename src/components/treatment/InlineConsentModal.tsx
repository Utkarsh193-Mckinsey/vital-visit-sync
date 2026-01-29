import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { TabletButton } from '@/components/ui/tablet-button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileSignature, X } from 'lucide-react';
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
import type { Patient, Treatment, ConsentTemplate } from '@/types/database';

interface InlineConsentModalProps {
  open: boolean;
  onClose: () => void;
  onConsentSigned: () => void;
  visitId: string;
  patient: Patient;
  treatmentId: string;
  treatmentName: string;
}

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
  const signatureRef = useRef<SignatureCanvas>(null);
  const { toast } = useToast();

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

  // Fetch when modal opens
  useState(() => {
    if (open) {
      fetchConsentTemplate();
    }
  });

  // Effect to fetch on open change
  if (open && !consentTemplate && !isLoading) {
    fetchConsentTemplate();
  }

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

    if (!consentTemplate) return;

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

      // Generate PDF with full consent form
      const pdfBlob = await generateConsentPDF({
        patientName: patient.full_name,
        patientDOB: patient.date_of_birth,
        patientPhone: patient.phone_number,
        treatmentName: treatmentName,
        consentFormName: consentTemplate.form_name,
        consentText: consentTemplate.consent_text,
        signatureDataUrl: signatureDataUrl,
        signedDate: new Date(),
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

  const processedConsentText = consentTemplate
    ? replaceConsentPlaceholders(
        consentTemplate.consent_text,
        patient.full_name,
        treatmentName,
        new Date()
      )
    : '';

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSignature className="h-5 w-5 text-primary" />
            Sign Consent: {treatmentName}
          </DialogTitle>
          <DialogDescription>
            Please read the consent form carefully and sign below.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <p className="text-muted-foreground">Loading consent form...</p>
            </div>
          </div>
        ) : consentTemplate ? (
          <div className="flex-1 flex flex-col min-h-0 gap-4">
            {/* Consent Text */}
            <div className="flex-1 min-h-0">
              <ScrollArea className="h-[200px] rounded-lg border p-4 bg-muted/30">
                <div 
                  className="prose prose-sm max-w-none text-sm"
                  dangerouslySetInnerHTML={{ __html: processedConsentText }}
                />
              </ScrollArea>
            </div>

            {/* Signature Area */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-sm font-medium">Patient Signature</label>
                <TabletButton
                  variant="ghost"
                  size="sm"
                  onClick={clearSignature}
                >
                  Clear
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
                Sign above using finger or stylus
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
                Cancel
              </TabletButton>
              <TabletButton
                onClick={handleSignConsent}
                className="flex-1"
                isLoading={isSigning}
                leftIcon={<FileSignature />}
              >
                Sign & Continue
              </TabletButton>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
