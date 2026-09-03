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

export default function App() {
  const user = useAuthStore((state) => state.user);
  const fetchFromCloud = useReportStore((state) => state.fetchFromCloud);
  const syncPendingReports = useReportStore((state) => state.syncPendingReports);

  // Load cloud data once on initial login/launch (no background auto-polling)
  useEffect(() => {
    if (!user) return;
    fetchFromCloud();
  }, [user, fetchFromCloud]);

  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-800 font-sans">
      <Routes>
        <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
        
        {/* Protected Routes */}
        <Route path="/" element={user ? <Dashboard /> : <Navigate to="/login" />} />
        <Route path="/reports/new" element={user ? <ReportForm /> : <Navigate to="/login" />} />
        <Route path="/reports/edit/:id" element={user ? <ReportForm /> : <Navigate to="/login" />} />
        <Route path="/reports/list" element={user ? <ReportList /> : <Navigate to="/login" />} />
      </Routes>
    </div>
  );
}
