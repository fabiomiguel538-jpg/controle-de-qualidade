/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { useReportStore } from './store/reportStore';

// We will create these pages next
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import ReportForm from './pages/ReportForm';
import ReportList from './pages/ReportList';
import MaintenanceDashboard from './pages/MaintenanceDashboard';

export default function App() {
  const user = useAuthStore((state) => state.user);
  const fetchFromCloud = useReportStore((state) => state.fetchFromCloud);
  const syncPendingReports = useReportStore((state) => state.syncPendingReports);

  // Load cloud data once on initial login/launch (no background auto-polling)
  useEffect(() => {
    if (!user) return;
    if (user.role?.toLowerCase() !== 'mechanic') {
      fetchFromCloud();
    }
  }, [user, fetchFromCloud]);

  const isMechanic = user?.role?.toLowerCase() === 'mechanic' || user?.panel === 'manutencao';

  return (
    <div className="min-h-screen font-sans">
      <Routes>
        <Route
          path="/login"
          element={!user ? <Login /> : <Navigate to={isMechanic ? "/manutencao" : "/producao"} replace />}
        />
        
        {/* Protected Routes */}
        <Route
          path="/"
          element={user ? (isMechanic ? <Navigate to="/manutencao" replace /> : <Dashboard />) : <Navigate to="/login" replace />}
        />
        <Route
          path="/producao"
          element={user ? <Dashboard /> : <Navigate to="/login?panel=producao" replace />}
        />
        <Route
          path="/manutencao"
          element={user ? <MaintenanceDashboard /> : <Navigate to="/login?panel=manutencao" replace />}
        />
        <Route path="/reports/new" element={user ? <ReportForm /> : <Navigate to="/login" replace />} />
        <Route path="/reports/edit/:id" element={user ? <ReportForm /> : <Navigate to="/login" replace />} />
        <Route path="/reports/list" element={user ? <ReportList /> : <Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
