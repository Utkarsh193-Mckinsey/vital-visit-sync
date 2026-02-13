import { PageContainer, PageHeader } from '@/components/layout/PageContainer';
import { TabletCard } from '@/components/ui/tablet-card';
import { Bot } from 'lucide-react';

export default function PersonalAssistant() {
  return (
    <PageContainer maxWidth="full">
      <PageHeader title="Personal Assistant" subtitle="AI-powered appointment management" />
      <TabletCard className="p-8 text-center">
        <Bot className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
        <p className="text-lg font-medium text-muted-foreground">Personal Assistant panel coming in Prompt 5</p>
        <p className="text-sm text-muted-foreground mt-1">Pending requests and AI suggestions will appear here</p>
      </TabletCard>
    </PageContainer>
  );
}
