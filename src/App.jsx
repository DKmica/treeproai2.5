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
        <Route path="/sales" element={<Sales />} />
      </Route>
      <Route path="/estimate" element={<PublicEstimate />} />
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