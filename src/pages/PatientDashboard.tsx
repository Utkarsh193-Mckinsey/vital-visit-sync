import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { TabletButton } from '@/components/ui/tablet-button';
import { TabletCard, TabletCardContent, TabletCardHeader, TabletCardTitle } from '@/components/ui/tablet-card';
import { PageContainer, PageHeader } from '@/components/layout/PageContainer';
import { useToast } from '@/hooks/use-toast';
import { 
  ArrowLeft, 
  Plus, 
  FileSignature, 
  History, 
  Phone, 
  Mail, 
  Calendar,
  Package as PackageIcon,
  Clock,
  Activity,
  CheckCircle,
  UserCheck
} from 'lucide-react';
import type { Patient, Package, Treatment, Visit } from '@/types/database';
import AddPackageModal from '@/components/patient/AddPackageModal';
import TreatmentSelectionModal from '@/components/patient/TreatmentSelectionModal';
import PatientProgress from '@/components/patient/PatientProgress';
import { WhatsAppLink } from '@/components/ui/whatsapp-link';
import { CautionBanner } from '@/components/patient/CautionBanner';

interface PackageWithTreatment extends Package {
  treatment: Treatment;
  consulting_doctor?: { full_name: string } | null;
}

interface VisitWithDetails extends Visit {
  nurse_staff?: { full_name: string } | null;
  doctor_staff?: { full_name: string } | null;
}

