import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { AppLayout } from "@/components/layout/AppLayout";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";
import Auth from "@/pages/Auth";
import OwnerDashboard from "@/pages/owner/OwnerDashboard";
import OwnerProperties from "@/pages/owner/OwnerProperties";
import OwnerServices from "@/pages/owner/OwnerServices";
import OwnerIssues from "@/pages/owner/OwnerIssues";
import OwnerPayments from "@/pages/owner/OwnerPayments";
import OwnerArrivals from "@/pages/owner/OwnerArrivals";
import OwnerMessages from "@/pages/owner/OwnerMessages";
import OwnerInspections from "@/pages/owner/OwnerInspections";
import OwnerSettings from "@/pages/owner/OwnerSettings";
import ManagerDashboard from "@/pages/manager/ManagerDashboard";
import ManagerActions from "@/pages/manager/ManagerActions";
import ManagerVendors from "@/pages/manager/ManagerVendors";
import ManagerProperties from "@/pages/manager/ManagerProperties";
import ManagerOwners from "@/pages/manager/ManagerOwners";
import ManagerRequests from "@/pages/manager/ManagerRequests";
import ManagerSettings from "@/pages/manager/ManagerSettings";
import ManagerMessages from "@/pages/manager/ManagerMessages";
import ManagerPropertyDetail from "@/pages/manager/ManagerPropertyDetail";
import ManagerCalendar from "@/pages/manager/ManagerCalendar";
import ManagerInspections from "@/pages/manager/ManagerInspections";
import ManagerCleaningRecords from "@/pages/manager/ManagerCleaningRecords";
import ManagerReminders from "@/pages/manager/ManagerReminders";
import ManagerVendorTasks from "@/pages/manager/ManagerVendorTasks";
import VendorDashboard from "@/pages/vendor/VendorDashboard";
import AdminUsers from "@/pages/admin/AdminUsers";
import NotFound from "./pages/NotFound";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

const RoleRedirect = () => {
  const { user, loading: authLoading } = useAuth();
  const { role, loading: roleLoading } = useUserRole();

  if (authLoading || (user && roleLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  const isManager = role === 'manager' || role === 'admin';
  const isVendor = role === 'vendor';
  return <Navigate to={isManager ? "/manager" : isVendor ? "/vendor" : "/owner"} replace />;
};

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <InstallPrompt />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/" element={<RoleRedirect />} />
            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route path="/owner" element={<OwnerDashboard />} />
              <Route path="/owner/properties" element={<OwnerProperties />} />
              <Route path="/owner/services" element={<OwnerServices />} />
              <Route path="/owner/issues" element={<OwnerIssues />} />
              <Route path="/owner/payments" element={<OwnerPayments />} />
              <Route path="/owner/arrivals" element={<OwnerArrivals />} />
              <Route path="/owner/messages" element={<OwnerMessages />} />
              <Route path="/owner/inspections" element={<OwnerInspections />} />
              <Route path="/owner/settings" element={<OwnerSettings />} />
              <Route path="/manager" element={<ManagerDashboard />} />
              <Route path="/manager/owners" element={<ManagerOwners />} />
              <Route path="/manager/actions" element={<ManagerActions />} />
              <Route path="/manager/requests" element={<ManagerRequests />} />
              <Route path="/manager/calendar" element={<ManagerCalendar />} />
              <Route path="/manager/vendors" element={<ManagerVendors />} />
              <Route path="/manager/properties" element={<ManagerProperties />} />
              <Route path="/manager/properties/:id" element={<ManagerPropertyDetail />} />
              <Route path="/manager/settings" element={<ManagerSettings />} />
              <Route path="/manager/messages" element={<ManagerMessages />} />
              <Route path="/manager/inspections" element={<ManagerInspections />} />
              <Route path="/manager/cleaning" element={<ManagerCleaningRecords />} />
              <Route path="/manager/reminders" element={<ManagerReminders />} />
              <Route path="/manager/vendor-tasks" element={<ManagerVendorTasks />} />
              <Route path="/vendor" element={<VendorDashboard />} />
            </Route>
            <Route path="/admin/users" element={<ProtectedRoute><AdminUsers /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
