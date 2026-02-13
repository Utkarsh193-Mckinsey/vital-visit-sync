import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { TabletButton } from '@/components/ui/tablet-button';
import { TabletCard, TabletCardContent } from '@/components/ui/tablet-card';
import { PageContainer, PageHeader } from '@/components/layout/PageContainer';
import { Badge } from '@/components/ui/badge';
import { Loader2, UserCheck, Clock } from 'lucide-react';

export default function NewPatients() {
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetch = async () => {
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .eq('doctor_reviewed', false)
        .order('registration_date', { ascending: false });
      if (!error && data) setPatients(data);
      setLoading(false);
    };
    fetch();
  }, []);

  if (loading) {
    return (
      <PageContainer maxWidth="full">
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer maxWidth="full">
      <PageHeader title="New Patient Registrations" />

      {patients.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <UserCheck className="h-12 w-12 mb-4 opacity-50" />
          <p>No new patients pending review.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {patients.map((p) => (
            <TabletCard
              key={p.id}
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => navigate(`/patient/${p.id}/review`)}
            >
              <TabletCardContent className="flex items-center justify-between py-4">
                <div>
                  <p className="font-medium text-foreground">{p.full_name}</p>
                  <p className="text-sm text-muted-foreground">{p.phone_number}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {p.nationality && <Badge variant="outline" className="text-xs">{p.nationality}</Badge>}
                    {p.gender && <Badge variant="outline" className="text-xs">{p.gender}</Badge>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-warning" />
                  <span className="text-sm text-warning font-medium">Pending Review</span>
                </div>
              </TabletCardContent>
            </TabletCard>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
