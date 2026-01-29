import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { TabletInput } from '@/components/ui/tablet-input';
import { TabletButton } from '@/components/ui/tablet-button';
import { TabletCard, TabletCardContent } from '@/components/ui/tablet-card';
import { PageContainer, PageHeader } from '@/components/layout/PageContainer';
import { useToast } from '@/hooks/use-toast';
import { Search, UserPlus, Phone, LogOut, Settings, Users } from 'lucide-react';
import type { Patient, Package, Visit } from '@/types/database';

interface PatientWithPackages extends Patient {
  packages: Package[];
  visits: Visit[];
}

export default function PatientSearch() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<PatientWithPackages | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [allPatients, setAllPatients] = useState<PatientWithPackages[]>([]);
  const [isLoadingPatients, setIsLoadingPatients] = useState(true);
  const { staff, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Fetch all patients on mount
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
      .order('full_name', { ascending: true });

    if (!error && data) {
      setAllPatients(data as unknown as PatientWithPackages[]);
    }
    setIsLoadingPatients(false);
  };

  useEffect(() => {
    fetchAllPatients();
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!phoneNumber.trim()) {
      toast({
        title: 'Enter phone number',
        description: 'Please enter a phone number to search.',
        variant: 'destructive',
      });
      return;
    }

    setIsSearching(true);
    setHasSearched(true);

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
      .eq('phone_number', phoneNumber.trim())
      .eq('status', 'active')
      .single();

    setIsSearching(false);

    if (error || !data) {
      setSearchResult(null);
      return;
    }

    setSearchResult(data as unknown as PatientWithPackages);
  };

  const handlePatientClick = () => {
    if (searchResult) {
      navigate(`/patient/${searchResult.id}`);
    }
  };

  const handleNewPatient = () => {
    navigate('/patient/register');
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const activePackages = searchResult?.packages?.filter(p => p.status === 'active') || [];
  const completedVisits = searchResult?.visits?.filter(v => v.current_status === 'completed') || [];
  const totalVisits = searchResult?.visits?.length || 0;
  const nextVisitNumber = totalVisits + 1;

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
              type="tel"
              placeholder="Enter phone number..."
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="text-lg"
            />
          </div>
          <TabletButton 
            type="submit" 
            isLoading={isSearching}
            leftIcon={<Search />}
          >
            Search
          </TabletButton>
        </div>
      </form>

      <TabletButton
        variant="outline"
        fullWidth
        onClick={handleNewPatient}
        leftIcon={<UserPlus />}
        className="mb-6"
      >
        New Patient Registration
      </TabletButton>

      {/* Search Results */}

      {hasSearched && !isSearching && (
        <div className="space-y-4">
          {searchResult ? (
            <TabletCard 
              className="cursor-pointer hover:border-primary transition-colors"
              onClick={handlePatientClick}
            >
              <TabletCardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <h3 className="text-xl font-semibold">{searchResult.full_name}</h3>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-4 w-4" />
                      <span>{searchResult.phone_number}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{searchResult.email}</p>
                  </div>
                  <div className="text-right space-y-2">
                    {activePackages.length > 0 && (
                      <span className="inline-flex items-center rounded-full bg-success/10 px-3 py-1 text-sm font-medium text-success">
                        {activePackages.length} Active Package{activePackages.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>

                {/* Visit History Summary */}
                <div className="mt-3 flex items-center gap-3 rounded-lg bg-primary/5 px-3 py-2">
                  <span className="text-sm font-medium text-primary">
                    {completedVisits.length} Visit{completedVisits.length !== 1 ? 's' : ''} Completed
                  </span>
                  <span className="text-muted-foreground">•</span>
                  <span className="text-sm font-semibold text-foreground">
                    Next: Visit #{nextVisitNumber}
                  </span>
                </div>

                {activePackages.length > 0 && (
                  <div className="mt-4 grid gap-2">
                    {activePackages.slice(0, 3).map((pkg) => (
                      <div 
                        key={pkg.id} 
                        className="flex items-center justify-between rounded-lg bg-secondary/50 px-3 py-2"
                      >
                        <span className="font-medium">{pkg.treatment?.treatment_name}</span>
                        <span className="text-sm text-muted-foreground">
                          {pkg.sessions_remaining}/{pkg.sessions_purchased} sessions
                        </span>
                      </div>
                    ))}
                    {activePackages.length > 3 && (
                      <p className="text-center text-sm text-muted-foreground">
                        +{activePackages.length - 3} more packages
                      </p>
                    )}
                  </div>
                )}
              </TabletCardContent>
            </TabletCard>
          ) : (
            <TabletCard>
              <TabletCardContent className="p-8 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                  <Search className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium">No patient found</h3>
                <p className="mt-2 text-muted-foreground">
                  No patient with phone number "{phoneNumber}" was found.
                </p>
                <TabletButton
                  variant="default"
                  className="mt-4"
                  onClick={handleNewPatient}
                  leftIcon={<UserPlus />}
                >
                  Register New Patient
                </TabletButton>
              </TabletCardContent>
            </TabletCard>
          )}
        </div>
      )}

      {/* All Patients List */}
      {!hasSearched && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-3">
            <Users className="h-4 w-4" />
            <span className="text-sm font-medium">
              All Patients ({allPatients.length})
            </span>
          </div>

          {isLoadingPatients ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                <p className="text-muted-foreground">Loading patients...</p>
              </div>
            </div>
          ) : allPatients.length === 0 ? (
            <TabletCard>
              <TabletCardContent className="p-8 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                  <Users className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium">No patients yet</h3>
                <p className="mt-2 text-muted-foreground">
                  Register your first patient to get started.
                </p>
              </TabletCardContent>
            </TabletCard>
          ) : (
            <div className="grid gap-3">
              {allPatients.map((patient) => {
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
                          </div>
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
      )}
    </PageContainer>
  );
}
