import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { TabletButton } from '@/components/ui/tablet-button';
import { TabletCard, TabletCardContent } from '@/components/ui/tablet-card';
import { PageContainer, PageHeader } from '@/components/layout/PageContainer';
import { Badge } from '@/components/ui/badge';
import { Loader2, UserCheck, Clock, Stethoscope, Plus, CheckCircle2, XCircle, PackageCheck } from 'lucide-react';
import { ConsultationModal } from '@/components/patient/ConsultationModal';
import { WhatsAppLink } from '@/components/ui/whatsapp-link';
import { useToast } from '@/hooks/use-toast';

export default function NewPatients() {
  const [pendingReview, setPendingReview] = useState<any[]>([]);
  const [awaitingConsultation, setAwaitingConsultation] = useState<any[]>([]);
  const [consulted, setConsulted] = useState<any[]>([]);
  const [notConverted, setNotConverted] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [consultationPatient, setConsultationPatient] = useState<any>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  const fetchAll = useCallback(async () => {
    const [pendingRes, awaitingRes, consultedRes, notConvertedRes] = await Promise.all([
      supabase
        .from('patients')
        .select('*')
        .eq('doctor_reviewed', false)
        .order('registration_date', { ascending: false }),
      supabase
        .from('patients')
        .select('*, consultation_doctor:staff!patients_consultation_done_by_fkey(full_name)')
        .eq('doctor_reviewed', true)
        .eq('consultation_status', 'awaiting_consultation')
        .order('doctor_reviewed_date', { ascending: false }),
      supabase
        .from('patients')
        .select('*, consultation_doctor:staff!patients_consultation_done_by_fkey(full_name)')
        .eq('doctor_reviewed', true)
        .eq('consultation_status', 'consulted')
        .order('consultation_date', { ascending: false }),
      supabase
        .from('patients')
        .select('*, consultation_doctor:staff!patients_consultation_done_by_fkey(full_name)')
        .eq('doctor_reviewed', true)
        .eq('consultation_status', 'not_converted')
        .order('consultation_date', { ascending: false }),
    ]);

    if (pendingRes.data) setPendingReview(pendingRes.data);
    if (awaitingRes.data) setAwaitingConsultation(awaitingRes.data);
    if (consultedRes.data) setConsulted(consultedRes.data);
    if (notConvertedRes.data) setNotConverted(notConvertedRes.data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleMarkConverted = async (patientId: string) => {
    const { error } = await supabase.from('patients').update({
      consultation_status: 'converted',
    } as any).eq('id', patientId);

    if (error) {
      toast({ title: 'Error', description: 'Failed to update status.', variant: 'destructive' });
    } else {
      toast({ title: 'Patient Converted', description: 'Patient moved to All Patients list.' });
      fetchAll();
    }
  };

  const handleMarkNotConverted = async (patientId: string) => {
    const { error } = await supabase.from('patients').update({
      consultation_status: 'not_converted',
    } as any).eq('id', patientId);

    if (error) {
      toast({ title: 'Error', description: 'Failed to update status.', variant: 'destructive' });
    } else {
      toast({ title: 'Marked Not Converted', description: 'Patient moved to Not Converted section.' });
      fetchAll();
    }
  };

  if (loading) {
    return (
      <PageContainer maxWidth="full">
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </PageContainer>
    );
  }

  const totalCount = pendingReview.length + awaitingConsultation.length + consulted.length + notConverted.length;

  return (
    <PageContainer maxWidth="full">
      <div className="flex items-center justify-between mb-4">
        <PageHeader title="New Patient Registrations" />
        <TabletButton onClick={() => navigate('/register')} leftIcon={<Plus />}>
          Manual Entry
        </TabletButton>
      </div>

      {totalCount === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <UserCheck className="h-12 w-12 mb-4 opacity-50" />
          <p>No new patients pending review.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Section 1: Pending Review */}
          {pendingReview.length > 0 && (
            <Section
              title="Pending Doctor Review"
              icon={<Clock className="h-5 w-5 text-warning" />}
              count={pendingReview.length}
            >
              {pendingReview.map((p) => (
                <TabletCard
                  key={p.id}
                  className="cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => navigate(`/patient/${p.id}/review`)}
                >
                  <TabletCardContent className="flex items-center justify-between py-4">
                    <div>
                      <p className="font-medium text-foreground">{p.full_name}</p>
                      <p className="text-sm text-muted-foreground flex items-center gap-2">{p.phone_number} <WhatsAppLink phone={p.phone_number} iconSize="h-3.5 w-3.5" /></p>
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
            </Section>
          )}

          {/* Section 2: Awaiting Consultation */}
          {awaitingConsultation.length > 0 && (
            <Section
              title="Awaiting Consultation"
              icon={<Stethoscope className="h-5 w-5 text-primary" />}
              count={awaitingConsultation.length}
            >
              {awaitingConsultation.map((p) => (
                <TabletCard
                  key={p.id}
                  className="cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => setConsultationPatient(p)}
                >
                  <TabletCardContent className="flex items-center justify-between py-4">
                    <div>
                      <p className="font-medium text-foreground">{p.full_name}</p>
                      <p className="text-sm text-muted-foreground flex items-center gap-2">{p.phone_number} <WhatsAppLink phone={p.phone_number} iconSize="h-3.5 w-3.5" /></p>
                      <div className="flex items-center gap-2 mt-1">
                        {p.nationality && <Badge variant="outline" className="text-xs">{p.nationality}</Badge>}
                        {p.gender && <Badge variant="outline" className="text-xs">{p.gender}</Badge>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Stethoscope className="h-4 w-4 text-primary" />
                      <span className="text-sm text-primary font-medium">Awaiting Consultation</span>
                    </div>
                  </TabletCardContent>
                </TabletCard>
              ))}
            </Section>
          )}

          {/* Section 3: Consulted — Converted or Not? */}
          {consulted.length > 0 && (
            <Section
              title="Consulted — Awaiting Conversion"
              icon={<CheckCircle2 className="h-5 w-5 text-success" />}
              count={consulted.length}
            >
              {consulted.map((p) => (
                <TabletCard key={p.id}>
                  <TabletCardContent className="flex items-center justify-between py-4">
                    <div>
                      <p className="font-medium text-foreground">{p.full_name}</p>
                      <p className="text-sm text-muted-foreground flex items-center gap-2">{p.phone_number} <WhatsAppLink phone={p.phone_number} iconSize="h-3.5 w-3.5" /></p>
                      <div className="flex items-center gap-2 mt-1">
                        {p.treatment_interests && (p.treatment_interests as string[]).map((t: string) => (
                          <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                        ))}
                      </div>
                      {(p as any).consultation_doctor?.full_name && (
                        <p className="text-xs text-muted-foreground mt-1">
                          By Dr. {(p as any).consultation_doctor.full_name}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <TabletButton
                        size="sm"
                        variant="default"
                        onClick={() => handleMarkConverted(p.id)}
                        leftIcon={<PackageCheck className="h-4 w-4" />}
                      >
                        Converted
                      </TabletButton>
                      <TabletButton
                        size="sm"
                        variant="outline"
                        onClick={() => handleMarkNotConverted(p.id)}
                        leftIcon={<XCircle className="h-4 w-4" />}
                      >
                        Not Converted
                      </TabletButton>
                    </div>
                  </TabletCardContent>
                </TabletCard>
              ))}
            </Section>
          )}

          {/* Section 4: Not Converted */}
          {notConverted.length > 0 && (
            <Section
              title="Not Converted"
              icon={<XCircle className="h-5 w-5 text-destructive" />}
              count={notConverted.length}
            >
              {notConverted.map((p) => (
                <TabletCard key={p.id}>
                  <TabletCardContent className="flex items-center justify-between py-4">
                    <div>
                      <p className="font-medium text-foreground">{p.full_name}</p>
                      <p className="text-sm text-muted-foreground flex items-center gap-2">{p.phone_number} <WhatsAppLink phone={p.phone_number} iconSize="h-3.5 w-3.5" /></p>
                      <div className="flex items-center gap-2 mt-1">
                        {p.treatment_interests && (p.treatment_interests as string[]).map((t: string) => (
                          <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                        ))}
                      </div>
                      {(p as any).consultation_doctor?.full_name && (
                        <p className="text-xs text-muted-foreground mt-1">
                          By Dr. {(p as any).consultation_doctor.full_name}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <TabletButton
                        size="sm"
                        variant="default"
                        onClick={() => handleMarkConverted(p.id)}
                        leftIcon={<PackageCheck className="h-4 w-4" />}
                      >
                        Convert Now
                      </TabletButton>
                    </div>
                  </TabletCardContent>
                </TabletCard>
              ))}
            </Section>
          )}
        </div>
      )}

      {consultationPatient && (
        <ConsultationModal
          open={!!consultationPatient}
          onOpenChange={(open) => { if (!open) setConsultationPatient(null); }}
          patient={consultationPatient}
          onComplete={fetchAll}
        />
      )}
    </PageContainer>
  );
}

function Section({ title, icon, count, children }: { title: string; icon: React.ReactNode; count: number; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h2 className="text-lg font-semibold">{title}</h2>
        <Badge variant="outline" className="ml-1">{count}</Badge>
      </div>
      <div className="space-y-3">
        {children}
      </div>
    </div>
  );
}
