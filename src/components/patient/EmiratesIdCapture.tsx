import { useState, useRef, useCallback } from 'react';
import { TabletButton } from '@/components/ui/tablet-button';
import { TabletCard, TabletCardContent, TabletCardHeader, TabletCardTitle } from '@/components/ui/tablet-card';
import { TabletInput } from '@/components/ui/tablet-input';
import { Camera, RotateCcw, ChevronRight, Loader2, CreditCard, AlertCircle, Plus, FileText, Globe } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export type DocumentType = 'emirates_id' | 'passport' | 'other';

export interface ExtractedIdData {
  full_name?: string | null;
  date_of_birth?: string | null;
  emirates_id?: string | null;
  nationality?: string | null;
  gender?: string | null;
  expiry_date?: string | null;
  address?: string | null;
  document_type?: DocumentType;
  other_document_name?: string;
}

interface EmiratesIdCaptureProps {
  onDataExtracted: (data: ExtractedIdData, frontImage: string, backImage: string) => void;
  onSkip?: () => void;
  showSkip?: boolean;
}

type CaptureStep = 'doc_type' | 'other_name' | 'intro' | 'front' | 'front_preview' | 'back' | 'back_preview' | 'processing';

const DOC_TYPE_OPTIONS: { value: DocumentType; label: string; icon: React.ReactNode; description: string }[] = [
  { value: 'emirates_id', label: 'Emirates ID', icon: <CreditCard className="h-6 w-6" />, description: 'UAE National ID card' },
  { value: 'passport', label: 'Passport', icon: <Globe className="h-6 w-6" />, description: 'International passport' },
  { value: 'other', label: 'Other', icon: <FileText className="h-6 w-6" />, description: 'Specify document type' },
];

