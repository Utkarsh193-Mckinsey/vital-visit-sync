import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";

// Pages
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Analytics from "./pages/Analytics";
import PatientSearch from "./pages/PatientSearch";
import PatientRegistration from "./pages/PatientRegistration";
import AddExistingPatient from "./pages/AddExistingPatient";
import PatientDashboard from "./pages/PatientDashboard";
import ConsentSigning from "./pages/ConsentSigning";
import VisitHistory from "./pages/VisitHistory";
import WaitingArea from "./pages/WaitingArea";
import InTreatment from "./pages/InTreatment";
import CompletedToday from "./pages/CompletedToday";
import VitalsEntry from "./pages/VitalsEntry";
import TreatmentAdmin from "./pages/TreatmentAdmin";
import AdminSettings from "./pages/AdminSettings";
import TreatmentsPage from "./pages/TreatmentsPage";
import PatientReview from "./pages/PatientReview";
import NewPatients from "./pages/NewPatients";
import Appointments from "./pages/Appointments";
import NoShow from "./pages/NoShow";
import Rescheduled from "./pages/Rescheduled";
import PersonalAssistant from "./pages/PersonalAssistant";
import WhatsAppChats from "./pages/WhatsAppChats";
import BookNextAppointment from "./pages/BookNextAppointment";
import StaffReports from "./pages/StaffReports";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Loading spinner component
function LoadingSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}

// Protected route wrapper with layout
function ProtectedRoute({ 
  children, 
  allowedRoles 
}: { 
  children: React.ReactNode;
  allowedRoles?: ('admin' | 'reception' | 'nurse' | 'doctor')[];
}) {
  const { isAuthenticated, isLoading, staff } = useAuth();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && staff && !allowedRoles.includes(staff.role)) {
    if (staff.role === 'reception') {
      return <Navigate to="/dashboard" replace />;
    }
    return <Navigate to="/waiting" replace />;
  }

  return <AppLayout>{children}</AppLayout>;
}

// Public route that redirects if authenticated
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, staff } = useAuth();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (isAuthenticated && staff) {
    if (staff.role === 'admin' || staff.role === 'reception') {
      return <Navigate to="/dashboard" replace />;
    }
    return <Navigate to="/waiting" replace />;
  }

  return <>{children}</>;
}

// Root redirect based on role
function RootRedirect() {
  const { isAuthenticated, isLoading, staff } = useAuth();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (staff?.role === 'admin' || staff?.role === 'reception') {
    return <Navigate to="/dashboard" replace />;
  }

  return <Navigate to="/waiting" replace />;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Root redirect */}
      <Route path="/" element={<RootRedirect />} />
      
      {/* Public routes */}
      <Route path="/login" element={
        <PublicRoute>
          <Login />
        </PublicRoute>
      } />
      
      {/* Dashboard */}
      <Route path="/dashboard" element={
        <ProtectedRoute allowedRoles={['admin', 'reception']}>
          <Dashboard />
        </ProtectedRoute>
      } />

      <Route path="/analytics" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <Analytics />
        </ProtectedRoute>
      } />

      {/* Reception & Admin routes */}
      <Route path="/patients" element={
        <ProtectedRoute allowedRoles={['admin', 'reception']}>
          <PatientSearch />
        </ProtectedRoute>
      } />
      
      <Route path="/patient/register" element={
        <ProtectedRoute allowedRoles={['admin', 'reception']}>
          <PatientRegistration />
        </ProtectedRoute>
      } />

      <Route path="/patient/add-existing" element={
        <ProtectedRoute allowedRoles={['admin', 'reception']}>
          <AddExistingPatient />
        </ProtectedRoute>
      } />
      <Route path="/patient/:patientId" element={
        <ProtectedRoute allowedRoles={['admin', 'reception']}>
          <PatientDashboard />
        </ProtectedRoute>
      } />

      <Route path="/patient/:patientId/review" element={
        <ProtectedRoute allowedRoles={['admin', 'doctor']}>
          <PatientReview />
        </ProtectedRoute>
      } />

      <Route path="/patient/:patientId/consent" element={
        <ProtectedRoute allowedRoles={['admin', 'reception']}>
          <ConsentSigning />
        </ProtectedRoute>
      } />

      <Route path="/patient/:patientId/history" element={
        <ProtectedRoute allowedRoles={['admin', 'reception', 'nurse', 'doctor']}>
          <VisitHistory />
        </ProtectedRoute>
      } />
      
      <Route path="/new-patients" element={
        <ProtectedRoute allowedRoles={['admin', 'doctor']}>
          <NewPatients />
        </ProtectedRoute>
      } />

      {/* Clinical routes */}
      <Route path="/waiting" element={
        <ProtectedRoute allowedRoles={['admin', 'nurse', 'doctor', 'reception']}>
          <WaitingArea />
        </ProtectedRoute>
      } />

      <Route path="/in-treatment" element={
        <ProtectedRoute allowedRoles={['admin', 'nurse', 'doctor']}>
          <InTreatment />
        </ProtectedRoute>
      } />

      <Route path="/completed" element={
        <ProtectedRoute allowedRoles={['admin', 'nurse', 'doctor']}>
          <CompletedToday />
        </ProtectedRoute>
      } />

      <Route path="/visit/:visitId/vitals" element={
        <ProtectedRoute allowedRoles={['admin', 'nurse', 'doctor']}>
          <VitalsEntry />
        </ProtectedRoute>
      } />

      <Route path="/visit/:visitId/treatment" element={
        <ProtectedRoute allowedRoles={['admin', 'doctor']}>
          <TreatmentAdmin />
        </ProtectedRoute>
      } />

      {/* Admin routes */}
      <Route path="/appointments" element={
        <ProtectedRoute allowedRoles={['admin', 'reception']}>
          <Appointments />
        </ProtectedRoute>
      } />

      <Route path="/no-show" element={
        <ProtectedRoute allowedRoles={['admin', 'reception']}>
          <NoShow />
        </ProtectedRoute>
      } />

      <Route path="/rescheduled" element={
        <ProtectedRoute allowedRoles={['admin', 'reception']}>
          <Rescheduled />
        </ProtectedRoute>
      } />

      <Route path="/book-next" element={
        <ProtectedRoute allowedRoles={['admin', 'reception']}>
          <BookNextAppointment />
        </ProtectedRoute>
      } />

      <Route path="/assistant" element={
        <ProtectedRoute allowedRoles={['admin', 'reception']}>
          <PersonalAssistant />
        </ProtectedRoute>
      } />

      <Route path="/whatsapp" element={
        <ProtectedRoute allowedRoles={['admin', 'reception']}>
          <WhatsAppChats />
        </ProtectedRoute>
      } />

      <Route path="/treatments" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <TreatmentsPage />
        </ProtectedRoute>
      } />

      <Route path="/settings" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <AdminSettings />
        </ProtectedRoute>
      } />

      <Route path="/staff-reports" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <StaffReports />
        </ProtectedRoute>
      } />

      {/* Catch-all */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
