import { useNavigate } from 'react-router-dom';
import { PageContainer, PageHeader } from '@/components/layout/PageContainer';
import TreatmentsManager from '@/components/admin/TreatmentsManager';

export default function TreatmentsPage() {
  return (
    <PageContainer maxWidth="full">
      <PageHeader title="Treatments" />
      <TreatmentsManager />
    </PageContainer>
  );
}
