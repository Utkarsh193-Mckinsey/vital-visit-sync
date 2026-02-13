import { TabletButton } from '@/components/ui/tablet-button';
import { TabletCard, TabletCardContent, TabletCardHeader, TabletCardTitle } from '@/components/ui/tablet-card';
import { Globe } from 'lucide-react';

interface LanguageSelectorProps {
  onSelect: (lang: 'en' | 'ar') => void;
}

export default function LanguageSelector({ onSelect }: LanguageSelectorProps) {
  return (
    <div className="flex flex-col items-center py-12">
      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
        <Globe className="h-8 w-8 text-primary" />
      </div>
      <h2 className="text-xl font-bold text-center mb-2">Select Language</h2>
      <p className="text-muted-foreground text-center mb-8">
        اختر اللغة / Choose your preferred language
      </p>
      <div className="w-full max-w-sm space-y-4">
        <TabletButton fullWidth onClick={() => onSelect('en')}>
          English
        </TabletButton>
        <TabletButton fullWidth variant="outline" onClick={() => onSelect('ar')}>
          العربية
        </TabletButton>
      </div>
    </div>
  );
}
