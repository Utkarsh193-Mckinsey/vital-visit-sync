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
  Package as PackageIcon
} from 'lucide-react';
import type { Patient, Package, Treatment } from '@/types/database';
import AddPackageModal from '@/components/patient/AddPackageModal';

interface PackageWithTreatment extends Package {
  treatment: Treatment;
}

export default function PatientDashboard() {
  const { patientId } = useParams<{ patientId: string }>();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [packages, setPackages] = useState<PackageWithTreatment[]>([]);
  const [nextVisitNumber, setNextVisitNumber] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddPackage, setShowAddPackage] = useState(false);
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
    if (packages.length === 0) {
      toast({
        title: 'No Active Packages',
        description: 'Please add a treatment package before starting a visit.',
        variant: 'destructive',
      });
      return;
    }
    navigate(`/patient/${patientId}/consent`);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-AE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

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

      {/* Patient Info Card */}
      <TabletCard className="mb-6">
        <TabletCardContent className="p-5">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-center gap-3">
              <Phone className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Phone</p>
                <p className="font-medium">{patient.phone_number}</p>
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
          Sign Consent & Start Visit
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
      />
    </PageContainer>
  );
}