export default function PatientDashboard() {
  const { patientId } = useParams<{ patientId: string }>();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [packages, setPackages] = useState<PackageWithTreatment[]>([]);
  const [allPackages, setAllPackages] = useState<PackageWithTreatment[]>([]);
  const [activeVisits, setActiveVisits] = useState<VisitWithDetails[]>([]);
  const [nextVisitNumber, setNextVisitNumber] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [contraindicatedTreatmentNames, setContraindicatedTreatmentNames] = useState<string[]>([]);
  const [showAddPackage, setShowAddPackage] = useState(false);
  const [showTreatmentSelection, setShowTreatmentSelection] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { staff } = useAuth();

  const fetchPatientData = async () => {
    if (!patientId) return;

    try {
      // Fetch patient
      const { data: patientData, error: patientError } = await supabase
        .from('patients')
        .select('*')
        .eq('id', patientId)
        .single();

      if (patientError) throw patientError;
      setPatient(patientData as Patient);

      // Resolve contraindicated treatment names
      const cIds = (patientData as any)?.contraindicated_treatments as string[] | null;
      if (cIds && cIds.length > 0) {
        const { data: cTreatments } = await supabase
          .from('treatments')
          .select('treatment_name')
          .in('id', cIds);
        setContraindicatedTreatmentNames(cTreatments?.map(t => t.treatment_name) || []);
      } else {
        setContraindicatedTreatmentNames([]);
      }

      // Fetch packages with treatments
      const { data: packagesData, error: packagesError } = await supabase
        .from('packages')
        .select(`
          *,
          treatment:treatments (*)
        `)
        .eq('patient_id', patientId)
        .eq('status', 'active')
        .order('purchase_date', { ascending: false });

      if (packagesError) throw packagesError;
      setPackages(packagesData as unknown as PackageWithTreatment[]);

      // Fetch active visits (not completed)
      const { data: visitsData, error: visitsError } = await supabase
        .from('visits')
        .select(`
          *,
          nurse_staff:staff!visits_nurse_staff_id_fkey (full_name),
          doctor_staff:staff!visits_doctor_staff_id_fkey (full_name)
        `)
        .eq('patient_id', patientId)
        .order('visit_date', { ascending: false })
        .limit(10);

      if (visitsError) throw visitsError;
      setActiveVisits(visitsData as unknown as VisitWithDetails[]);

      // Get next visit number
      const { data: visitData } = await supabase
        .from('visits')
        .select('visit_number')
        .eq('patient_id', patientId)
        .order('visit_number', { ascending: false })
        .limit(1)
        .single();

      setNextVisitNumber((visitData?.visit_number || 0) + 1);

    } catch (error) {
      console.error('Error fetching patient:', error);
      toast({
        title: 'Error',
        description: 'Failed to load patient data.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPatientData();
  }, [patientId]);

  const handlePackageAdded = () => {
    setShowAddPackage(false);
    fetchPatientData();
    toast({
      title: 'Package Added',
      description: 'The treatment package has been added successfully.',
    });
  };

  const handleStartVisit = () => {
    // Check if patient already has an active (waiting or in_progress) visit
    const activeVisit = activeVisits.find(v => v.current_status === 'waiting' || v.current_status === 'in_progress');
    if (activeVisit) {
      toast({
        title: 'Active Visit Exists',
        description: `Visit #${activeVisit.visit_number} is still ${activeVisit.current_status === 'waiting' ? 'waiting' : 'in progress'}. Please complete it before starting a new visit.`,
        variant: 'destructive',
      });
      return;
    }

    if (packages.length === 0) {
      toast({
        title: 'No Active Packages',
        description: 'Please add a treatment package before starting a visit.',
        variant: 'destructive',
      });
      return;
    }
    // Show treatment selection modal first
    setShowTreatmentSelection(true);
  };

  const handleTreatmentSelected = (selectedPackageIds: string[]) => {
    setShowTreatmentSelection(false);
    // Navigate to consent with selected packages
    const params = new URLSearchParams();
    params.set('packages', selectedPackageIds.join(','));
    navigate(`/patient/${patientId}/consent?${params.toString()}`);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-AE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-AE', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getWaitingTime = (dateString: string) => {
    const diff = Date.now() - new Date(dateString).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  };

  const getStatusBadge = (visit: VisitWithDetails) => {
    if (visit.current_status === 'completed') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-1 text-xs font-medium text-success">
          <CheckCircle className="h-3 w-3" />
          Completed
        </span>
      );
    }
    if (visit.current_status === 'in_progress') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
          <Activity className="h-3 w-3" />
          In Progress
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-warning/10 px-2.5 py-1 text-xs font-medium text-warning">
        <Clock className="h-3 w-3" />
        Waiting ({getWaitingTime(visit.visit_date)})
      </span>
    );
  };

  // Categorize visits
  const waitingVisits = activeVisits.filter(v => v.current_status === 'waiting');
  const inProgressVisits = activeVisits.filter(v => v.current_status === 'in_progress');
  const completedVisits = activeVisits.filter(v => v.current_status === 'completed');

  if (isLoading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-muted-foreground">Loading patient...</p>
          </div>
        </div>
      </PageContainer>
    );
  }

  if (!patient) {
    return (
      <PageContainer>
        <div className="text-center py-16">
          <h2 className="text-xl font-semibold">Patient not found</h2>
          <TabletButton 
            className="mt-4" 
            onClick={() => navigate('/patients')}
          >
            Back to Search
          </TabletButton>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer maxWidth="lg">
      <PageHeader 
        title={patient.full_name}
        subtitle={`Next Visit: #${nextVisitNumber}`}
        backButton={
          <TabletButton 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate('/patients')}
            aria-label="Back to search"
          >
            <ArrowLeft className="h-5 w-5" />
          </TabletButton>
        }
      />

      {/* Caution Banner */}
      <CautionBanner
        cautionNotes={(patient as any)?.caution_notes}
        contraindicatedTreatmentNames={contraindicatedTreatmentNames}
      />

      {/* Patient Info Card */}
      <TabletCard className="mb-6">
        <TabletCardContent className="p-5">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-center gap-3">
              <Phone className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Phone</p>
                <p className="font-medium flex items-center gap-2">{patient.phone_number} <WhatsAppLink phone={patient.phone_number} /></p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{patient.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Date of Birth</p>
                <p className="font-medium">{formatDate(patient.date_of_birth)}</p>
              </div>
            </div>
          </div>
        </TabletCardContent>
      </TabletCard>

      {/* Action Buttons */}
      <div className="grid gap-4 mb-6 md:grid-cols-3">
        <TabletButton
          variant="outline"
          fullWidth
          onClick={() => setShowAddPackage(true)}
          leftIcon={<Plus />}
        >
          Add New Package
        </TabletButton>
        
        <TabletButton
          variant="default"
          fullWidth
          onClick={handleStartVisit}
          leftIcon={<FileSignature />}
        >
          Start New Visit
        </TabletButton>
        
        <TabletButton
          variant="secondary"
          fullWidth
          onClick={() => navigate(`/patient/${patientId}/history`)}
          leftIcon={<History />}
        >
          View Visit History
        </TabletButton>
      </div>

      {/* Patient Progress Analytics */}
      <div className="mb-6">
        <PatientProgress patientId={patientId!} />
      </div>

      {/* Visit Status Sections */}
      {(waitingVisits.length > 0 || inProgressVisits.length > 0) && (
        <TabletCard className="mb-6">
          <TabletCardHeader>
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              <TabletCardTitle>Active Visits</TabletCardTitle>
            </div>
          </TabletCardHeader>
          <TabletCardContent className="space-y-4">
            {/* Waiting */}
            {waitingVisits.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Waiting ({waitingVisits.length})
                </h4>
                <div className="space-y-2">
                  {waitingVisits.map(visit => (
                    <div key={visit.id} className="flex items-center justify-between p-3 rounded-lg bg-warning/5 border border-warning/20">
                      <div>
                        <span className="font-medium">Visit #{visit.visit_number}</span>
                        <span className="text-sm text-muted-foreground ml-2">
                          {formatTime(visit.visit_date)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(visit)}
                        {staff?.role === 'nurse' && !visit.vitals_completed && (
                          <TabletButton size="sm" onClick={() => navigate(`/visit/${visit.id}/vitals`)}>
                            Take Vitals
                          </TabletButton>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* In Progress */}
            {inProgressVisits.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  In Treatment ({inProgressVisits.length})
                </h4>
                <div className="space-y-2">
                  {inProgressVisits.map(visit => (
                    <div key={visit.id} className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/20">
                      <div>
                        <span className="font-medium">Visit #{visit.visit_number}</span>
                        {visit.nurse_staff && (
                          <span className="text-sm text-muted-foreground ml-2">
                            Vitals by {visit.nurse_staff.full_name}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(visit)}
                        {(staff?.role === 'doctor' || staff?.role === 'admin') && (
                          <TabletButton size="sm" onClick={() => navigate(`/visit/${visit.id}/treatment`)}>
                            Administer Treatment
                          </TabletButton>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabletCardContent>
        </TabletCard>
      )}

      {/* Recent Completed Visits */}
      {completedVisits.length > 0 && (
        <TabletCard className="mb-6">
          <TabletCardHeader>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-success" />
              <TabletCardTitle>Recent Completed</TabletCardTitle>
            </div>
          </TabletCardHeader>
          <TabletCardContent>
            <div className="space-y-2">
              {completedVisits.slice(0, 3).map(visit => (
                <div key={visit.id} className="flex items-center justify-between p-3 rounded-lg bg-success/5 border border-success/20">
                  <div>
                    <span className="font-medium">Visit #{visit.visit_number}</span>
                    <span className="text-sm text-muted-foreground ml-2">
                      {formatDate(visit.completed_date || visit.visit_date)}
                    </span>
                  </div>
                  {getStatusBadge(visit)}
                </div>
              ))}
            </div>
          </TabletCardContent>
        </TabletCard>
      )}

      {/* Active Packages */}
      <TabletCard>
        <TabletCardHeader>
          <div className="flex items-center gap-2">
            <PackageIcon className="h-5 w-5" />
            <TabletCardTitle>Active Packages</TabletCardTitle>
          </div>
        </TabletCardHeader>
        <TabletCardContent>
          {packages.length === 0 ? (
            <div className="text-center py-8">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <PackageIcon className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium">No Active Packages</h3>
              <p className="mt-2 text-muted-foreground">
                Add a treatment package to get started.
              </p>
              <TabletButton
                className="mt-4"
                onClick={() => setShowAddPackage(true)}
                leftIcon={<Plus />}
              >
                Add Package
              </TabletButton>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {packages.map((pkg) => (
                <div 
                  key={pkg.id}
                  className="rounded-xl border bg-secondary/30 p-4"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-semibold">{pkg.treatment.treatment_name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {pkg.treatment.category}
                      </p>
                    </div>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      pkg.payment_status === 'paid' 
                        ? 'bg-success/10 text-success' 
                        : 'bg-warning/10 text-warning'
                    }`}>
                      {pkg.payment_status === 'paid' ? 'Paid' : 'Pending'}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <div>
                      <span className="text-2xl font-bold">{pkg.sessions_remaining}</span>
                      <span className="text-muted-foreground">/{pkg.sessions_purchased} sessions</span>
                    </div>
                    <div className="h-2 w-24 rounded-full bg-muted overflow-hidden">
                      <div 
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ 
                          width: `${(pkg.sessions_remaining / pkg.sessions_purchased) * 100}%` 
                        }}
                      />
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Purchased: {formatDate(pkg.purchase_date)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </TabletCardContent>
      </TabletCard>

      {/* Add Package Modal */}
      <AddPackageModal
        open={showAddPackage}
        onOpenChange={setShowAddPackage}
        patientId={patientId!}
        onSuccess={handlePackageAdded}
        contraindicatedTreatmentIds={(patient as any)?.contraindicated_treatments || []}
        hasExistingPackages={packages.length > 0}
      />

      {/* Treatment Selection Modal */}
      <TreatmentSelectionModal
        open={showTreatmentSelection}
        onOpenChange={setShowTreatmentSelection}
        patientId={patientId!}
        onConfirm={handleTreatmentSelected}
      />
    </PageContainer>
  );
}
