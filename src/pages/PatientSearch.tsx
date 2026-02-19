import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { TabletInput } from '@/components/ui/tablet-input';
import { TabletButton } from '@/components/ui/tablet-button';
import { TabletCard, TabletCardContent } from '@/components/ui/tablet-card';
import { PageContainer, PageHeader } from '@/components/layout/PageContainer';
import { useToast } from '@/hooks/use-toast';
import { Search, UserPlus, Phone, LogOut, Settings, Users, CreditCard, X, UserCheck } from 'lucide-react';
import EmiratesIdCapture, { ExtractedIdData } from '@/components/patient/EmiratesIdCapture';
import type { Patient, Package, Visit } from '@/types/database';
import { WhatsAppLink } from '@/components/ui/whatsapp-link';

interface PatientWithPackages extends Patient {
  packages: Package[];
  visits: Visit[];
}

// Normalize phone: strip +971, 00971, leading 0, spaces, dashes
function normalizePhone(phone: string): string {
  let p = phone.replace(/[\s\-()]/g, '');
  if (p.startsWith('+971')) p = p.slice(4);
  else if (p.startsWith('00971')) p = p.slice(5);
  if (p.startsWith('0')) p = p.slice(1);
  return p;
}

export default function PatientSearch() {
  const [searchQuery, setSearchQuery] = useState('');
  const [allPatients, setAllPatients] = useState<PatientWithPackages[]>([]);
  const [isLoadingPatients, setIsLoadingPatients] = useState(true);
  const [showIdScan, setShowIdScan] = useState(false);
  const { staff, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const fetchAllPatients = async () => {
    setIsLoadingPatients(true);
    const { data, error } = await supabase
      .from('patients')
      .select(`
        *,
        packages (
          *,
          treatment:treatments (*)
        ),
        visits (
          id,
          visit_number,
          current_status,
          visit_date
        )
      `)
      .eq('status', 'active')
      .or('consultation_status.eq.consulted,consultation_status.eq.converted,consultation_status.is.null')
      .order('registration_date', { ascending: false });

    if (!error && data) {
      setAllPatients(data as unknown as PatientWithPackages[]);
    }
    setIsLoadingPatients(false);
  };

  useEffect(() => {
    fetchAllPatients();
  }, []);

  // Client-side filtering by name, phone, or Emirates ID
  const filteredPatients = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return allPatients;

    const normalizedQ = normalizePhone(q);

    return allPatients.filter((patient) => {
      // Match by name
      if (patient.full_name.toLowerCase().includes(q)) return true;
      // Match by Emirates ID
      if (patient.emirates_id && patient.emirates_id.replace(/[\s\-]/g, '').toLowerCase().includes(q.replace(/[\s\-]/g, ''))) return true;
      // Match by phone (normalized)
      const normalizedPatientPhone = normalizePhone(patient.phone_number);
      if (normalizedPatientPhone.includes(normalizedQ)) return true;
      return false;
    });
  }, [searchQuery, allPatients]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      setShowIdScan(true);
    }
  };

  const handleIdScanned = (data: ExtractedIdData) => {
    setShowIdScan(false);
    // Search by extracted Emirates ID or name
    if (data.emirates_id) {
      setSearchQuery(data.emirates_id);
    } else if (data.full_name) {
      setSearchQuery(data.full_name);
    }
  };

  const handleNewPatient = () => {
    navigate('/patient/register');
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  if (showIdScan) {
    return (
      <PageContainer maxWidth="md">
        <PageHeader
          title="Scan Emirates ID"
          subtitle="Scan to find patient"
          action={
            <TabletButton variant="ghost" size="icon" onClick={() => setShowIdScan(false)} aria-label="Close">
              <X className="h-5 w-5" />
            </TabletButton>
          }
        />
        <EmiratesIdCapture
          onDataExtracted={(data) => handleIdScanned(data)}
          onSkip={() => setShowIdScan(false)}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer maxWidth="md">
      <PageHeader 
        title="Patient Check-In"
        subtitle={`Welcome, ${staff?.full_name}`}
        action={
          <div className="flex gap-2">
            {staff?.role === 'admin' && (
              <TabletButton 
                variant="ghost" 
                size="icon" 
                onClick={() => navigate('/settings')}
                aria-label="Settings"
              >
                <Settings className="h-5 w-5" />
              </TabletButton>
            )}
            <TabletButton 
              variant="ghost" 
              size="icon" 
              onClick={handleLogout}
              aria-label="Logout"
            >
              <LogOut className="h-5 w-5" />
            </TabletButton>
          </div>
        }
      />

      <form onSubmit={handleSearch} className="mb-6">
        <div className="flex gap-3">
          <div className="flex-1">
            <TabletInput
              type="text"
              placeholder="Search by name, phone, or Emirates ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="text-lg"
            />
          </div>
          <TabletButton 
            type="submit" 
            leftIcon={searchQuery.trim() ? <Search /> : <CreditCard />}
          >
            {searchQuery.trim() ? 'Search' : 'Scan ID'}
          </TabletButton>
        </div>
      </form>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <TabletButton
          variant="outline"
          fullWidth
          onClick={handleNewPatient}
          leftIcon={<UserPlus />}
        >
          New Patient Registration
        </TabletButton>
        <TabletButton
          variant="outline"
          fullWidth
          onClick={() => navigate('/patient/add-existing')}
          leftIcon={<UserCheck />}
        >
          Add Existing Patient
        </TabletButton>
      </div>

      {/* Patient List */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-muted-foreground mb-3">
          <Users className="h-4 w-4" />
          <span className="text-sm font-medium">
            {searchQuery.trim() ? `Results (${filteredPatients.length})` : `All Patients (${allPatients.length})`}
          </span>
        </div>

        {isLoadingPatients ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <p className="text-muted-foreground">Loading patients...</p>
            </div>
          </div>
        ) : filteredPatients.length === 0 ? (
          <TabletCard>
            <TabletCardContent className="p-8 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <Search className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium">
                {searchQuery.trim() ? 'No patients found' : 'No patients yet'}
              </h3>
              <p className="mt-2 text-muted-foreground">
                {searchQuery.trim()
                  ? `No patient matching "${searchQuery}" was found.`
                  : 'Register your first patient to get started.'}
              </p>
              {searchQuery.trim() && (
                <TabletButton
                  variant="default"
                  className="mt-4"
                  onClick={handleNewPatient}
                  leftIcon={<UserPlus />}
                >
                  Register New Patient
                </TabletButton>
              )}
            </TabletCardContent>
          </TabletCard>
        ) : (
          <div className="grid gap-3">
            {filteredPatients.map((patient) => {
              const activePackages = patient.packages?.filter(p => p.status === 'active') || [];
              const completedVisits = patient.visits?.filter(v => v.current_status === 'completed') || [];
              const totalVisits = patient.visits?.length || 0;
              const nextVisitNumber = totalVisits + 1;

              return (
                <TabletCard 
                  key={patient.id}
                  className="cursor-pointer hover:border-primary transition-colors"
                  onClick={() => navigate(`/patient/${patient.id}`)}
                >
                  <TabletCardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <h3 className="font-semibold">{patient.full_name}</h3>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          <span>{patient.phone_number}</span>
                          <WhatsAppLink phone={patient.phone_number} iconSize="h-3.5 w-3.5" />
                        </div>
                        {patient.emirates_id && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <CreditCard className="h-3 w-3" />
                            <span>{patient.emirates_id}</span>
                          </div>
                        )}
                      </div>
                      <div className="text-right space-y-1">
                        {activePackages.length > 0 && (
                          <span className="inline-flex items-center rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
                            {activePackages.length} pkg
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-3 text-xs">
                      <span className="text-muted-foreground">
                        {completedVisits.length} visit{completedVisits.length !== 1 ? 's' : ''} done
                      </span>
                      <span className="text-muted-foreground">•</span>
                      <span className="font-medium text-primary">
                        Next: Visit #{nextVisitNumber}
                      </span>
                    </div>
                  </TabletCardContent>
                </TabletCard>
              );
            })}
          </div>
        )}
      </div>
    </PageContainer>
  );
}