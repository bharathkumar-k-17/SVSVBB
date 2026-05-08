import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './lib/firebase';
import { useAuthStore } from './store/authStore';
import { Toaster } from 'react-hot-toast';

// Components
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';

// Pages
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { AllDevotees } from './pages/AllDevotees';
import { ChandaEntry } from './pages/ChandaEntry';
import { CulturalActivities } from './pages/CulturalActivities';
import { Expenses } from './pages/Expenses';
import { VIPGotram } from './pages/VIPGotram';
import { Records } from './pages/Records';
import { Settings } from './pages/Settings';
import { Payments } from './pages/Payments';
import { SPLRecords } from './pages/SPLRecords';
import PoojaBooking from './pages/PoojaBooking';

export default function App() {
  const { setUser, setLoading, fetchAppUser } = useAuthStore();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        await fetchAppUser(user.uid);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Login />} />
        
        <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
            <Route
              path="/devotees"
              element={(
                <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
                  <AllDevotees />
                </ProtectedRoute>
              )}
            />
            <Route path="/chanda" element={<ChandaEntry />} />
            <Route path="/cultural" element={<CulturalActivities />} />
            <Route path="/expenses" element={<Expenses />} />
            <Route
              path="/vip-gotram"
              element={(
                <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
                  <VIPGotram />
                </ProtectedRoute>
              )}
            />
            <Route
              path="/records"
              element={(
                <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
                  <Records />
                </ProtectedRoute>
              )}
            />
            <Route path="/settings" element={<Settings />} />
            <Route
              path="/payments"
              element={(
                <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
                  <Payments />
                </ProtectedRoute>
              )}
            />
            <Route
              path="/pooja-booking"
              element={(
                <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
                  <PoojaBooking />
                </ProtectedRoute>
              )}
            />
            <Route
              path="/spl-records"
              element={(
                <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
                  <SPLRecords />
                </ProtectedRoute>
              )}
            />
          </Route>
        </Route>
      </Routes>
      <Toaster position="top-right" />
    </BrowserRouter>
  );
}