export default function EmiratesIdCapture({ onDataExtracted, onSkip, showSkip = true }: EmiratesIdCaptureProps) {
  const [step, setStep] = useState<CaptureStep>('doc_type');
  const [documentType, setDocumentType] = useState<DocumentType>('emirates_id');
  const [otherDocName, setOtherDocName] = useState('');
  const [frontImage, setFrontImage] = useState<string>('');
  const [backImage, setBackImage] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const captureTarget = step === 'front' || step === 'front_preview' ? 'front' : 'back';

  const docLabel = documentType === 'emirates_id' ? 'Emirates ID' : documentType === 'passport' ? 'Passport' : (otherDocName || 'Document');

  const handleFileCapture = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      if (captureTarget === 'front') {
        setFrontImage(dataUrl);
        setStep('front_preview');
      } else {
        setBackImage(dataUrl);
        setStep('back_preview');
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }, [captureTarget]);

  const triggerCapture = () => {
    fileInputRef.current?.click();
  };

  const retake = () => {
    if (captureTarget === 'front') {
      setFrontImage('');
      setStep('front');
    } else {
      setBackImage('');
      setStep('back');
    }
  };

  const processImages = async () => {
    setStep('processing');
    setIsProcessing(true);
    setError('');

    try {
      const { data, error: fnError } = await supabase.functions.invoke('extract-emirates-id', {
        body: { frontImage, backImage, documentType, otherDocName },
      });

      if (fnError) throw fnError;

      if (data?.success && data?.data) {
        toast({
          title: `${docLabel} Scanned Successfully`,
          description: `Details have been extracted from your ${docLabel}.`,
        });
        onDataExtracted(
          { ...data.data, document_type: documentType, other_document_name: otherDocName },
          frontImage,
          backImage
        );
      } else {
        throw new Error(data?.error || 'Failed to extract data');
      }
    } catch (err: any) {
      console.error('Document extraction error:', err);
      setError(`Could not read the ${docLabel}. Please try again with clearer photos or enter details manually.`);
      setStep('doc_type');
      toast({
        title: 'Extraction Failed',
        description: 'Could not read document. You can retry or skip to enter manually.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDocTypeSelect = (type: DocumentType) => {
    setDocumentType(type);
    if (type === 'other') {
      setStep('other_name');
    } else {
      setStep('intro');
    }
  };

  const fileInput = (
    <input
      ref={fileInputRef}
      type="file"
      accept="image/*"
      capture="environment"
      className="hidden"
      onChange={handleFileCapture}
    />
  );

  // Step 0: Document type selection
  if (step === 'doc_type') {
    return (
      <div className="flex flex-col items-center py-8">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
          <FileText className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-xl font-bold text-center mb-2">Scan Document</h2>
        <p className="text-muted-foreground text-center mb-6 max-w-sm">
          Select the type of document to scan
        </p>
        {error && (
          <div className="flex items-center gap-2 text-destructive text-sm mb-4">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        )}
        <div className="w-full max-w-sm space-y-3">
          {DOC_TYPE_OPTIONS.map((opt) => (
            <TabletButton
              key={opt.value}
              fullWidth
              variant="outline"
              onClick={() => handleDocTypeSelect(opt.value)}
              leftIcon={opt.icon}
              className="justify-start h-14"
            >
              <div className="text-left">
                <div className="font-medium">{opt.label}</div>
                <div className="text-xs text-muted-foreground">{opt.description}</div>
              </div>
            </TabletButton>
          ))}
          {showSkip && onSkip && (
            <TabletButton
              fullWidth
              variant="ghost"
              onClick={onSkip}
              leftIcon={<Plus />}
              className="mt-2"
            >
              Manual Entry
            </TabletButton>
          )}
        </div>
      </div>
    );
  }

  // Step 0b: Other document name
  if (step === 'other_name') {
    return (
      <div className="flex flex-col items-center py-8">
        <TabletCard className="w-full max-w-md">
          <TabletCardHeader>
            <TabletCardTitle className="text-center">Specify Document Type</TabletCardTitle>
          </TabletCardHeader>
          <TabletCardContent className="flex flex-col items-center gap-4">
            <TabletInput
              placeholder="e.g. Driving License, Visa Copy..."
              value={otherDocName}
              onChange={(e) => setOtherDocName(e.target.value)}
              className="text-base"
            />
            <div className="flex gap-3 w-full">
              <TabletButton
                fullWidth
                variant="outline"
                onClick={() => setStep('doc_type')}
              >
                Back
              </TabletButton>
              <TabletButton
                fullWidth
                onClick={() => setStep('intro')}
                disabled={!otherDocName.trim()}
              >
                Continue
              </TabletButton>
            </div>
          </TabletCardContent>
        </TabletCard>
      </div>
    );
  }

  if (step === 'intro') {
    return (
      <div className="flex flex-col items-center py-8">
        {fileInput}
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
          <CreditCard className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-xl font-bold text-center mb-2">Scan {docLabel}</h2>
        <p className="text-muted-foreground text-center mb-2 max-w-sm">
          Take photos of the front and back of the {docLabel} to auto-fill patient details.
        </p>
        <div className="w-full max-w-sm space-y-3 mt-4">
          <TabletButton
            fullWidth
            onClick={() => setStep('front')}
            leftIcon={<Camera />}
          >
            Start Scanning
          </TabletButton>
          <TabletButton
            fullWidth
            variant="ghost"
            onClick={() => setStep('doc_type')}
          >
            Change Document Type
          </TabletButton>
        </div>
      </div>
    );
  }

  if (step === 'front' || step === 'back') {
    const side = step === 'front' ? 'Front' : 'Back';
    return (
      <div className="flex flex-col items-center py-8">
        {fileInput}
        <TabletCard className="w-full max-w-md">
          <TabletCardHeader>
            <TabletCardTitle className="text-center">
              Capture {side} Side — {docLabel}
            </TabletCardTitle>
          </TabletCardHeader>
          <TabletCardContent className="flex flex-col items-center gap-4">
            <div className="w-full aspect-[1.586/1] rounded-xl border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center bg-muted/30">
              <CreditCard className="h-12 w-12 text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">
                Position the {side.toLowerCase()} side of the {docLabel}
              </p>
            </div>
            <TabletButton fullWidth onClick={triggerCapture} leftIcon={<Camera />}>
              Take Photo
            </TabletButton>
            {step === 'back' && (
              <TabletButton fullWidth variant="ghost" onClick={() => processImages()}>
                Skip Back Side
              </TabletButton>
            )}
          </TabletCardContent>
        </TabletCard>
      </div>
    );
  }

  if (step === 'front_preview' || step === 'back_preview') {
    const side = step === 'front_preview' ? 'Front' : 'Back';
    const image = step === 'front_preview' ? frontImage : backImage;
    return (
      <div className="flex flex-col items-center py-8">
        {fileInput}
        <TabletCard className="w-full max-w-md">
          <TabletCardHeader>
            <TabletCardTitle className="text-center">
              {side} Side Preview — {docLabel}
            </TabletCardTitle>
          </TabletCardHeader>
          <TabletCardContent className="flex flex-col items-center gap-4">
            <div className="w-full aspect-[1.586/1] rounded-xl overflow-hidden border">
              <img
                src={image}
                alt={`${docLabel} ${side}`}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex gap-3 w-full">
              <TabletButton
                fullWidth
                variant="outline"
                onClick={retake}
                leftIcon={<RotateCcw />}
              >
                Retake
              </TabletButton>
              <TabletButton
                fullWidth
                onClick={() => {
                  if (step === 'front_preview') {
                    setStep('back');
                  } else {
                    processImages();
                  }
                }}
                rightIcon={<ChevronRight />}
              >
                {step === 'front_preview' ? 'Next' : 'Extract Details'}
              </TabletButton>
            </div>
          </TabletCardContent>
        </TabletCard>
      </div>
    );
  }

  // Processing step
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <Loader2 className="h-12 w-12 animate-spin text-primary mb-6" />
      <h2 className="text-xl font-bold text-center mb-2">Reading {docLabel}...</h2>
      <p className="text-muted-foreground text-center">
        Extracting details from the photos. This may take a moment.
      </p>
    </div>
  );
}
