import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageContainer, PageHeader } from '@/components/layout/PageContainer';
import { TabletButton } from '@/components/ui/tablet-button';
import { TabletCard, TabletCardContent, TabletCardHeader, TabletCardTitle } from '@/components/ui/tablet-card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Pill, FileText } from 'lucide-react';
import TreatmentsManager from '@/components/admin/TreatmentsManager';
import ConsentTemplatesManager from '@/components/admin/ConsentTemplatesManager';

export default function AdminSettings() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('treatments');

  return (
    <PageContainer maxWidth="lg">
      <PageHeader 
        title="Admin Settings"
        backButton={
          <TabletButton 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate('/patients')}
            aria-label="Back to patients"
          >
            <ArrowLeft className="h-5 w-5" />
          </TabletButton>
        }
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 h-14">
          <TabsTrigger value="treatments" className="h-12 text-base flex items-center gap-2">
            <Pill className="h-4 w-4" />
            Treatments
          </TabsTrigger>
          <TabsTrigger value="consent" className="h-12 text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Consent Forms
          </TabsTrigger>
        </TabsList>

        <TabsContent value="treatments" className="mt-4">
          <TreatmentsManager />
        </TabsContent>

        <TabsContent value="consent" className="mt-4">
          <ConsentTemplatesManager />
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}
