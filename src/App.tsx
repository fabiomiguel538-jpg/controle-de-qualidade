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

  // Auto-sync with cloud database
  useEffect(() => {
    if (!user) return;

    // Fetch immediately on login / app launch
    fetchFromCloud();

    // Periodic sync every 25 seconds
    const interval = setInterval(() => {
      fetchFromCloud();
    }, 25000);

    // Sync when coming back to tab / browser
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchFromCloud();
      }
    };

    // Sync when device reconnects to internet
    const handleOnline = () => {
      syncPendingReports();
      fetchFromCloud();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('online', handleOnline);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('online', handleOnline);
    };
  }, [user, fetchFromCloud, syncPendingReports]);

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
