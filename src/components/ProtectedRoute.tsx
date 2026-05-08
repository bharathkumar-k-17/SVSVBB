import type { ReactNode } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { useAuthStore } from '../store/authStore';
import { auth } from '../lib/firebase';

type ProtectedRouteProps = {
  allowedRoles?: Array<'super_admin' | 'admin' | 'volunteer'>;
  children?: ReactNode;
};

export const ProtectedRoute = ({ allowedRoles, children }: ProtectedRouteProps) => {
  const { user, appUser, loading } = useAuthStore();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-orange-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-orange-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-orange-600 font-semibold text-lg">Loading festival workspace...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // If user is logged in but not yet fetched from Firestore — show loader briefly
  if (!appUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-orange-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-orange-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-orange-600 font-semibold text-lg">Verifying account...</p>
        </div>
      </div>
    );
  }

  // Block non-approved accounts
  if (appUser.status !== 'approved') {
    const isRejected = appUser.status === 'rejected';
    return (
      <div className="flex min-h-screen items-center justify-center bg-orange-50 p-6">
        <div className={`bg-white rounded-2xl shadow-lg p-8 max-w-md text-center border ${isRejected ? 'border-red-200' : 'border-orange-200'}`}>
          <div className="text-5xl mb-4">{isRejected ? '❌' : '🙏'}</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">
            {isRejected ? 'Account Rejected' : 'Account Pending Approval'}
          </h2>
          <p className="text-gray-500 text-sm">
            {isRejected 
              ? 'Your account access has been rejected. Please contact the administrator.'
              : 'Your account is pending admin approval. Please contact the administrator.'}
          </p>
          <button
            onClick={() => { signOut(auth); }}
            className={`mt-6 px-6 py-2 ${isRejected ? 'bg-red-500 hover:bg-red-600' : 'bg-orange-500 hover:bg-orange-600'} text-white rounded-xl font-semibold transition-colors`}
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  if (allowedRoles?.length && !allowedRoles.includes(appUser.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
};
