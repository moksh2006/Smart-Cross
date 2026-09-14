import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { SocketProvider } from './context/SocketContext';
import { SoundProvider } from './context/SoundContext';
import { LocationProvider } from './context/LocationContext';
import Navbar from './components/Navbar';
import SimulationModal from './components/SimulationModal';
import Dashboard from './pages/Dashboard';
import MapPage from './pages/MapPage';
import PhatakDetail from './pages/PhatakDetail';
import TrainsPage from './pages/TrainsPage';
import AlertsPage from './pages/AlertsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import AdminDashboard from './pages/AdminDashboard';

export function App() {
  const [isSimModalOpen, setIsSimModalOpen] = useState(false);

  return (
    <Router>
      <SocketProvider>
        <SoundProvider>
          <LocationProvider>
            <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-sky-500 selection:text-white">
              {/* Top Navigation */}
              <Navbar onOpenSimulation={() => setIsSimModalOpen(true)} />

              {/* Simulation Modal (Global) */}
              <SimulationModal
                isOpen={isSimModalOpen}
                onClose={() => setIsSimModalOpen(false)}
              />

              {/* Main App Content */}
              <main className="flex-1">
                <Routes>
                  <Route path="/" element={<Dashboard onOpenSimulation={() => setIsSimModalOpen(true)} />} />
                  <Route path="/map" element={<MapPage />} />
                  <Route path="/phataks" element={<Dashboard onOpenSimulation={() => setIsSimModalOpen(true)} />} />
                  <Route path="/phatak/:id" element={<PhatakDetail />} />
                  <Route path="/trains" element={<TrainsPage />} />
                  <Route path="/alerts" element={<AlertsPage />} />
                  <Route path="/analytics" element={<AnalyticsPage />} />
                  <Route path="/admin" element={<AdminDashboard onOpenSimulation={() => setIsSimModalOpen(true)} />} />
                  <Route path="/admin/system" element={<AdminDashboard onOpenSimulation={() => setIsSimModalOpen(true)} />} />
                </Routes>
              </main>

              {/* Footer */}
              <footer className="border-t border-slate-800 bg-slate-950 py-6 text-center text-xs text-slate-500">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-1">
                  <p className="font-semibold text-slate-400">
                    SMARTCROSS — Patiala Railway Phatak Real-Time Monitor
                  </p>
                  <p>
                    Authoritative GIS Level Crossing Tracking for Phataks 19, 20, 23 & 24 • Northern Railway PTA–DBN Corridor
                  </p>
                  <p className="text-[11px] text-slate-600">
                    Prediction only — railway gate status may change due to operational railway conditions.
                  </p>
                </div>
              </footer>
            </div>
          </LocationProvider>
        </SoundProvider>
      </SocketProvider>
    </Router>
  );
}

export default App;
