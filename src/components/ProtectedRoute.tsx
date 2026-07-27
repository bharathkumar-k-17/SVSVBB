import type { ReactNode } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { useAppSettings } from '../hooks/queries';

type ProtectedRouteProps = {
  allowedRoles?: Array<'superadmin' | 'admin' | 'volunteer'>;
  children?: ReactNode;
};

export const ProtectedRoute = ({ allowedRoles, children }: ProtectedRouteProps) => {
  const { supabaseUser, appUser, loading } = useAuthStore();
  const { data: settings, isLoading: checkingSystem } = useAppSettings();

  const systemAccess = settings?.system_access ?? true;

  // ── Loading State ──
  if (loading || checkingSystem) {
    return (
      <div className="flex min-h-screen bg-gray-50 items-center justify-center">
        {/* Minimal blank shell for auth initialization */}
      </div>
    );
  }

  // ── Not Logged In ──
  if (!supabaseUser) {
    return <Navigate to="/login" replace />;
  }

  // ── Profile Not Loaded ──
  if (!appUser) {
    return (
      <div className="flex min-h-screen bg-gray-50 items-center justify-center">
        {/* Minimal blank shell for auth verification */}
      </div>
    );
  }

  // ── Pending / Rejected ──
  if (appUser.status !== 'approved') {
    const isRejected = appUser.status === 'rejected';
    return (
      <div className="flex min-h-screen items-center justify-center p-6" style={{ background: 'linear-gradient(135deg, #FFF7ED, #FFFBEB)' }}>
        <div
          className={`bg-white rounded-2xl shadow-xl p-8 max-w-md text-center border-2 ${
            isRejected ? 'border-red-200' : 'border-amber-200'
          }`}
          style={{ animation: 'card-enter 0.4s ease-out' }}
        >
          <div className="text-6xl mb-4">{isRejected ? '❌' : '🙏'}</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">
            {isRejected ? 'Account Rejected' : 'Pending Approval'}
          </h2>
          <p className="text-gray-500 text-sm leading-relaxed mb-1">
            {isRejected
              ? 'Your account access has been rejected by the Superadmin.'
              : 'Your account is awaiting Superadmin approval.'}
          </p>
          <p className="text-gray-400 text-xs mb-6">
            {isRejected
              ? 'Please contact the administrator if you believe this is an error.'
              : 'You will be notified once your account is approved. Please check back later.'}
          </p>
          <button
            onClick={() => supabase.auth.signOut()}
            className={`px-8 py-2.5 ${
              isRejected
                ? 'bg-red-500 hover:bg-red-600'
                : 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700'
            } text-white rounded-xl font-bold transition-all shadow-md`}
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  // ── System Access Check ──
  if (systemAccess === false && appUser.role !== 'superadmin') {
    return (
      <div className="flex min-h-screen items-center justify-center p-6" style={{ background: 'linear-gradient(135deg, #FFF7ED, #FFFBEB)' }}>
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center border-2 border-orange-200">
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">System Maintenance</h2>
          <p className="text-gray-500 text-sm leading-relaxed mb-6">
            System access is currently disabled for volunteers and admins. Please try again later.
          </p>
          <button onClick={() => supabase.auth.signOut()} className="px-8 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold transition-all shadow-md">
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  // ── Role Check ──
  if (allowedRoles?.length && !allowedRoles.includes(appUser.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
};
