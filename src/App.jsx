import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

import Layout from '@/components/Layout';
import Dashboard from '@/pages/Dashboard';
import Leads from '@/pages/Leads';
import Customers from '@/pages/Customers';
import Quotes from '@/pages/Quotes';
import Jobs from '@/pages/Jobs';
import Equipment from '@/pages/Equipment';
import Analytics from '@/pages/Analytics';
import TreeAssessment from '@/pages/TreeAssessment';
import Sales from '@/pages/Sales';
import PublicEstimate from '@/pages/PublicEstimate';
import Employees from '@/pages/Employees';
import CompanySettings from '@/pages/CompanySettings';
import Invoices from '@/pages/Invoices';
import CrewMode from '@/pages/CrewMode';
import AIAnalysis from '@/pages/AIAnalysis';
import ProductionReadiness from '@/pages/ProductionReadiness';
import Notifications from '@/pages/Notifications';
import QuoteDetail from '@/pages/QuoteDetail';
import CustomerPortal from '@/pages/CustomerPortal';
import TreeInventory from '@/pages/TreeInventory';
import EquipmentMaintenance from '@/pages/EquipmentMaintenance';
import Integrations from '@/pages/Integrations';
import AuditLogPage from '@/pages/AuditLog';
import AIInsights from '@/pages/AIInsights';
import WhiteLabel from '@/pages/WhiteLabel';
import WidgetSettings from '@/pages/WidgetSettings';
import APIKeys from '@/pages/APIKeys';
import Webhooks from '@/pages/Webhooks';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/leads" element={<Leads />} />
        <Route path="/customers" element={<Customers />} />
        <Route path="/quotes" element={<Quotes />} />
        <Route path="/jobs" element={<Jobs />} />
        <Route path="/equipment" element={<Equipment />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/tree-assessment" element={<TreeAssessment />} />
        <Route path="/employees" element={<Employees />} />
        <Route path="/sales" element={<Sales />} />
        <Route path="/settings" element={<CompanySettings />} />
        <Route path="/invoices" element={<Invoices />} />
        <Route path="/crew-mode" element={<CrewMode />} />
        <Route path="/ai-analysis" element={<AIAnalysis />} />
        <Route path="/production-readiness" element={<ProductionReadiness />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/quotes/:id" element={<QuoteDetail />} />
        <Route path="/tree-inventory" element={<TreeInventory />} />
        <Route path="/maintenance" element={<EquipmentMaintenance />} />
        <Route path="/integrations" element={<Integrations />} />
        <Route path="/audit-log" element={<AuditLogPage />} />
        <Route path="/white-label" element={<WhiteLabel />} />
        <Route path="/widget-settings" element={<WidgetSettings />} />
        <Route path="/api-keys" element={<APIKeys />} />
        <Route path="/webhooks" element={<Webhooks />} />
        <Route path="/ai-insights" element={<AIInsights />} />
      </Route>
      <Route path="/estimate" element={<PublicEstimate />} />
      <Route path="/portal/:token" element={<CustomerPortal />} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App