import { useEffect, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import { useAuthStore } from './store/authStore';
import { Toaster } from 'react-hot-toast';
import { Skeleton } from './components/ui/Skeleton';

// Components (eager load layout elements)
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { PortalLayout } from './pages/portal/PortalLayout';
import { DynamicBranding } from './components/DynamicBranding';

// Pages (Lazy load to code split)
const Login = lazy(() => import('./pages/Login').then(m => ({ default: m.Login })));
const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const AllDevotees = lazy(() => import('./pages/AllDevotees').then(m => ({ default: m.AllDevotees })));
const DevoteeEntry = lazy(() => import('./pages/DevoteeEntry').then(m => ({ default: m.DevoteeEntry })));
const ChandaEntry = lazy(() => import('./pages/ChandaEntry').then(m => ({ default: m.ChandaEntry })));
const CulturalActivities = lazy(() => import('./pages/CulturalActivities').then(m => ({ default: m.CulturalActivities })));
const Expenses = lazy(() => import('./pages/Expenses').then(m => ({ default: m.Expenses })));
const VIPGotram = lazy(() => import('./pages/VIPGotram').then(m => ({ default: m.VIPGotram })));
const Settings = lazy(() => import('./pages/Settings').then(m => ({ default: m.Settings })));
const Payments = lazy(() => import('./pages/Payments').then(m => ({ default: m.Payments })));
const Records = lazy(() => import('./pages/Records').then(m => ({ default: m.Records })));
const DailyRecords = lazy(() => import('./pages/DailyRecords').then(m => ({ default: m.DailyRecords })));
const SPLRecords = lazy(() => import('./pages/SPLRecords').then(m => ({ default: m.SPLRecords })));
const PoojaBooking = lazy(() => import('./pages/PoojaBooking'));
const UserManagement = lazy(() => import('./pages/UserManagement').then(m => ({ default: m.UserManagement })));
const QRPortalSettings = lazy(() => import('./pages/QRPortalSettings').then(m => ({ default: m.QRPortalSettings })));
const FeedbackMessages = lazy(() => import('./pages/FeedbackMessages').then(m => ({ default: m.FeedbackMessages })));
const Notifications = lazy(() => import('./pages/Notifications').then(m => ({ default: m.Notifications })));
const ResetPassword = lazy(() => import('./pages/ResetPassword').then(m => ({ default: m.ResetPassword })));

// Portal Pages
const PortalHome = lazy(() => import('./pages/portal/PortalHome').then(m => ({ default: m.PortalHome })));
const PortalReceipt = lazy(() => import('./pages/portal/PortalReceipt').then(m => ({ default: m.PortalReceipt })));
const PortalPooja = lazy(() => import('./pages/portal/PortalPooja').then(m => ({ default: m.PortalPooja })));
const PortalFeedback = lazy(() => import('./pages/portal/PortalFeedback').then(m => ({ default: m.PortalFeedback })));
const QRChanda = lazy(() => import('./pages/portal/QRChanda').then(m => ({ default: m.QRChanda })));
const DirectReceipt = lazy(() => import('./pages/DirectReceipt').then(m => ({ default: m.DirectReceipt })));

export default function App() {
  const { setSession, fetchAppUser, setLoading } = useAuthStore();

  useEffect(() => {
    // 1. Restore session on mount
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        if (session.user.id) await fetchAppUser(session.user.id);
      }
      setLoading(false);
    });

    // 2. Listen for future auth changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        if (session?.user) {
          if (session.user.id) await fetchAppUser(session.user.id);
        }
        setLoading(false);
      },
    );

    return () => subscription.unsubscribe();
  }, []);

  // Full page skeleton for route transitions
  const PageSkeleton = () => (
    <div className="p-6 space-y-6 max-w-7xl mx-auto w-full">
      <Skeleton className="h-12 w-1/3 mb-6" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
      </div>
      <Skeleton className="h-96 rounded-xl mt-6" />
    </div>
  );

  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <DynamicBranding />
      <Suspense fallback={<PageSkeleton />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Login />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* â”€â”€ Public QR Portal Routes â”€â”€ */}
          <Route path="/portal" element={<PortalLayout />}>
            <Route index element={<PortalHome />} />
            <Route path="receipt" element={<PortalReceipt />} />
            <Route path="pooja" element={<PortalPooja />} />
            <Route path="feedback" element={<PortalFeedback />} />
            <Route path="qr-chanda" element={<QRChanda />} />
          </Route>

          <Route path="/preview-receipt/:id" element={<DirectReceipt />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route
                path="/devotees"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'superadmin']}>
                    <AllDevotees />
                  </ProtectedRoute>
                }
              />
              <Route path="/chanda" element={<DevoteeEntry />} />
              <Route path="/cultural" element={<CulturalActivities />} />
              <Route path="/expenses" element={<Expenses />} />
              <Route
                path="/vip-gotram"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'superadmin']}>
                    <VIPGotram />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/notifications"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'superadmin']}>
                    <Notifications />
                  </ProtectedRoute>
                }
              />
              <Route path="/settings" element={<Settings />} />
              <Route
                path="/payments"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'superadmin']}>
                    <Payments />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/pooja-booking"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'superadmin']}>
                    <PoojaBooking />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/records"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'superadmin']}>
                    <Records />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/daily-records"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'superadmin']}>
                    <DailyRecords />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/spl-records"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'superadmin']}>
                    <SPLRecords />
                  </ProtectedRoute>
                }
              />
              {/* â”€â”€ Superadmin Only: User Management â”€â”€ */}
              <Route
                path="/admin/users"
                element={
                  <ProtectedRoute allowedRoles={['superadmin']}>
                    <UserManagement />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/qr-portal-settings"
                element={
                  <ProtectedRoute allowedRoles={['superadmin']}>
                    <QRPortalSettings />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/feedback"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'superadmin']}>
                    <FeedbackMessages />
                  </ProtectedRoute>
                }
              />
            </Route>
          </Route>
        </Routes>
      </Suspense>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#1C1917',
            color: '#FFF',
            borderRadius: '12px',
            padding: '12px 16px',
            fontSize: '14px',
            fontWeight: 600,
            boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
          },
          success: {
            iconTheme: { primary: '#10B981', secondary: '#fff' },
          },
          error: {
            iconTheme: { primary: '#EF4444', secondary: '#fff' },
          },
        }}
      />
    </BrowserRouter>
  );
}
