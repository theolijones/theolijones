import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './components/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import CompaniesPage from './pages/CompaniesPage';
import InfractionsPage from './pages/InfractionsPage';
import ReportsPage from './pages/ReportsPage';
import UsersPage from './pages/UsersPage';
import MailingListPage from './pages/MailingListPage';

function ProtectedLayout({ children, admin }) {
  return (
    <ProtectedRoute admin={admin}>
      <Layout>{children}</Layout>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <ProtectedLayout>
              <Dashboard />
            </ProtectedLayout>
          }
        />
        <Route
          path="/companies"
          element={
            <ProtectedLayout admin>
              <CompaniesPage />
            </ProtectedLayout>
          }
        />
        <Route
          path="/infractions"
          element={
            <ProtectedLayout>
              <InfractionsPage />
            </ProtectedLayout>
          }
        />
        <Route
          path="/reports"
          element={
            <ProtectedLayout>
              <ReportsPage />
            </ProtectedLayout>
          }
        />
        <Route
          path="/users"
          element={
            <ProtectedLayout admin>
              <UsersPage />
            </ProtectedLayout>
          }
        />
        <Route
          path="/mailing-list"
          element={
            <ProtectedLayout admin>
              <MailingListPage />
            </ProtectedLayout>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
