import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LiveDataProvider } from './context/LiveDataContext';
import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import Layout from './components/Layout';
import DashboardPage from './pages/DashboardPage';
import MapPage from './pages/MapPage';
import TrainsPage from './pages/TrainsPage';
import TrainDetailPage from './pages/TrainDetailPage';
import CrossingDetailPage from './pages/CrossingDetailPage';
import AlertsPage from './pages/AlertsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import AdminPage from './pages/AdminPage';
import SettingsPage from './pages/SettingsPage';
import SimulationPage from './pages/SimulationPage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <LiveDataProvider>
          <NotificationProvider>
            <Layout>
              <Routes>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/map" element={<MapPage />} />
                <Route path="/trains" element={<TrainsPage />} />
                <Route path="/trains/:number" element={<TrainDetailPage />} />
                <Route path="/crossings/:number" element={<CrossingDetailPage />} />
                <Route path="/phatak/:number" element={<LegacyCrossingRedirect />} />
                <Route path="/alerts" element={<AlertsPage />} />
                <Route path="/notifications" element={<Navigate to="/alerts" replace />} />
                <Route path="/analytics" element={<AnalyticsPage />} />
                <Route path="/admin" element={<AdminPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/simulation" element={<SimulationPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Layout>
          </NotificationProvider>
        </LiveDataProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

function LegacyCrossingRedirect() {
  const n = window.location.pathname.split('/').pop();
  return <Navigate to={`/crossings/${n}`} replace />;
}
