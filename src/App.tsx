import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";

// Pages
import Login from "./pages/Login";
import PatientSearch from "./pages/PatientSearch";
import PatientRegistration from "./pages/PatientRegistration";
import PatientDashboard from "./pages/PatientDashboard";
import WaitingArea from "./pages/WaitingArea";
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

// Protected route wrapper
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
    // Redirect to appropriate dashboard based on role
    if (staff.role === 'reception') {
      return <Navigate to="/patients" replace />;
    }
    return <Navigate to="/waiting" replace />;
  }

  return <>{children}</>;
}

// Public route that redirects if authenticated
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, staff } = useAuth();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (isAuthenticated && staff) {
    // Redirect based on role
    if (staff.role === 'admin' || staff.role === 'reception') {
      return <Navigate to="/patients" replace />;
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
    return <Navigate to="/patients" replace />;
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
      
      <Route path="/patient/:patientId" element={
        <ProtectedRoute allowedRoles={['admin', 'reception']}>
          <PatientDashboard />
        </ProtectedRoute>
      } />
      
      {/* Clinical routes */}
      <Route path="/waiting" element={
        <ProtectedRoute allowedRoles={['admin', 'nurse', 'doctor']}>
          <WaitingArea />
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
