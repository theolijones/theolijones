import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth-store';
import { AppLayout } from '@/components/layout/AppLayout';
import { LoginPage } from '@/pages/LoginPage';
import { AuthCallbackPage } from '@/pages/AuthCallbackPage';
import { LibraryPage } from '@/pages/LibraryPage';
import { FoldersPage } from '@/pages/FoldersPage';
import { LivestreamsPage } from '@/pages/LivestreamsPage';
import { PlacementsPage } from '@/pages/PlacementsPage';
import { SchedulingPage } from '@/pages/SchedulingPage';
import { QAPage } from '@/pages/QAPage';
import { ModulesPage } from '@/pages/ModulesPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { type ReactNode, useEffect } from 'react';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
});

function ProtectedRoute({ children }: { children: ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-velox-bg flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-velox-accent border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function AuthInitializer({ children }: { children: ReactNode }) {
  const setTokens = useAuthStore((s) => s.setTokens);
  const setLoading = useAuthStore((s) => s.setLoading);

  useEffect(() => {
    const accessToken = localStorage.getItem('velox_access_token');
    const idToken = localStorage.getItem('velox_id_token');

    if (accessToken && idToken) {
      setTokens(accessToken, idToken);
    } else {
      setLoading(false);
    }
  }, [setTokens, setLoading]);

  return <>{children}</>;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthInitializer>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/auth/callback" element={<AuthCallbackPage />} />

            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<LibraryPage />} />
              <Route path="folders" element={<FoldersPage />} />
              <Route path="livestreams" element={<LivestreamsPage />} />
              <Route path="placements" element={<PlacementsPage />} />
              <Route path="scheduling" element={<SchedulingPage />} />
              <Route path="qa" element={<QAPage />} />
              <Route path="modules" element={<ModulesPage />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthInitializer>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
