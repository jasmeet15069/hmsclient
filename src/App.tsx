import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import AuthPage from "./pages/AuthPage";
import GuestServicesPage from "./pages/GuestServicesPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const STAFF_ROLES = ['super_admin', 'admin', 'food_manager', 'kitchen_manager', 'waiter'];

function GuestRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, hasAnyRole } = useAuth();
  
  if (loading) return null;
  if (!user) return <Navigate to="/client-login" replace />;
  if (hasAnyRole(STAFF_ROLES)) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/client-login" replace />} />
      <Route path="/auth" element={<Navigate to="/client-login" replace />} />
      <Route path="/client-login" element={<AuthPage portal="client" />} />
      <Route path="/guest" element={<GuestRoute><GuestServicesPage /></GuestRoute>} />
      
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
