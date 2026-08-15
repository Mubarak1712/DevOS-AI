import { Suspense, lazy } from 'react';
import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { PublicLayout, DashboardLayout } from '@/components/layout';

import {
  LandingPage,
  FeaturesPage,
  AboutPage,
  ContactPage,
  LoginPage,
  RegisterPage,
  ForgotPasswordPage,
} from '@/pages';

const DashboardPage = lazy(() => import('@/pages/dashboard').then((m) => ({ default: m.DashboardPage })));
const ProjectsPage = lazy(() => import('@/pages/dashboard').then((m) => ({ default: m.ProjectsPage })));
const GitHubPage = lazy(() => import('@/pages/dashboard').then((m) => ({ default: m.GitHubPage })));
const GitHubCallbackPage = lazy(() => import('@/pages/dashboard').then((m) => ({ default: m.GitHubCallbackPage })));
const DeploymentsPage = lazy(() => import('@/pages/dashboard').then((m) => ({ default: m.DeploymentsPage })));
const IntegrationsPage = lazy(() => import('@/pages/dashboard').then((m) => ({ default: m.IntegrationsPage })));
const ConfigPage = lazy(() => import('@/pages/dashboard').then((m) => ({ default: m.ConfigPage })));
const AIStudioPage = lazy(() => import('@/pages/dashboard').then((m) => ({ default: m.AIStudioPage })));
const AnalyticsPage = lazy(() => import('@/pages/dashboard').then((m) => ({ default: m.AnalyticsPage })));
const SettingsPage = lazy(() => import('@/pages/dashboard').then((m) => ({ default: m.SettingsPage })));
const ProfilePage = lazy(() => import('@/pages/dashboard').then((m) => ({ default: m.ProfilePage })));
const NotificationsPage = lazy(() => import('@/pages/dashboard').then((m) => ({ default: m.NotificationsPage })));
const OrganizationPage = lazy(() => import('@/pages/dashboard').then((m) => ({ default: m.OrganizationPage })));
const AdminPage = lazy(() => import('@/pages/dashboard').then((m) => ({ default: m.AdminPage })));

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
    },
  },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center mesh-bg">
        <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function AuthErrorHandler() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (location.hash && location.hash.includes('error=')) {
      const params = new URLSearchParams(location.hash.substring(1));
      const errorDesc = params.get('error_description');
      if (errorDesc) {
        navigate('/login', { state: { error: errorDesc.replace(/\+/g, ' ') }, replace: true });
      }
    }
  }, [location, navigate]);

  return null;
}

function AppRoutes() {
  return (
    <>
      <AuthErrorHandler />
      <Routes>
      {/* Public Routes */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/features" element={<FeaturesPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/contact" element={<ContactPage />} />
      </Route>

      {/* Auth Routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />

      {/* GitHub OAuth Callback - public route to receive the code and restore session */}
      <Route path="/github/callback" element={<Suspense fallback={<PageLoader />}><GitHubCallbackPage /></Suspense>} />

      {/* Dashboard Routes */}
      <Route
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<Suspense fallback={<PageLoader />}><DashboardPage /></Suspense>} />
        <Route path="/projects" element={<Suspense fallback={<PageLoader />}><ProjectsPage /></Suspense>} />
        <Route path="/github" element={<Suspense fallback={<PageLoader />}><GitHubPage /></Suspense>} />
        <Route path="/deployments" element={<Suspense fallback={<PageLoader />}><DeploymentsPage /></Suspense>} />
        <Route path="/integrations" element={<Suspense fallback={<PageLoader />}><IntegrationsPage /></Suspense>} />
        <Route path="/config" element={<Suspense fallback={<PageLoader />}><ConfigPage /></Suspense>} />
        <Route path="/ai-studio" element={<Suspense fallback={<PageLoader />}><AIStudioPage /></Suspense>} />
        <Route path="/analytics" element={<Suspense fallback={<PageLoader />}><AnalyticsPage /></Suspense>} />
        <Route path="/settings" element={<Suspense fallback={<PageLoader />}><SettingsPage /></Suspense>} />
        <Route path="/profile" element={<Suspense fallback={<PageLoader />}><ProfilePage /></Suspense>} />
        <Route path="/notifications" element={<Suspense fallback={<PageLoader />}><NotificationsPage /></Suspense>} />
        <Route path="/organization" element={<Suspense fallback={<PageLoader />}><OrganizationPage /></Suspense>} />
        <Route path="/admin" element={<Suspense fallback={<PageLoader />}><AdminPage /></Suspense>} />
      </Route>

      {/* Catch all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
