import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { ProtectedRoute } from './routes/ProtectedRoute';
import { PageLoader } from './components/common/Spinner';

import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import NotFound from './pages/NotFound';
import Profile from './pages/Profile';
import ComplaintDetails from './pages/ComplaintDetails';
import PublicDashboard from './pages/PublicDashboard';

import { CitizenLayout } from './components/layout/CitizenLayout';
import CitizenHome from './pages/citizen/Home';
import SubmitComplaint from './pages/citizen/SubmitComplaint';
import MyComplaints from './pages/citizen/MyComplaints';

import { AdminLayout } from './components/layout/AdminLayout';
import AdminDashboard from './pages/admin/Dashboard';
import AdminComplaints from './pages/admin/Complaints';
import AdminMapView from './pages/admin/MapView';
import AdminAnalytics from './pages/admin/Analytics';
import AdminIncidents from './pages/admin/Incidents';
import AdminIncidentDetails from './pages/admin/IncidentDetails';
import AdminReviewQueue from './pages/admin/ReviewQueue';
import IntelligenceCenter from './pages/admin/IntelligenceCenter';

import { OfficerLayout } from './components/layout/OfficerLayout';
import OfficerDashboard from './pages/officer/Dashboard';
import OfficerAllComplaints from './pages/officer/AllComplaints';

function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Landing />;
  if (user.role === 'ADMIN') return <Navigate to="/admin" replace />;
  if (user.role === 'OFFICER') return <Navigate to="/officer" replace />;
  return (
    <ProtectedRoute roles={['CITIZEN']}>
      <CitizenLayout />
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/public" element={<PublicDashboard />} />

      <Route path="/" element={<RootRedirect />}>
        <Route index element={<CitizenHome />} />
      </Route>

      <Route
        element={
          <ProtectedRoute roles={['CITIZEN']}>
            <CitizenLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/complaints/new" element={<SubmitComplaint />} />
        <Route path="/my-complaints" element={<MyComplaints />} />
      </Route>

      <Route
        element={
          <ProtectedRoute roles={['ADMIN']}>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/intelligence" element={<IntelligenceCenter />} />
        <Route path="/admin/complaints" element={<AdminComplaints />} />
        <Route path="/admin/map" element={<AdminMapView />} />
        <Route path="/admin/analytics" element={<AdminAnalytics />} />
        <Route path="/admin/incidents" element={<AdminIncidents />} />
        <Route path="/admin/incidents/:id" element={<AdminIncidentDetails />} />
        <Route path="/admin/review" element={<AdminReviewQueue />} />
      </Route>

      <Route
        element={
          <ProtectedRoute roles={['OFFICER']}>
            <OfficerLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/officer" element={<OfficerDashboard />} />
        <Route path="/officer/all" element={<OfficerAllComplaints />} />
      </Route>

      {/* Shared complaint detail + profile, reachable by any authenticated role via their own layout */}
      <Route
        path="/complaints/:id"
        element={
          <ProtectedRoute>
            <RoleAwareLayout>
              <ComplaintDetails />
            </RoleAwareLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <RoleAwareLayout>
              <Profile />
            </RoleAwareLayout>
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function RoleAwareLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (user?.role === 'ADMIN') return <AdminLayout>{children}</AdminLayout>;
  if (user?.role === 'OFFICER') return <OfficerLayout>{children}</OfficerLayout>;
  return <CitizenLayout>{children}</CitizenLayout>;
}
